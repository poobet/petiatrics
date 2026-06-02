import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { InvoiceCreatedEvent, InvoicePaidEvent, VisitFinalizedEvent } from '../../../common/events/domain-events';

export interface CreateInvoiceDto {
  visitId: string;
  patientId: string;
  ownerUserId: string;
  lineItems: Array<{
    itemType: 'SERVICE' | 'PRODUCT';
    description: string;
    quantity: number;
    unitPriceMinor: number;
    sourceReferenceId?: string;
  }>;
  taxRateBps?: number; // basis points, default 700 = 7%
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  async create(clinicId: string, dto: CreateInvoiceDto) {
    const db = scopedPrisma(this.prisma, clinicId);
    const taxRateBps = dto.taxRateBps ?? 700;

    const lineItemsWithTotals = dto.lineItems.map((item) => {
      const subtotalMinor = Math.round(item.quantity * item.unitPriceMinor);
      return { ...item, subtotalMinor };
    });

    const subtotalMinor = lineItemsWithTotals.reduce((acc, li) => acc + li.subtotalMinor, 0);
    const taxTotalMinor = Math.round(subtotalMinor * taxRateBps / 10_000);
    const totalMinor = subtotalMinor + taxTotalMinor;

    const invoice = await db.$transaction(async (tx: any) => {
      return tx.invoice.create({
        data: {
          clinicId,
          visitId: dto.visitId,
          patientId: dto.patientId,
          ownerUserId: dto.ownerUserId,
          subtotalMinor,
          taxRateBps,
          taxTotalMinor,
          totalMinor,
          status: 'DRAFT',
          lineItems: {
            create: lineItemsWithTotals.map((li) => ({
              itemType: li.itemType,
              description: li.description,
              quantity: li.quantity,
              unitPriceMinor: li.unitPriceMinor,
              subtotalMinor: li.subtotalMinor,
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
      dto.ownerUserId,
      totalMinor,
    ));

    return invoice;
  }

  async createFromVisitEvent(event: VisitFinalizedEvent) {
    // Auto-create draft invoice with no line items (cashier adds items manually)
    const db = scopedPrisma(this.prisma, event.clinicId);

    // Avoid duplicate invoice for same visit
    const existing = await db.invoice.findFirst({ where: { visitId: event.visitId } });
    if (existing) return existing;

    const invoice = await db.invoice.create({
      data: {
        clinicId: event.clinicId,
        visitId: event.visitId,
        patientId: event.patientId,
        ownerUserId: '',
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
