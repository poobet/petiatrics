import { Test, TestingModule } from '@nestjs/testing';
import { AccountingPeriodService } from './accounting-period.service';
import { PrismaClient } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('AccountingPeriodService', () => {
  let service: AccountingPeriodService;
  let prisma: PrismaClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingPeriodService,
        {
          provide: PrismaClient,
          useValue: {
            accountingPeriod: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            invoice: {
              count: jest.fn(),
            },
            dfPaymentRun: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AccountingPeriodService>(AccountingPeriodService);
    prisma = module.get<PrismaClient>(PrismaClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an open period if it does not exist', async () => {
      jest.spyOn(prisma.accountingPeriod, 'findUnique').mockResolvedValue(null as any);
      jest.spyOn(prisma.accountingPeriod, 'create').mockResolvedValue({
        id: 'p1',
        clinicId: 'c1',
        year: 2026,
        month: 7,
        status: 'OPEN',
      } as any);

      const result = await service.create('c1', { year: 2026, month: 7 });
      expect(result.status).toBe('OPEN');
    });

    it('should throw ConflictException if period already exists', async () => {
      jest.spyOn(prisma.accountingPeriod, 'findUnique').mockResolvedValue({ id: 'p1' } as any);

      await expect(service.create('c1', { year: 2026, month: 7 })).rejects.toThrow(ConflictException);
    });
  });

  describe('closePeriod', () => {
    it('should close an open period if no draft invoices or draft payment runs exist', async () => {
      jest.spyOn(prisma.accountingPeriod, 'findFirst').mockResolvedValue({
        id: 'p1',
        clinicId: 'c1',
        status: 'OPEN',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
      } as any);

      jest.spyOn(prisma.invoice, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.dfPaymentRun, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.accountingPeriod, 'update').mockResolvedValue({
        id: 'p1',
        status: 'CLOSED',
      } as any);

      const result = await service.closePeriod('c1', 'p1', 'u1');
      expect(result.status).toBe('CLOSED');
    });

    it('should throw ConflictException if draft invoices exist', async () => {
      jest.spyOn(prisma.accountingPeriod, 'findFirst').mockResolvedValue({
        id: 'p1',
        clinicId: 'c1',
        status: 'OPEN',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
      } as any);

      jest.spyOn(prisma.invoice, 'count').mockResolvedValue(2);

      await expect(service.closePeriod('c1', 'p1', 'u1')).rejects.toThrow(ConflictException);
    });
  });

  describe('reopenPeriod', () => {
    it('should reopen a closed period with reason', async () => {
      jest.spyOn(prisma.accountingPeriod, 'findFirst').mockResolvedValue({
        id: 'p1',
        clinicId: 'c1',
        status: 'CLOSED',
      } as any);

      jest.spyOn(prisma.accountingPeriod, 'update').mockResolvedValue({
        id: 'p1',
        status: 'OPEN',
      } as any);

      const result = await service.reopenPeriod('c1', 'p1', { reason: 'Audit correction' });
      expect(result.status).toBe('OPEN');
    });

    it('should throw BadRequestException if period is not closed', async () => {
      jest.spyOn(prisma.accountingPeriod, 'findFirst').mockResolvedValue({
        id: 'p1',
        clinicId: 'c1',
        status: 'OPEN',
      } as any);

      await expect(
        service.reopenPeriod('c1', 'p1', { reason: 'Audit correction' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
