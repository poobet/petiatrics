import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient, EmploymentType, DfDiscountBasis } from '@prisma/client';
import { VisitFinalizedEvent } from '../../../common/events/domain-events';
import { CommissionRuleService } from '../services/commission-rule.service';
import { DfCalculationService } from '../services/df-calculation.service';
import { DfTransactionService } from '../services/df-transaction.service';

@Injectable()
export class DfAccrualListener {
  private readonly logger = new Logger(DfAccrualListener.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly ruleService: CommissionRuleService,
    private readonly calcService: DfCalculationService,
    private readonly txService: DfTransactionService,
  ) {}

  @OnEvent('visit.finalized', { async: true })
  async handle(event: VisitFinalizedEvent) {
    try {
      const vetId = event.vetId;
      if (!vetId) return;

      const bpVet = await this.prisma.bpVet.findUnique({
        where: { bpId: vetId },
      });

      const employmentType = bpVet?.employmentType ?? EmploymentType.FREELANCE;
      const dfDiscountBasis = bpVet?.dfDiscountBasis ?? DfDiscountBasis.AFTER_DISCOUNT;

      for (let i = 0; i < event.productIds.length; i++) {
        const productId = event.productIds[i];

        const rule = await this.ruleService.resolveRule(
          event.clinicId,
          vetId,
          productId,
        );

        if (!rule) {
          this.logger.debug(
            `No commission rule resolved for BP ${vetId} on product ${productId}`,
          );
          continue;
        }

        const product = await this.prisma.product.findUnique({
          where: { id: productId },
        });

        if (!product) continue;

        const grossAmountMinor = Math.round(Number(product.baseSellingPrice) * 100);

        const calc = this.calcService.calculateLineItemDf({
          grossAmountMinor,
          discountAmountMinor: 0,
          quantity: 1,
          commissionType: rule.commissionType,
          rate: rule.rate,
          employmentType,
          dfDiscountBasis,
        });

        await this.txService.createAccrualTransaction({
          clinicId: event.clinicId,
          branchId: event.branchId,
          businessPartnerId: vetId,
          visitId: event.visitId,
          productId,
          revenueAmountMinor: calc.revenueAmountMinor,
          commissionType: rule.commissionType,
          commissionRate: rule.rate,
          dfAmountMinor: calc.dfAmountMinor,
          whtRate: calc.whtRate,
          whtAmountMinor: calc.whtAmountMinor,
          netPayableMinor: calc.netPayableMinor,
          idempotencyKey: `${event.visitId}:${productId}:${vetId}:${i}`,
        });
      }

      this.logger.log(
        `Accrued DF transactions for visit ${event.visitId} (clinic ${event.clinicId})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to accrue DF for visit ${event.visitId}: ${(err as Error).message}`,
      );
    }
  }
}
