import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentMethodType, PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

export interface CreatePaymentTenderDto {
  method: PaymentMethodType;
  amountMinor: number;
  referenceNo?: string;
}

export interface CreatePaymentDto {
  invoiceId: string;
  cashierUserId: string;
  totalMinor: number;
  tenders: CreatePaymentTenderDto[];
  note?: string;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  validateTenders(totalMinor: number, tenders: CreatePaymentTenderDto[]): void {
    const sum = tenders.reduce((acc, t) => acc + t.amountMinor, 0);
    if (sum !== totalMinor) {
      throw new BadRequestException(
        `Sum of payment tenders (${sum}) must equal invoice total (${totalMinor}).`,
      );
    }
  }

  async processPayment(clinicId: string | undefined, dto: CreatePaymentDto) {
    this.validateTenders(dto.totalMinor, dto.tenders);

    const targetInvoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
    if (!targetInvoice) throw new NotFoundException('Invoice not found');
    if (targetInvoice.status === 'PAID') throw new BadRequestException('Invoice is already paid');

    const activeClinicId = clinicId || targetInvoice.clinicId;
    const db = scopedPrisma(this.prisma, activeClinicId);

    const payment = await db.payment.create({
      data: {
        clinicId: activeClinicId,
        invoiceId: dto.invoiceId,
        documentNo: `REC-${Date.now()}`,
        totalMinor: dto.totalMinor,
        status: 'COMPLETED',
        cashierUserId: dto.cashierUserId,
        note: dto.note,
        tenders: {
          create: dto.tenders.map((t) => ({
            method: t.method,
            amountMinor: t.amountMinor,
            referenceNo: t.referenceNo,
          })),
        },
      },
      include: { tenders: true },
    });

    // Mark invoice as paid
    await db.invoice.update({
      where: { id: dto.invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    this.events.emit('payment.received', {
      clinicId: activeClinicId,
      paymentId: payment.id,
      invoiceId: dto.invoiceId,
      totalMinor: dto.totalMinor,
      tenders: dto.tenders,
      ownerUserId: targetInvoice.ownerUserId,
    });

    return payment;
  }
}
