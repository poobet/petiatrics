import { Injectable } from '@nestjs/common';
import { CommissionType, EmploymentType, DfDiscountBasis } from '@prisma/client';

export interface CalculationInput {
  grossAmountMinor: number;
  discountAmountMinor: number;
  quantity: number;
  commissionType: CommissionType;
  rate: number; // percentage or flat rate minor units
  employmentType: EmploymentType;
  dfDiscountBasis: DfDiscountBasis;
}

export interface CalculationOutput {
  revenueAmountMinor: number;
  dfAmountMinor: number;
  whtRate: number;
  whtAmountMinor: number;
  netPayableMinor: number;
}

@Injectable()
export class DfCalculationService {
  calculateLineItemDf(input: CalculationInput): CalculationOutput {
    const revenueAmountMinor =
      input.dfDiscountBasis === DfDiscountBasis.BEFORE_DISCOUNT
        ? input.grossAmountMinor
        : Math.max(0, input.grossAmountMinor - input.discountAmountMinor);

    let dfAmountMinor = 0;

    if (input.commissionType === CommissionType.PERCENTAGE) {
      dfAmountMinor = Math.round((revenueAmountMinor * input.rate) / 100);
    } else {
      dfAmountMinor = Math.round(input.rate * input.quantity);
    }

    const whtRate = input.employmentType === EmploymentType.FREELANCE ? 3.0 : 0;
    const whtAmountMinor = Math.round((dfAmountMinor * whtRate) / 100);
    const netPayableMinor = dfAmountMinor - whtAmountMinor;

    return {
      revenueAmountMinor,
      dfAmountMinor,
      whtRate,
      whtAmountMinor,
      netPayableMinor,
    };
  }
}
