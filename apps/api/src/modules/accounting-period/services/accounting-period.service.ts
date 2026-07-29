import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateAccountingPeriodDto } from '../dto/create-period.dto';
import { ReopenAccountingPeriodDto } from '../dto/reopen-period.dto';

@Injectable()
export class AccountingPeriodService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(clinicId: string, year?: number) {
    const where: any = { clinicId };
    if (year) {
      where.year = Number(year);
    }
    return this.prisma.accountingPeriod.findMany({
      where,
      include: {
        closedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async create(clinicId: string, dto: CreateAccountingPeriodDto) {
    const existing = await this.prisma.accountingPeriod.findUnique({
      where: {
        clinicId_year_month: {
          clinicId,
          year: dto.year,
          month: dto.month,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Accounting period for ${dto.year}-${String(dto.month).padStart(2, '0')} already exists`,
      );
    }

    const startDate = new Date(Date.UTC(dto.year, dto.month - 1, 1));
    const endDate = new Date(Date.UTC(dto.year, dto.month, 0, 23, 59, 59, 999));

    return this.prisma.accountingPeriod.create({
      data: {
        clinicId,
        branchId: dto.branchId || null,
        year: dto.year,
        month: dto.month,
        startDate,
        endDate,
        status: 'OPEN',
      },
    });
  }

  async closePeriod(clinicId: string, periodId: string, userId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, clinicId },
    });

    if (!period) {
      throw new NotFoundException(`Accounting period "${periodId}" not found`);
    }

    if (period.status === 'CLOSED') {
      throw new BadRequestException(`Accounting period is already CLOSED`);
    }

    // Check for draft invoices in this period
    const draftInvoicesCount = await this.prisma.invoice.count({
      where: {
        clinicId,
        status: 'DRAFT',
        createdAt: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
    });

    if (draftInvoicesCount > 0) {
      throw new ConflictException(
        `Cannot close accounting period: ${draftInvoicesCount} draft invoice(s) exist in this period. Please issue or void them first.`,
      );
    }

    // Check for draft DF payment runs in this period
    const draftPaymentRunsCount = await this.prisma.dfPaymentRun.count({
      where: {
        clinicId,
        status: 'DRAFT',
        createdAt: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
    });

    if (draftPaymentRunsCount > 0) {
      throw new ConflictException(
        `Cannot close accounting period: ${draftPaymentRunsCount} draft payment run(s) exist in this period. Please approve, pay, or cancel them first.`,
      );
    }

    return this.prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: 'CLOSED',
        closedById: userId,
        closedAt: new Date(),
      },
      include: {
        closedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async reopenPeriod(
    clinicId: string,
    periodId: string,
    dto: ReopenAccountingPeriodDto,
  ) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, clinicId },
    });

    if (!period) {
      throw new NotFoundException(`Accounting period "${periodId}" not found`);
    }

    if (period.status !== 'CLOSED') {
      throw new BadRequestException(`Only CLOSED accounting periods can be reopened`);
    }

    return this.prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: 'OPEN',
        closedById: null,
        closedAt: null,
        reopenReason: dto.reason,
      },
    });
  }
}
