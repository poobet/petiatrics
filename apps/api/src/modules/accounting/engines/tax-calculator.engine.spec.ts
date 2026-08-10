import { TaxCalculatorEngine } from './tax-calculator.engine';

describe('TaxCalculatorEngine', () => {
  let engine: TaxCalculatorEngine;

  beforeEach(() => {
    engine = new TaxCalculatorEngine();
  });

  it('should calculate 7% VAT inclusive base and tax for 100.00 THB (10000 Satang)', () => {
    const result = engine.calculateVatInclusive(10000, 7);
    expect(result.baseAmountMinor).toBe(9346); // 93.46 THB
    expect(result.vatAmountMinor).toBe(654);   // 6.54 THB
    expect(result.baseAmountMinor + result.vatAmountMinor).toBe(10000);
  });

  it('should return 0 tax and full base for NON-VAT / EXEMPT items', () => {
    const result = engine.calculateVatInclusive(10000, 0);
    expect(result.baseAmountMinor).toBe(10000);
    expect(result.vatAmountMinor).toBe(0);
    expect(result.baseAmountMinor + result.vatAmountMinor).toBe(10000);
  });

  it('should handle fractional satang half-up rounding correctly', () => {
    // 50.00 THB = 5000 Satang at 7% VAT
    // 5000 * 100 / 107 = 4672.897... -> 4673 Satang (46.73 THB)
    // VAT = 5000 - 4673 = 327 Satang (3.27 THB)
    const result = engine.calculateVatInclusive(5000, 7);
    expect(result.baseAmountMinor).toBe(4673);
    expect(result.vatAmountMinor).toBe(327);
    expect(result.baseAmountMinor + result.vatAmountMinor).toBe(5000);
  });
});
