import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerDepositService } from './customer-deposit.service';

describe('CustomerDepositService', () => {
  let service: CustomerDepositService;

  beforeEach(() => {
    service = new CustomerDepositService({} as any, { emit: jest.fn() } as any);
  });

  it('should reject deduction if balance is insufficient', () => {
    expect(() =>
      service.assertSufficientBalance(5000, 10000),
    ).toThrow(BadRequestException);
  });

  it('should allow deduction if balance is sufficient', () => {
    expect(() =>
      service.assertSufficientBalance(15000, 10000),
    ).not.toThrow();
  });
});
