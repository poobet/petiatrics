import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { InvoiceCreatedEvent, InvoicePaidEvent, VisitFinalizedEvent } from '../../../common/events/domain-events';
import { TaxEngineService } from './tax-engine.service';
import { VisitService } from '../../clinical/services/visit.service';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';

import { GLPostingService } from './gl-posting.service';
import { CreateCreditNoteDto } from '../dto/create-credit-note.dto';
import { CreateDebitNoteDto } from '../dto/create-debit-note.dto';
import { CreateItemizedAdjustmentDto } from '../dto/create-itemized-adjustment.dto';
import { DfTransactionService } from '../../commission/services/df-transaction.service';

export interface CreateInvoiceLineItemDto {
  itemType: 'SERVICE' | 'PRODUCT';
  description: string;
  quantity: number;
  unitPriceMinor: number;
  /** Product ID — required for PRODUCT type lines to resolve VAT and dispensing compliance. */
  sourceReferenceId?: string;
  productId?: string;
}

export interface CreateInvoiceDto {
  /** MongoDB VisitRecord._id. If absent → OTC/Retail context. */
  visitId?: string | null;
  /** MongoDB PetProfile._id. Optional for OTC. */
  patientId?: string | null;
  /** Owner user ID. Optional for OTC. */
  ownerUserId?: string | null;
  /** Supervisor user ID that authorized this sale (for Dangerous Drugs at OTC) */
  overrideApprovedByUserId?: string | null;
  lineItems: CreateInvoiceLineItemDto[];
  /**
   * @deprecated Use per-line VAT via TaxEngineService.
   * Kept for backward-compatibility with visit-event created invoices.
   */
  taxRateBps?: number;
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
    private readonly taxEngine: TaxEngineService,
    private readonly visitService: VisitService,
    private readonly sequenceService: DocumentSequenceService,
    @Optional() private readonly glPostingService?: GLPostingService,
    @Optional() private readonly dfTransactionService?: DfTransactionService,
  ) {}

  /**
   * Create an itemized (line-item level) Credit Note or Debit Note.
   * Handles per-item remaining balance validation, per-line VAT calculation,
   * Doctor Fee (DF) adjustments, and inventory restocking.
   */
  async createItemizedAdjustment(
    clinicId: string,
    invoiceId: string,
    dto: CreateItemizedAdjustmentDto,
    actorId?: string,
  ) {
    const originalInvoice = await this.findById(clinicId, invoiceId);

    if (originalInvoice.status !== 'PAID') {
      throw new BadRequestException('Adjustments can only be issued for PAID invoices');
    }

    if (originalInvoice.documentType !== 'INVOICE') {
      throw new BadRequestException('Adjustments can only be issued against an INVOICE');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item must be specified for adjustment');
    }

    const isCreditNote = dto.type === 'CREDIT_NOTE';
    const processedLines: Array<{
      originalItemId: string;
      itemType: 'SERVICE' | 'PRODUCT';
      description: string;
      quantity: number;
      unitPriceMinor: number;
      subtotalMinor: number;
      vatRateBps: number;
      vatTotalMinor: number;
      productId: string | null;
      sourceReferenceId: string | null;
      returnToStock: boolean;
      adjustQtyNumber: number;
      adjustAmountMinor: number;
    }> = [];

    for (const itemInput of dto.items) {
      const origItem = originalInvoice.lineItems.find((li) => li.id === itemInput.originalItemId);
      if (!origItem) {
        throw new NotFoundException(`Invoice line item "${itemInput.originalItemId}" not found in invoice ${invoiceId}`);
      }

      // Fetch existing adjustments for this specific line item
      const existingAdjustments = await this.prisma.invoiceLineItem.findMany({
        where: { originalInvoiceItemId: origItem.id },
        select: { quantity: true, subtotalMinor: true },
      });

      const alreadyAdjustedQty = existingAdjustments.reduce(
        (sum, adj) => sum + Math.abs(Number(adj.quantity)),
        0,
      );
      const alreadyAdjustedAmount = existingAdjustments.reduce(
        (sum, adj) => sum + Math.abs(adj.subtotalMinor),
        0,
      );

      const remainingQty = Number(origItem.quantity) - alreadyAdjustedQty;
      const remainingAmount = origItem.subtotalMinor - alreadyAdjustedAmount;

      if (itemInput.adjustQty > remainingQty + 0.0001) {
        throw new BadRequestException(
          `Adjust quantity (${itemInput.adjustQty}) for "${origItem.description}" exceeds remaining quantity (${remainingQty.toFixed(3)}).`,
        );
      }

      if (itemInput.adjustAmountMinor > remainingAmount) {
        throw new BadRequestException(
          `Adjust amount (${itemInput.adjustAmountMinor}) for "${origItem.description}" exceeds remaining balance (${remainingAmount}).`,
        );
      }

      const vatRateBps = origItem.vatRateBps;
      const vatTotalMinor = Math.round(itemInput.adjustAmountMinor * (vatRateBps / 10000));

      const sign = isCreditNote ? -1 : 1;
      const finalQty = sign * Math.abs(itemInput.adjustQty);
      const finalSubtotal = sign * Math.abs(itemInput.adjustAmountMinor);
      const finalVatTotal = sign * Math.abs(vatTotalMinor);
      const prefix = isCreditNote ? '[CN]' : '[DN]';

      processedLines.push({
        originalItemId: origItem.id,
        itemType: origItem.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
        description: `${prefix} ${origItem.description}`,
        quantity: finalQty,
        unitPriceMinor: origItem.unitPriceMinor,
        subtotalMinor: finalSubtotal,
        vatRateBps,
        vatTotalMinor: finalVatTotal,
        productId: origItem.productId || origItem.sourceReferenceId || null,
        sourceReferenceId: origItem.sourceReferenceId || null,
        returnToStock: itemInput.returnToStock ?? false,
        adjustQtyNumber: Math.abs(itemInput.adjustQty),
        adjustAmountMinor: Math.abs(itemInput.adjustAmountMinor),
      });
    }

    const subtotalMinor = processedLines.reduce((sum, l) => sum + l.subtotalMinor, 0);
    const taxTotalMinor = processedLines.reduce((sum, l) => sum + l.vatTotalMinor, 0);
    const totalMinor = subtotalMinor + taxTotalMinor;
    const blendedRateBps = subtotalMinor !== 0 ? Math.round((taxTotalMinor / subtotalMinor) * 10000) : 0;

    const docTypeConstant = isCreditNote ? DOC_TYPE.CREDIT_NOTE : DOC_TYPE.DEBIT_NOTE;
    let code: string | undefined;
    try {
      code = await this.sequenceService.generate(clinicId, docTypeConstant);
    } catch {
      code = `${isCreditNote ? 'CN' : 'DN'}-${Date.now()}`;
    }

    const db = scopedPrisma(this.prisma, clinicId);

    const adjustmentInvoice = await db.invoice.create({
      data: {
        clinicId,
        code,
        documentType: dto.type,
        referenceInvoiceId: originalInvoice.id,
        reasonCode: dto.reasonCode,
        visitId: originalInvoice.visitId,
        patientId: originalInvoice.patientId,
        ownerUserId: originalInvoice.ownerUserId,
        subtotalMinor,
        taxRateBps: blendedRateBps,
        taxTotalMinor,
        totalMinor,
        status: 'PAID',
        issuedAt: new Date(),
        paidAt: new Date(),
        lineItems: {
          create: processedLines.map((l) => ({
            originalInvoiceItemId: l.originalItemId,
            itemType: l.itemType,
            description: l.description,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            subtotalMinor: l.subtotalMinor,
            vatRateBps: l.vatRateBps,
            vatTotalMinor: l.vatTotalMinor,
            productId: l.productId,
            sourceReferenceId: l.sourceReferenceId,
            returnToStock: l.returnToStock,
          })),
        },
      },
      include: { lineItems: true },
    });

    // ── 1. GL Posting ────────────────────────────────────────────────────────
    try {
      if (this.glPostingService) {
        if (isCreditNote) {
          await this.glPostingService.postJournal(clinicId, {
            type: 'GENERAL',
            description: `Credit Note ${adjustmentInvoice.code || adjustmentInvoice.id} for Invoice ${
              originalInvoice.code || originalInvoice.id
            }: ${dto.reason}`,
            sourceRefType: 'CREDIT_NOTE',
            sourceRefId: adjustmentInvoice.id,
            lines: [
              { glAccountId: 'REV-001', debitMinor: Math.abs(totalMinor), creditMinor: 0 },
              { glAccountId: 'AR-001', debitMinor: 0, creditMinor: Math.abs(totalMinor) },
            ],
          });
        } else {
          await this.glPostingService.postJournal(clinicId, {
            type: 'GENERAL',
            description: `Debit Note ${adjustmentInvoice.code || adjustmentInvoice.id} for Invoice ${
              originalInvoice.code || originalInvoice.id
            }: ${dto.reason}`,
            sourceRefType: 'DEBIT_NOTE',
            sourceRefId: adjustmentInvoice.id,
            lines: [
              { glAccountId: 'AR-001', debitMinor: totalMinor, creditMinor: 0 },
              { glAccountId: 'REV-001', debitMinor: 0, creditMinor: totalMinor },
            ],
          });
        }
      }
    } catch {
      // Ignore unconfigured GL accounts
    }

    // ── 2. Inventory Restocking & DF Adjustment Impact ──────────────────────
    for (const line of processedLines) {
      if (line.returnToStock && line.productId && isCreditNote) {
        try {
          const existingBal = await this.prisma.branchStockBalance.findFirst({
            where: { clinicId, productId: line.productId },
          });

          if (existingBal) {
            await this.prisma.branchStockBalance.update({
              where: { id: existingBal.id },
              data: {
                quantity: { increment: line.adjustQtyNumber },
                version: { increment: 1 },
              },
            });
          }

          await this.prisma.stockMovement.create({
            data: {
              clinicId,
              productId: line.productId,
              delta: line.adjustQtyNumber,
              quantityBefore: existingBal ? Number(existingBal.quantity) : 0,
              quantityAfter: (existingBal ? Number(existingBal.quantity) : 0) + line.adjustQtyNumber,
              reason: 'REPLENISH',
              referenceType: 'MANUAL',
              referenceId: `CN-${adjustmentInvoice.id}`,
              actorId: actorId || originalInvoice.ownerUserId || 'SYSTEM',
              status: 'COMMITTED',
            },
          });
        } catch (err) {
          console.error(`Inventory restocking failed for product ${line.productId}:`, err);
        }
      }

      if (this.dfTransactionService) {
        try {
          const originalDfTx = await this.prisma.dfTransaction.findFirst({
            where: {
              clinicId,
              OR: [
                { invoiceLineItemId: line.originalItemId },
                { invoiceId: originalInvoice.id, productId: line.productId || undefined },
              ],
              status: { in: ['ACCRUED', 'CONFIRMED'] },
            },
          });

          if (originalDfTx) {
            const originalLine = originalInvoice.lineItems.find((l) => l.id === line.originalItemId);
            const origSubtotal = originalLine ? originalLine.subtotalMinor : 1;
            const ratio = line.adjustAmountMinor / (origSubtotal || 1);
            const adjDfAmount = Math.round(originalDfTx.dfAmountMinor * ratio);

            if (adjDfAmount > 0) {
              await this.dfTransactionService.createAdjustment(clinicId, {
                businessPartnerId: originalDfTx.businessPartnerId,
                type: isCreditNote ? ('ADJUSTMENT_DEDUCT' as any) : ('ADJUSTMENT_ADD' as any),
                amountMinor: adjDfAmount,
                reason: `[${dto.type}] ${dto.reason} (Item: ${line.description})`,
                referenceTransactionId: originalDfTx.id,
              });
            }
          }
        } catch (err) {
          console.error(`DF Adjustment failed for item ${line.originalItemId}:`, err);
        }
      }
    }

    return adjustmentInvoice;
  }

  /**
   * Calculate the remaining refundable amount for an invoice by summing existing CN totals.
   */
  private async getRemainingRefundable(clinicId: string, invoiceId: string, originalTotal: number): Promise<number> {
    const existingCNs = await this.prisma.invoice.findMany({
      where: {
        clinicId,
        referenceInvoiceId: invoiceId,
        documentType: 'CREDIT_NOTE',
      },
      select: { totalMinor: true },
    });

    // CN totals are negative, so summing them gives a negative number
    const totalRefunded = existingCNs.reduce((sum, cn) => sum + Math.abs(cn.totalMinor), 0);
    return Math.abs(originalTotal) - totalRefunded;
  }

  async createCreditNote(clinicId: string, invoiceId: string, dto: CreateCreditNoteDto) {
    const originalInvoice = await this.findById(clinicId, invoiceId);

    if (originalInvoice.status !== 'PAID') {
      throw new BadRequestException('Credit Note can only be issued for PAID invoices');
    }

    if (originalInvoice.documentType !== 'INVOICE') {
      throw new BadRequestException('Credit Note can only be issued against an INVOICE');
    }

    // ── Refund cap validation ─────────────────────────────────────────────────
    const remainingRefundable = await this.getRemainingRefundable(
      clinicId,
      originalInvoice.id,
      originalInvoice.totalMinor,
    );

    if (remainingRefundable <= 0) {
      throw new BadRequestException(
        'This invoice has already been fully refunded. No further Credit Notes can be issued.',
      );
    }

    // ── Partial refund by amount ───────────────────────────────────────────────
    if (dto.refundAmountMinor) {
      if (dto.refundAmountMinor > remainingRefundable) {
        throw new BadRequestException(
          `Refund amount (${dto.refundAmountMinor}) exceeds remaining refundable balance (${remainingRefundable}).`,
        );
      }

      // Calculate tax portion proportionally from the refund amount
      const taxRateBps = originalInvoice.taxRateBps || 0;
      // refundAmountMinor is the total (inclusive of tax)
      // Back-calculate: subtotal = total / (1 + rate), tax = total - subtotal
      const subtotalMinor = taxRateBps > 0
        ? -Math.round(dto.refundAmountMinor / (1 + taxRateBps / 10000))
        : -dto.refundAmountMinor;
      const taxTotalMinor = -dto.refundAmountMinor - subtotalMinor;
      const totalMinor = subtotalMinor + taxTotalMinor;

      let code: string | undefined;
      try {
        code = await this.sequenceService.generate(clinicId, DOC_TYPE.CREDIT_NOTE);
      } catch (e) {
        code = `CN-${Date.now()}`;
      }

      const db = scopedPrisma(this.prisma, clinicId);

      const creditNote = await db.invoice.create({
        data: {
          clinicId,
          code,
          documentType: 'CREDIT_NOTE',
          referenceInvoiceId: originalInvoice.id,
          reasonCode: dto.reasonCode,
          visitId: originalInvoice.visitId,
          patientId: originalInvoice.patientId,
          ownerUserId: originalInvoice.ownerUserId,
          subtotalMinor,
          taxRateBps,
          taxTotalMinor,
          totalMinor,
          status: 'PAID',
          issuedAt: new Date(),
          paidAt: new Date(),
          lineItems: {
            create: [{
              itemType: 'SERVICE' as const,
              description: `[CN] Partial refund: ${dto.reason}`,
              quantity: -1,
              unitPriceMinor: Math.abs(subtotalMinor),
              subtotalMinor,
              vatRateBps: taxRateBps,
              vatTotalMinor: taxTotalMinor,
              productId: null,
              sourceReferenceId: null,
            }],
          },
        },
        include: { lineItems: true },
      });

      this.postCreditNoteJournal(clinicId, creditNote, originalInvoice, dto.reason, totalMinor);
      return creditNote;
    }

    // ── Full or line-item-based credit note ────────────────────────────────────
    const lineItemsToCredit =
      dto.lineItems && dto.lineItems.length > 0
        ? dto.lineItems
        : originalInvoice.lineItems.map((item) => ({
            itemType: item.itemType,
            description: item.description,
            quantity: Number(item.quantity),
            unitPriceMinor: item.unitPriceMinor,
            productId: item.productId || undefined,
            sourceReferenceId: item.sourceReferenceId || undefined,
          }));

    let subtotalMinor = 0;
    let taxTotalMinor = 0;

    const cnLineItems = lineItemsToCredit.map((item) => {
      const subtotal = Math.round(Number(item.quantity) * item.unitPriceMinor);
      const taxTotal = Math.round(subtotal * ((originalInvoice.taxRateBps || 0) / 10000));
      subtotalMinor -= subtotal;
      taxTotalMinor -= taxTotal;
      return {
        itemType: item.itemType,
        description: `[CN] ${item.description}`,
        quantity: -Math.abs(Number(item.quantity)),
        unitPriceMinor: item.unitPriceMinor,
        subtotalMinor: -subtotal,
        vatRateBps: originalInvoice.taxRateBps || 0,
        vatTotalMinor: -taxTotal,
        productId: item.productId || item.sourceReferenceId || null,
        sourceReferenceId: item.sourceReferenceId || null,
      };
    });

    const totalMinor = subtotalMinor + taxTotalMinor;

    // Validate that this full/line-item CN doesn't exceed remaining refundable
    if (Math.abs(totalMinor) > remainingRefundable) {
      throw new BadRequestException(
        `Credit Note total (${Math.abs(totalMinor)}) exceeds remaining refundable balance (${remainingRefundable}). Consider issuing a partial refund.`,
      );
    }

    let code: string | undefined;
    try {
      code = await this.sequenceService.generate(clinicId, DOC_TYPE.CREDIT_NOTE);
    } catch (e) {
      code = `CN-${Date.now()}`;
    }

    const db = scopedPrisma(this.prisma, clinicId);

    const creditNote = await db.invoice.create({
      data: {
        clinicId,
        code,
        documentType: 'CREDIT_NOTE',
        referenceInvoiceId: originalInvoice.id,
        reasonCode: dto.reasonCode,
        visitId: originalInvoice.visitId,
        patientId: originalInvoice.patientId,
        ownerUserId: originalInvoice.ownerUserId,
        subtotalMinor,
        taxRateBps: originalInvoice.taxRateBps,
        taxTotalMinor,
        totalMinor,
        status: 'PAID',
        issuedAt: new Date(),
        paidAt: new Date(),
        lineItems: {
          create: cnLineItems,
        },
      },
      include: { lineItems: true },
    });

    this.postCreditNoteJournal(clinicId, creditNote, originalInvoice, dto.reason, totalMinor);
    return creditNote;
  }

  /**
   * Create a Debit Note for additional charges on a PAID invoice in a CLOSED period.
   * DN amounts are positive (unlike CN which are negative).
   */
  async createDebitNote(clinicId: string, invoiceId: string, dto: CreateDebitNoteDto) {
    const originalInvoice = await this.findById(clinicId, invoiceId);

    if (originalInvoice.status !== 'PAID') {
      throw new BadRequestException('Debit Note can only be issued for PAID invoices');
    }

    if (originalInvoice.documentType !== 'INVOICE') {
      throw new BadRequestException('Debit Note can only be issued against an INVOICE');
    }

    const taxRateBps = originalInvoice.taxRateBps || 0;
    // Back-calculate subtotal from the total additional amount
    const subtotalMinor = taxRateBps > 0
      ? Math.round(dto.additionalAmountMinor / (1 + taxRateBps / 10000))
      : dto.additionalAmountMinor;
    const taxTotalMinor = dto.additionalAmountMinor - subtotalMinor;
    const totalMinor = subtotalMinor + taxTotalMinor;

    let code: string | undefined;
    try {
      code = await this.sequenceService.generate(clinicId, DOC_TYPE.DEBIT_NOTE);
    } catch (e) {
      code = `DN-${Date.now()}`;
    }

    const db = scopedPrisma(this.prisma, clinicId);

    const dnLineItems = dto.lineItems && dto.lineItems.length > 0
      ? dto.lineItems.map((item) => {
          const subtotal = Math.round(Number(item.quantity) * item.unitPriceMinor);
          const taxTotal = Math.round(subtotal * (taxRateBps / 10000));
          return {
            itemType: item.itemType,
            description: `[DN] ${item.description}`,
            quantity: Number(item.quantity),
            unitPriceMinor: item.unitPriceMinor,
            subtotalMinor: subtotal,
            vatRateBps: taxRateBps,
            vatTotalMinor: taxTotal,
            productId: item.productId || item.sourceReferenceId || null,
            sourceReferenceId: item.sourceReferenceId || null,
          };
        })
      : [{
          itemType: 'SERVICE' as const,
          description: `[DN] Additional charge: ${dto.reason}`,
          quantity: 1,
          unitPriceMinor: subtotalMinor,
          subtotalMinor,
          vatRateBps: taxRateBps,
          vatTotalMinor: taxTotalMinor,
          productId: null,
          sourceReferenceId: null,
        }];

    const debitNote = await db.invoice.create({
      data: {
        clinicId,
        code,
        documentType: 'DEBIT_NOTE',
        referenceInvoiceId: originalInvoice.id,
        reasonCode: dto.reasonCode,
        visitId: originalInvoice.visitId,
        patientId: originalInvoice.patientId,
        ownerUserId: originalInvoice.ownerUserId,
        subtotalMinor,
        taxRateBps,
        taxTotalMinor,
        totalMinor,
        status: 'PAID',
        issuedAt: new Date(),
        paidAt: new Date(),
        lineItems: {
          create: dnLineItems,
        },
      },
      include: { lineItems: true },
    });

    // Post GL journal for Debit Note (reverse of CN: debit AR, credit Revenue)
    try {
      if (this.glPostingService) {
        await this.glPostingService.postJournal(clinicId, {
          type: 'GENERAL',
          description: `Debit Note ${debitNote.code || debitNote.id} for Invoice ${
            originalInvoice.code || originalInvoice.id
          }: ${dto.reason}`,
          sourceRefType: 'DEBIT_NOTE',
          sourceRefId: debitNote.id,
          lines: [
            { glAccountId: 'AR-001', debitMinor: totalMinor, creditMinor: 0 },
            { glAccountId: 'REV-001', debitMinor: 0, creditMinor: totalMinor },
          ],
        });
      }
    } catch (err) {
      // Ignore GL posting if GL accounts unconfigured in test environment
    }

    return debitNote;
  }

  /** Post GL journal entry for a Credit Note (fire-and-forget, non-blocking). */
  private postCreditNoteJournal(
    clinicId: string,
    creditNote: { id: string; code?: string | null },
    originalInvoice: { id: string; code?: string | null },
    reason: string,
    totalMinor: number,
  ): void {
    try {
      if (this.glPostingService) {
        this.glPostingService.postJournal(clinicId, {
          type: 'GENERAL',
          description: `Credit Note ${creditNote.code || creditNote.id} for Invoice ${
            originalInvoice.code || originalInvoice.id
          }: ${reason}`,
          sourceRefType: 'CREDIT_NOTE',
          sourceRefId: creditNote.id,
          lines: [
            { glAccountId: 'REV-001', debitMinor: Math.abs(totalMinor), creditMinor: 0 },
            { glAccountId: 'AR-001', debitMinor: 0, creditMinor: Math.abs(totalMinor) },
          ],
        });
      }
    } catch (err) {
      // Ignore GL posting if GL accounts unconfigured in test environment
    }
  }

  async create(clinicId: string, dto: CreateInvoiceDto) {
    const db = scopedPrisma(this.prisma, clinicId);
    const isClinicContext = !!dto.visitId;

    // Generate running sequence code for customer invoice
    let code: string | undefined;
    try {
      code = await this.sequenceService.generate(clinicId, DOC_TYPE.CUSTOMER_INVOICE);
    } catch (e) {
      // Fall back gracefully if sequence generation fails
      code = undefined;
    }

    // ── 1. Expand accessories ────────────────────────────────────────────────
    const expandedLineItems: Array<CreateInvoiceLineItemDto & { expandedFromId?: string }> = [];

    for (const item of dto.lineItems) {
      expandedLineItems.push(item);

      if (item.itemType === 'PRODUCT' && item.sourceReferenceId) {
        const accessories = await this.prisma.productAccessory.findMany({
          where: { parentProductId: item.sourceReferenceId },
          include: {
            childProduct: {
              select: {
                id: true,
                name: true,
                itemType: true,
                baseSellingPrice: true,
              },
            },
          },
        });

        for (const acc of accessories) {
          if (acc.childProduct) {
            expandedLineItems.push({
              itemType: acc.childProduct.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
              description: acc.childProduct.name,
              quantity: Number(item.quantity) * Number(acc.quantityRatio),
              unitPriceMinor: Math.round(Number(acc.childProduct.baseSellingPrice) * 100),
              sourceReferenceId: acc.childProduct.id,
              expandedFromId: item.sourceReferenceId,
            });
          }
        }
      }
    }

    // ── 2. Compliance check + per-line tax resolution ────────────────────────
    const lineItemsWithTax: Array<
      CreateInvoiceLineItemDto & {
        subtotalMinor: number;
        vatRateBps: number;
        vatTotalMinor: number;
      }
    > = [];

    for (const item of expandedLineItems) {
      let vatRateBps = 700; // default fallback
      const isTaxInclusive = false; // product prices are always exclusive in this system

      if (item.itemType === 'PRODUCT' && item.sourceReferenceId) {
        const taxProfile = await this.taxEngine.getProductTaxProfile(item.sourceReferenceId);
        if (taxProfile) {
          const hasOverride = !!dto.overrideApprovedByUserId;

          // Dangerous Drug supervisor override validation (OTC only)
          if (taxProfile.dispensingCategory === 'Dangerous_Drug' && !isClinicContext) {
            if (!dto.overrideApprovedByUserId) {
              throw new BadRequestException(`"${taxProfile.name}" is a Dangerous Drug and requires a supervisor PIN override for OTC sales.`);
            }
            const supervisor = await this.prisma.user.findFirst({
              where: {
                id: dto.overrideApprovedByUserId,
                clinicId,
                role: { in: ['VET', 'CLINIC_OWNER'] },
                status: 'ACTIVE',
              },
            });
            if (!supervisor) {
              throw new BadRequestException('Invalid supervisor ID for Dangerous Drug approval.');
            }
          }

          // Specially Controlled Drug prescription list validation
          if (taxProfile.dispensingCategory === 'Specially_Controlled_Drug') {
            if (!isClinicContext || !dto.visitId) {
              throw new BadRequestException(`"${taxProfile.name}" is a Specially Controlled Drug and cannot be sold at retail (OTC).`);
            }
            const visit = await this.visitService.getOne(clinicId, dto.visitId);
            if (visit.status !== 'finalized' && visit.status !== 'amended') {
              throw new BadRequestException('Associated visit record must be finalized or amended to checkout Specially Controlled Drugs.');
            }
            const prescribed = (visit.prescriptions ?? []).some(
              (p: any) => p.productId === item.sourceReferenceId
            );
            if (!prescribed) {
              throw new BadRequestException(`"${taxProfile.name}" is a Specially Controlled Drug and must be prescribed in the associated visit.`);
            }
          }

          // Clinic Use Only OTC block
          if (taxProfile.dispensingCategory === 'Clinic_Use_Only' && !isClinicContext) {
            throw new BadRequestException(`"${taxProfile.name}" is for Clinic Use Only and cannot be sold at retail (OTC).`);
          }

          // Compliance gate
          this.taxEngine.assertDispensingPermission(taxProfile, isClinicContext, hasOverride);
          // Resolve per-line VAT
          vatRateBps = this.taxEngine.resolveVatRateBps(taxProfile, isClinicContext);
        }
      } else if (item.itemType === 'SERVICE') {
        // Services always attract standard 7% VAT in both contexts
        vatRateBps = 700;
      }

      const { subtotalMinor, vatTotalMinor } = this.taxEngine.computeLineTax(
        item.unitPriceMinor,
        item.quantity,
        vatRateBps,
        isTaxInclusive,
      );

      lineItemsWithTax.push({
        ...item,
        subtotalMinor,
        vatRateBps,
        vatTotalMinor,
      });
    }

    // ── 3. Header totals (summed from line-level) ────────────────────────────
    const subtotalMinor = lineItemsWithTax.reduce((acc, li) => acc + li.subtotalMinor, 0);
    const taxTotalMinor = lineItemsWithTax.reduce((acc, li) => acc + li.vatTotalMinor, 0);
    const totalMinor = subtotalMinor + taxTotalMinor;
    // Header taxRateBps is stored as blended/composite rate for reporting
    const blendedRateBps = subtotalMinor > 0 ? Math.round((taxTotalMinor / subtotalMinor) * 10_000) : 0;

    // ── 4. Persist ───────────────────────────────────────────────────────────
    const invoice = await db.$transaction(async (tx: any) => {
      return tx.invoice.create({
        data: {
          clinicId,
          code: code ?? null,
          visitId: dto.visitId ?? null,
          patientId: dto.patientId ?? null,
          ownerUserId: dto.ownerUserId ?? null,
          subtotalMinor,
          taxRateBps: blendedRateBps,
          taxTotalMinor,
          totalMinor,
          status: 'DRAFT',
          lineItems: {
            create: lineItemsWithTax.map((li) => ({
              itemType: li.itemType,
              description: li.description,
              quantity: li.quantity,
              unitPriceMinor: li.unitPriceMinor,
              subtotalMinor: li.subtotalMinor,
              vatRateBps: li.vatRateBps,
              vatTotalMinor: li.vatTotalMinor,
              sourceReferenceId: li.sourceReferenceId,
              productId: li.productId ?? (li.itemType === 'PRODUCT' ? li.sourceReferenceId : undefined),
            })),
          },
        },
        include: { lineItems: true },
      });
    });

    this.events.emit('invoice.created', new InvoiceCreatedEvent(
      clinicId,
      invoice.id,
      dto.ownerUserId ?? '',
      totalMinor,
    ));

    return invoice;
  }

  async createFromVisitEvent(event: VisitFinalizedEvent) {
    // Auto-create draft invoice with no line items (cashier adds items manually at POS)
    const db = scopedPrisma(this.prisma, event.clinicId);

    // Avoid duplicate invoice for same visit
    const existing = await db.invoice.findFirst({ where: { visitId: event.visitId } });
    if (existing) return existing;

    const invoice = await db.invoice.create({
      data: {
        clinicId: event.clinicId,
        visitId: event.visitId,
        patientId: event.patientId,
        ownerUserId: null,
        subtotalMinor: 0,
        taxRateBps: 700,
        taxTotalMinor: 0,
        totalMinor: 0,
        status: 'DRAFT',
      },
      include: { lineItems: true },
    });

    return invoice;
  }

  async findAll(clinicId: string, status?: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    return db.invoice.findMany({
      where: {
        clinicId,
        ...(status ? { status: status as any } : {}),
      },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(clinicId: string, id: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const invoice = await db.invoice.findFirst({
      where: { id, clinicId },
      include: {
        lineItems: true,
        creditNotes: {
          select: {
            id: true,
            code: true,
            documentType: true,
            totalMinor: true,
            reasonCode: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        referenceInvoice: {
          select: {
            id: true,
            code: true,
            documentType: true,
            totalMinor: true,
            status: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async issue(clinicId: string, id: string) {
    const invoice = await this.findById(clinicId, id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT invoices can be issued');
    }
    const db = scopedPrisma(this.prisma, clinicId);
    return db.invoice.update({
      where: { id },
      data: { status: 'ISSUED', issuedAt: new Date() },
      include: { lineItems: true },
    });
  }

  async markPaid(clinicId: string, id: string) {
    const invoice = await this.findById(clinicId, id);
    if (invoice.status !== 'ISSUED') {
      throw new BadRequestException('Only ISSUED invoices can be marked as paid');
    }
    const db = scopedPrisma(this.prisma, clinicId);
    const paid = await db.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: { lineItems: true },
    });
    this.events.emit('invoice.paid', new InvoicePaidEvent(clinicId, id, paid.paidAt!));
    return paid;
  }

  async voidInvoice(clinicId: string, id: string, actorId: string, reason: string) {
    const invoice = await this.findById(clinicId, id);
    if (invoice.status === 'VOIDED') {
      throw new BadRequestException('Invoice is already voided');
    }
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Paid invoices cannot be voided');
    }
    const db = scopedPrisma(this.prisma, clinicId);
    return db.invoice.update({
      where: { id },
      data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason, voidActorId: actorId },
      include: { lineItems: true },
    });
  }

  async getReport(clinicId: string, fromDate: Date, toDate: Date) {
    const db = scopedPrisma(this.prisma, clinicId);

    const [invoices, paidTotal, outstandingTotal] = await Promise.all([
      db.invoice.findMany({
        where: { clinicId, createdAt: { gte: fromDate, lte: toDate } },
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
      }),
      // Revenue: sum of PAID invoices in range
      db.invoice.aggregate({
        where: { clinicId, status: 'PAID', paidAt: { gte: fromDate, lte: toDate } },
        _sum: { totalMinor: true },
      }),
      // Outstanding: sum of ISSUED invoices (all time — not yet paid)
      db.invoice.aggregate({
        where: { clinicId, status: 'ISSUED' },
        _sum: { totalMinor: true },
      }),
    ]);

    return {
      invoices,
      revenueMinor: paidTotal._sum.totalMinor ?? 0,
      outstandingMinor: outstandingTotal._sum.totalMinor ?? 0,
      periodFrom: fromDate,
      periodTo: toDate,
    };
  }
}
