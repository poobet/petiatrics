import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClient, DfPaymentRunStatus, DfTransactionStatus, EmploymentType } from '@prisma/client';
import { CreatePaymentRunDto } from '../dto/create-payment-run.dto';
import { PayPaymentRunDto } from '../dto/pay-payment-run.dto';
import { WHTCertificateService } from './wht-certificate.service';

@Injectable()
export class DfPaymentRunService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly whtService: WHTCertificateService,
  ) {}

  async createDraftRun(clinicId: string, createdById: string, dto: CreatePaymentRunDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    const eligibleTransactions = await this.prisma.dfTransaction.findMany({
      where: {
        clinicId,
        businessPartnerId: dto.businessPartnerId,
        status: DfTransactionStatus.CONFIRMED,
        accruedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    if (eligibleTransactions.length === 0) {
      throw new BadRequestException(
        `No confirmed doctor fee transactions found for this Business Partner in the selected period`,
      );
    }

    let totalDfMinor = 0;
    let totalWhtMinor = 0;
    let totalNetMinor = 0;

    for (const tx of eligibleTransactions) {
      totalDfMinor += tx.dfAmountMinor;
      totalWhtMinor += tx.whtAmountMinor;
      totalNetMinor += tx.netPayableMinor;
    }

    if (totalNetMinor < 0) {
      throw new BadRequestException(
        `Cannot create payment run with negative net total amount (฿${(totalNetMinor / 100).toFixed(2)})`,
      );
    }

    const count = await this.prisma.dfPaymentRun.count({ where: { clinicId } });
    const code = `DFP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.dfPaymentRun.create({
      data: {
        clinicId,
        code,
        businessPartnerId: dto.businessPartnerId,
        periodStart,
        periodEnd,
        totalDfMinor,
        totalWhtMinor,
        totalNetMinor,
        status: DfPaymentRunStatus.DRAFT,
        createdById,
        allocations: {
          create: eligibleTransactions.map((tx) => ({
            dfTransactionId: tx.id,
            amountMinor: tx.netPayableMinor,
          })),
        },
      },
      include: {
        allocations: true,
      },
    });
  }

  async findAll(clinicId: string, bpId?: string, status?: DfPaymentRunStatus) {
    return this.prisma.dfPaymentRun.findMany({
      where: {
        clinicId,
        businessPartnerId: bpId ? bpId : undefined,
        status: status ? status : undefined,
      },
      include: {
        allocations: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(clinicId: string, id: string) {
    const run = await this.prisma.dfPaymentRun.findFirst({
      where: { id, clinicId },
      include: {
        allocations: true,
      },
    });
    if (!run) {
      throw new NotFoundException(`Payment run "${id}" not found`);
    }
    return run;
  }

  async approveRun(clinicId: string, approvedById: string, id: string) {
    const run = await this.findOne(clinicId, id);

    if (run.status !== DfPaymentRunStatus.DRAFT) {
      throw new ConflictException(`Only DRAFT payment runs can be approved`);
    }

    const bpVet = await this.prisma.bpVet.findUnique({
      where: { bpId: run.businessPartnerId },
    });

    if (bpVet?.employmentType === EmploymentType.FREELANCE) {
      const bp = await this.prisma.businessPartner.findUnique({
        where: { id: run.businessPartnerId },
      });
      if (!bp?.taxId) {
        throw new UnprocessableEntityException(
          `Freelance partner "${bp?.name || run.businessPartnerId}" must have a Tax ID specified before approving payment run`,
        );
      }
    }

    return this.prisma.dfPaymentRun.update({
      where: { id },
      data: {
        status: DfPaymentRunStatus.APPROVED,
        approvedById,
        approvedAt: new Date(),
      },
    });
  }

  async payRun(clinicId: string, actorId: string, id: string, dto: PayPaymentRunDto) {
    const run = await this.findOne(clinicId, id);

    if (run.status !== DfPaymentRunStatus.APPROVED) {
      throw new ConflictException(`Only APPROVED payment runs can be marked as paid`);
    }

    const paidAt = new Date();

    const updatedRun = await this.prisma.$transaction(async (tx) => {
      const paidRun = await tx.dfPaymentRun.update({
        where: { id },
        data: {
          status: DfPaymentRunStatus.PAID,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          paidAt,
        },
      });

      const txIds = run.allocations.map((a) => a.dfTransactionId);

      await tx.dfTransaction.updateMany({
        where: { id: { in: txIds } },
        data: {
          status: DfTransactionStatus.SETTLED,
          settledAt: paidAt,
        },
      });

      return paidRun;
    });

    await this.whtService.generateCertificate(clinicId, id);

    return updatedRun;
  }

  async cancelRun(clinicId: string, id: string) {
    const run = await this.findOne(clinicId, id);

    if (run.status === DfPaymentRunStatus.PAID) {
      throw new ConflictException(`PAID payment runs cannot be cancelled`);
    }

    return this.prisma.dfPaymentRun.update({
      where: { id },
      data: {
        status: DfPaymentRunStatus.CANCELLED,
      },
    });
  }
}
