import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GLPostingService } from './gl-posting.service';

describe('GLPostingService', () => {
  let service: GLPostingService;

  beforeEach(() => {
    service = new GLPostingService({} as any);
  });

  it('should throw if debits do not equal credits', () => {
    const lines = [
      { glAccountId: 'acc-1', debitMinor: 1000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 800 },
    ];
    expect(() => service.assertBalancedJournal(lines)).toThrow(BadRequestException);
  });

  it('should pass when debits equal credits', () => {
    const lines = [
      { glAccountId: 'acc-1', debitMinor: 1000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 1000 },
    ];
    expect(() => service.assertBalancedJournal(lines)).not.toThrow();
  });
});
