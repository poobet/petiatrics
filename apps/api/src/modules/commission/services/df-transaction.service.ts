import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, DfTransactionStatus, CommissionType } from '@prisma/client';
import { DfQueryDto } from '../dto/df-query.dto';

export interface CreateAccrualInput {
  clinicId: string;
  branchId: string;
  businessPartnerId: string;
  visitId?: string;
  invoiceId?: string;
  invoiceLineItemId?: string;
  productId?: string;
  revenueAmountMinor: number;
  commissionType: CommissionType;
  commissionRate: number;
  dfAmountMinor: number;
  whtRate: number;
  whtAmountMinor: number;
  netPayableMinor: number;
  idempotencyKey?: string;
}

@Injectable()
export class DfTransactionService {
  constructor(private readonly prisma: PrismaClient) {}

  async findLedger(clinicId: string, dto: DfQueryDto) {
    const where: any = { clinicId };

    if (dto.businessPartnerId) where.businessPartnerId = dto.businessPartnerId;
    if (dto.status) where.status = dto.status;
    if (dto.branchId) where.branchId = dto.branchId;
    if (dto.visitId) where.visitId = dto.visitId;
    if (dto.invoiceId) where.invoiceId = dto.invoiceId;

    if (dto.from || dto.to) {
      where.accruedAt = {};
      if (dto.from) where.accruedAt.gte = new Date(dto.from);
      if (dto.to) where.accruedAt.lte = new Date(dto.to);
    }

    return this.prisma.dfTransaction.findMany({
      where,
      orderBy: { accruedAt: 'desc' },
    });
  }

  async getSummary(clinicId: string, dto: DfQueryDto) {
    const transactions = await this.findLedger(clinicId, dto);

    const summaryMap = new Map<
      string,
      {
        businessPartnerId: string;
        totalAccruedMinor: number;
        totalConfirmedMinor: number;
        totalSettledMinor: number;
        totalWhtMinor: number;
        totalNetPayableMinor: number;
        transactionCount: number;
      }
    >();

    for (const tx of transactions) {
      if (tx.status === DfTransactionStatus.VOIDED) continue;

      let entry = summaryMap.get(tx.businessPartnerId);
      if (!entry) {
        entry = {
          businessPartnerId: tx.businessPartnerId,
          totalAccruedMinor: 0,
          totalConfirmedMinor: 0,
          totalSettledMinor: 0,
          totalWhtMinor: 0,
          totalNetPayableMinor: 0,
          transactionCount: 0,
        };
        summaryMap.set(tx.businessPartnerId, entry);
      }

      entry.transactionCount += 1;
      entry.totalWhtMinor += tx.whtAmountMinor;
      entry.totalNetPayableMinor += tx.netPayableMinor;

      if (tx.status === DfTransactionStatus.ACCRUED) {
        entry.totalAccruedMinor += tx.dfAmountMinor;
      } else if (tx.status === DfTransactionStatus.CONFIRMED) {
        entry.totalConfirmedMinor += tx.dfAmountMinor;
      } else if (tx.status === DfTransactionStatus.SETTLED) {
        entry.totalSettledMinor += tx.dfAmountMinor;
      }
    }

    return Array.from(summaryMap.values());
  }

  async createAccrualTransaction(data: CreateAccrualInput) {
    if (data.idempotencyKey) {
      const existing = await this.prisma.dfTransaction.findUnique({
        where: {
          clinicId_idempotencyKey: {
            clinicId: data.clinicId,
            idempotencyKey: data.idempotencyKey,
          },
        },
      });
      if (existing) {
        return existing; // Idempotent duplicate skip
      }
    }

    return this.prisma.dfTransaction.create({
      data: {
        clinicId: data.clinicId,
        branchId: data.branchId,
        businessPartnerId: data.businessPartnerId,
        visitId: data.visitId,
        invoiceId: data.invoiceId,
        invoiceLineItemId: data.invoiceLineItemId,
        productId: data.productId,
        revenueAmountMinor: data.revenueAmountMinor,
        commissionType: data.commissionType,
        commissionRate: data.commissionRate,
        dfAmountMinor: data.dfAmountMinor,
        whtRate: data.whtRate,
        whtAmountMinor: data.whtAmountMinor,
        netPayableMinor: data.netPayableMinor,
        status: DfTransactionStatus.ACCRUED,
        idempotencyKey: data.idempotencyKey,
      },
    });
  }

  async confirmByInvoiceId(clinicId: string, invoiceId: string) {
    return this.prisma.dfTransaction.updateMany({
      where: {
        clinicId,
        invoiceId,
        status: DfTransactionStatus.ACCRUED,
      },
      data: {
        status: DfTransactionStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });
  }

  async backfillInvoiceId(clinicId: string, visitId: string, invoiceId: string) {
    return this.prisma.dfTransaction.updateMany({
      where: {
        clinicId,
        visitId,
        invoiceId: null,
      },
      data: {
        invoiceId,
      },
    });
  }

  async voidByInvoiceId(clinicId: string, invoiceId: string, voidReason: string) {
    const settled = await this.prisma.dfTransaction.findFirst({
      where: {
        clinicId,
        invoiceId,
        status: DfTransactionStatus.SETTLED,
      },
    });

    if (settled) {
      throw new ConflictException(
        `Cannot void invoice "${invoiceId}" because associated doctor fee transactions have already been settled in a payment run.`,
      );
    }

    return this.prisma.dfTransaction.updateMany({
      where: {
        clinicId,
        invoiceId,
        status: { in: [DfTransactionStatus.ACCRUED, DfTransactionStatus.CONFIRMED] },
      },
      data: {
        status: DfTransactionStatus.VOIDED,
        voidedAt: new Date(),
        voidReason,
      },
    });
  }
}
