import { Test, TestingModule } from '@nestjs/testing';
import { DfTransactionService } from './df-transaction.service';
import { PrismaClient, DfTransactionStatus, CommissionType } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

describe('DfTransactionService', () => {
  let service: DfTransactionService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      dfTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DfTransactionService,
        { provide: PrismaClient, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<DfTransactionService>(DfTransactionService);
  });

  it('skifies creation if idempotency key exists', async () => {
    prismaMock.dfTransaction.findUnique.mockResolvedValue({
      id: 'tx-existing',
      idempotencyKey: 'idemp-1',
    });

    const result = await service.createAccrualTransaction({
      clinicId: 'clinic-1',
      branchId: 'branch-1',
      businessPartnerId: 'bp-1',
      revenueAmountMinor: 10000,
      commissionType: CommissionType.PERCENTAGE,
      commissionRate: 30,
      dfAmountMinor: 3000,
      whtRate: 3,
      whtAmountMinor: 90,
      netPayableMinor: 2910,
      idempotencyKey: 'idemp-1',
    });

    expect(result.id).toBe('tx-existing');
    expect(prismaMock.dfTransaction.create).not.toHaveBeenCalled();
  });

  it('confirms transactions by invoiceId', async () => {
    prismaMock.dfTransaction.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.confirmByInvoiceId('clinic-1', 'inv-1');
    expect(result.count).toBe(2);
    expect(prismaMock.dfTransaction.updateMany).toHaveBeenCalledWith({
      where: {
        clinicId: 'clinic-1',
        invoiceId: 'inv-1',
        status: DfTransactionStatus.ACCRUED,
      },
      data: expect.objectContaining({
        status: DfTransactionStatus.CONFIRMED,
      }),
    });
  });

  it('throws ConflictException on voiding if any transaction is SETTLED', async () => {
    prismaMock.dfTransaction.findFirst.mockResolvedValue({
      id: 'tx-settled',
      status: DfTransactionStatus.SETTLED,
    });

    await expect(
      service.voidByInvoiceId('clinic-1', 'inv-1', 'User voided'),
    ).rejects.toThrow(ConflictException);
  });

  it('voids ACCRUED and CONFIRMED transactions when none are settled', async () => {
    prismaMock.dfTransaction.findFirst.mockResolvedValue(null);
    prismaMock.dfTransaction.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.voidByInvoiceId('clinic-1', 'inv-1', 'Void reason');
    expect(result.count).toBe(3);
  });
});
