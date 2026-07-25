import { DfCalculationService } from './df-calculation.service';
import { CommissionType, EmploymentType, DfDiscountBasis } from '@prisma/client';

describe('DfCalculationService', () => {
  let service: DfCalculationService;

  beforeEach(() => {
    service = new DfCalculationService();
  });

  it('calculates percentage commission after discount for freelance vet', () => {
    const result = service.calculateLineItemDf({
      grossAmountMinor: 100000, // ฿1,000
      discountAmountMinor: 10000, // ฿100 discount (net ฿900)
      quantity: 1,
      commissionType: CommissionType.PERCENTAGE,
      rate: 30.0, // 30%
      employmentType: EmploymentType.FREELANCE,
      dfDiscountBasis: DfDiscountBasis.AFTER_DISCOUNT,
    });

    expect(result.revenueAmountMinor).toBe(90000);
    expect(result.dfAmountMinor).toBe(27000); // 30% of 900
    expect(result.whtRate).toBe(3.0);
    expect(result.whtAmountMinor).toBe(810); // 3% of 270
    expect(result.netPayableMinor).toBe(26190);
  });

  it('calculates percentage commission before discount for employee vet', () => {
    const result = service.calculateLineItemDf({
      grossAmountMinor: 100000,
      discountAmountMinor: 10000,
      quantity: 1,
      commissionType: CommissionType.PERCENTAGE,
      rate: 30.0,
      employmentType: EmploymentType.EMPLOYEE,
      dfDiscountBasis: DfDiscountBasis.BEFORE_DISCOUNT,
    });

    expect(result.revenueAmountMinor).toBe(100000);
    expect(result.dfAmountMinor).toBe(30000);
    expect(result.whtRate).toBe(0);
    expect(result.whtAmountMinor).toBe(0);
    expect(result.netPayableMinor).toBe(30000);
  });

  it('calculates flat rate commission per unit', () => {
    const result = service.calculateLineItemDf({
      grossAmountMinor: 50000,
      discountAmountMinor: 0,
      quantity: 2,
      commissionType: CommissionType.FLAT_RATE,
      rate: 20000, // ฿200 per unit
      employmentType: EmploymentType.FREELANCE,
      dfDiscountBasis: DfDiscountBasis.AFTER_DISCOUNT,
    });

    expect(result.dfAmountMinor).toBe(40000); // 200 * 2
    expect(result.whtAmountMinor).toBe(1200); // 3% of 400
    expect(result.netPayableMinor).toBe(38800);
  });
});
