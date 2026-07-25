import { Test, TestingModule } from '@nestjs/testing';
import { CashierSessionService } from './cashier-session.service';

describe('CashierSessionService', () => {
  let service: CashierSessionService;

  beforeEach(() => {
    service = new CashierSessionService({} as any);
  });

  it('should correctly calculate discrepancy math', () => {
    const diff = service.calculateDiscrepancy(20000, 100000, 118000);
    // opening 200 + system 1000 = 1200 expected. actual 1180 -> diff = -20 (i.e. -2000 satang)
    expect(diff).toBe(-2000);
  });
});
