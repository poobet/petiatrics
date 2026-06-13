import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { InvoiceCreatedEvent, InvoicePaidEvent, VisitFinalizedEvent } from '../../../common/events/domain-events';
import { TaxEngineService } from './tax-engine.service';

export interface CreateInvoiceLineItemDto {
  itemType: 'SERVICE' | 'PRODUCT';
  description: string;
  quantity: number;
  unitPriceMinor: number;
  /** Product ID — required for PRODUCT type lines to resolve VAT and dispensing compliance. */
  sourceReferenceId?: string;
}

export interface CreateInvoiceDto {
  /** MongoDB VisitRecord._id. If absent → OTC/Retail context. */
  visitId?: string | null;
  /** MongoDB PetProfile._id. Optional for OTC. */
  patientId?: string | null;
  /** Owner user ID. Optional for OTC. */
  ownerUserId?: string | null;
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
  ) {}

  async create(clinicId: string, dto: CreateInvoiceDto) {
    const db = scopedPrisma(this.prisma, clinicId);
    const isClinicContext = !!dto.visitId;

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
          // Compliance gate — throws BadRequestException if blocked
          this.taxEngine.assertDispensingPermission(taxProfile, isClinicContext);
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
    const invoice = await db.invoice.findFirst({ where: { id, clinicId }, include: { lineItems: true } });
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
