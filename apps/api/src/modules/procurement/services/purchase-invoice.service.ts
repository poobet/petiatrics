import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, PurchaseInvoiceStatus, InvoiceMatchStatus } from '@prisma/client';
import { CreatePurchaseInvoiceDto } from '../dtos/create-purchase-invoice.dto';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';
import { ThreeWayMatchingService, MatchResult } from './three-way-matching.service';

@Injectable()
export class PurchaseInvoiceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sequenceService: DocumentSequenceService,
    private readonly matchingService: ThreeWayMatchingService,
  ) {}

  async create(clinicId: string, userId: string, branchId: string, dto: CreatePurchaseInvoiceDto) {
    const code = await this.sequenceService.generate(clinicId, DOC_TYPE.PURCHASE_INVOICE, new Date(), branchId);

    let subtotal = 0;
    let taxTotal = 0;

    const linesToCreate = dto.lines.map(line => {
      const lineSubtotal = Math.round(Number(line.quantity) * line.unitPriceMinor);
      const lineTax = Math.round(lineSubtotal * ((line.taxRateBps || 0) / 10000));

      subtotal += lineSubtotal;
      taxTotal += lineTax;

      return {
        poLineId: line.poLineId || null,
        grLineId: line.grLineId || null,
        productId: line.productId,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        subtotalMinor: lineSubtotal,
        taxRateBps: line.taxRateBps || 0,
        taxTotalMinor: lineTax,
        totalMinor: lineSubtotal + lineTax,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          clinicId,
          supplierId: dto.supplierId,
          purchaseOrderId: dto.purchaseOrderId || null,
          invoiceNumber: dto.invoiceNumber,
          code,
          status: PurchaseInvoiceStatus.DRAFT,
          matchStatus: InvoiceMatchStatus.PENDING,
          invoiceDate: new Date(dto.invoiceDate),
          dueDate: new Date(dto.dueDate),
          subtotalMinor: subtotal,
          taxTotalMinor: taxTotal,
          totalMinor: subtotal + taxTotal,
          createdById: userId,
          lines: {
            create: linesToCreate,
          },
        },
        include: {
          lines: {
            include: {
              product: true,
              poLine: true,
              grLine: true,
            },
          },
          supplier: true,
        },
      });

      // Update quantityInvoiced on PO lines if linked
      for (const line of invoice.lines) {
        if (line.poLineId) {
          await tx.purchaseOrderLine.update({
            where: { id: line.poLineId },
            data: {
              quantityInvoiced: { increment: line.quantity },
            },
          });
        }
      }

      return invoice;
    });
  }

  async performMatch(clinicId: string, invoiceId: string): Promise<MatchResult> {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id: invoiceId, clinicId },
    });
    if (!invoice) throw new NotFoundException(`Purchase Invoice ${invoiceId} not found`);
    if (invoice.status !== PurchaseInvoiceStatus.DRAFT) {
      throw new ForbiddenException('Only DRAFT invoices can be matched');
    }

    return this.matchingService.performMatch(clinicId, invoiceId);
  }

  async post(clinicId: string, invoiceId: string) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id: invoiceId, clinicId },
    });
    if (!invoice) throw new NotFoundException(`Purchase Invoice ${invoiceId} not found`);
    if (invoice.status !== PurchaseInvoiceStatus.DRAFT) {
      throw new ForbiddenException('Only DRAFT invoices can be posted');
    }
    if (invoice.matchStatus === InvoiceMatchStatus.EXCEPTION) {
      throw new ForbiddenException('Cannot post an invoice with unresolved matching exceptions');
    }

    return this.prisma.purchaseInvoice.update({
      where: { id: invoiceId },
      data: { status: PurchaseInvoiceStatus.POSTED },
    });
  }

  async void(clinicId: string, invoiceId: string) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id: invoiceId, clinicId },
    });
    if (!invoice) throw new NotFoundException(`Purchase Invoice ${invoiceId} not found`);
    if (invoice.status === PurchaseInvoiceStatus.PAID) {
      throw new ForbiddenException('Cannot void a fully paid invoice');
    }

    return this.prisma.purchaseInvoice.update({
      where: { id: invoiceId },
      data: { status: PurchaseInvoiceStatus.VOIDED },
    });
  }

  async findOne(clinicId: string, id: string) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id, clinicId },
      include: {
        lines: {
          include: {
            product: true,
            poLine: true,
            grLine: true,
          },
        },
        supplier: true,
        purchaseOrder: { select: { code: true } },
        createdBy: { select: { name: true, email: true } },
        allocations: true,
      },
    });
    if (!invoice) throw new NotFoundException(`Purchase Invoice ${id} not found`);
    return invoice;
  }

  async findAll(clinicId: string, status?: PurchaseInvoiceStatus) {
    return this.prisma.purchaseInvoice.findMany({
      where: {
        clinicId,
        status: status || undefined,
      },
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { code: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
