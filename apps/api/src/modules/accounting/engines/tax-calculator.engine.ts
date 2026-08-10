import { Injectable } from '@nestjs/common';

export interface TaxCalculationResult {
  totalPriceMinor: number;
  baseAmountMinor: number;
  vatAmountMinor: number;
  vatRate: number;
}

@Injectable()
export class TaxCalculatorEngine {
  calculateVatInclusive(totalPriceMinor: number, vatRate: number): TaxCalculationResult {
    if (vatRate === 0) {
      return {
        totalPriceMinor,
        baseAmountMinor: totalPriceMinor,
        vatAmountMinor: 0,
        vatRate: 0,
      };
    }

    const baseAmountMinor = Math.round((totalPriceMinor * 100) / (100 + vatRate));
    const vatAmountMinor = totalPriceMinor - baseAmountMinor;

    return {
      totalPriceMinor,
      baseAmountMinor,
      vatAmountMinor,
      vatRate,
    };
  }
}
