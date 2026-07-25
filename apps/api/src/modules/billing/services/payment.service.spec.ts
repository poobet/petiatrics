import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaClient, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should validate that tender amounts sum up to totalMinor', () => {
    expect(() =>
      service.validateTenders(10000, [
        { method: 'CASH' as any, amountMinor: 5000 },
        { method: 'CREDIT_CARD' as any, amountMinor: 4000 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('should pass when tender amounts match totalMinor', () => {
    expect(() =>
      service.validateTenders(10000, [
        { method: 'CASH' as any, amountMinor: 5000 },
        { method: 'CREDIT_CARD' as any, amountMinor: 5000 },
      ]),
    ).not.toThrow();
  });
});
