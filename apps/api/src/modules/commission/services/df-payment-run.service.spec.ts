import { Test, TestingModule } from '@nestjs/testing';
import { DfPaymentRunService } from './df-payment-run.service';
import { WHTCertificateService } from './wht-certificate.service';
import { PrismaClient, DfPaymentRunStatus, DfTransactionStatus, EmploymentType } from '@prisma/client';
import { BadRequestException, ConflictException, UnprocessableEntityException } from '@nestjs/common';

describe('DfPaymentRunService & WHTCertificateService', () => {
  let service: DfPaymentRunService;
  let whtService: WHTCertificateService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      dfTransaction: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      dfPaymentRun: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      bpVet: {
        findUnique: jest.fn(),
      },
      businessPartner: {
        findUnique: jest.fn(),
      },
      clinic: {
        findUnique: jest.fn(),
      },
      wHTCertificate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DfPaymentRunService,
        WHTCertificateService,
        { provide: PrismaClient, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<DfPaymentRunService>(DfPaymentRunService);
    whtService = module.get<WHTCertificateService>(WHTCertificateService);
  });

  it('throws BadRequestException when no confirmed transactions exist for draft run', async () => {
    prismaMock.dfTransaction.findMany.mockResolvedValue([]);

    await expect(
      service.createDraftRun('clinic-1', 'user-1', {
        businessPartnerId: 'bp-1',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates DRAFT payment run summing eligible confirmed transactions', async () => {
    prismaMock.dfTransaction.findMany.mockResolvedValue([
      { id: 'tx-1', dfAmountMinor: 10000, whtAmountMinor: 300, netPayableMinor: 9700 },
      { id: 'tx-2', dfAmountMinor: 20000, whtAmountMinor: 600, netPayableMinor: 19400 },
    ]);
    prismaMock.dfPaymentRun.count.mockResolvedValue(0);
    prismaMock.dfPaymentRun.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'run-1', ...data }),
    );

    const result = await service.createDraftRun('clinic-1', 'user-1', {
      businessPartnerId: 'bp-1',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });

    expect(result.totalDfMinor).toBe(30000);
    expect(result.totalWhtMinor).toBe(900);
    expect(result.totalNetMinor).toBe(29100);
    expect(result.status).toBe(DfPaymentRunStatus.DRAFT);
  });

  it('rejects approval if freelance BP lacks taxId', async () => {
    prismaMock.dfPaymentRun.findFirst.mockResolvedValue({
      id: 'run-1',
      clinicId: 'clinic-1',
      businessPartnerId: 'bp-1',
      status: DfPaymentRunStatus.DRAFT,
    });
    prismaMock.bpVet.findUnique.mockResolvedValue({
      bpId: 'bp-1',
      employmentType: EmploymentType.FREELANCE,
    });
    prismaMock.businessPartner.findUnique.mockResolvedValue({
      id: 'bp-1',
      taxId: null, // missing Tax ID
    });

    await expect(
      service.approveRun('clinic-1', 'user-1', 'run-1'),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('exports P.N.D.3 CSV with correct headers and formatting', async () => {
    prismaMock.wHTCertificate.findMany.mockResolvedValue([
      {
        payeeTaxId: '1234567890123',
        payeeName: 'Dr. Somchai',
        payeeAddress: 'Bangkok',
        issuedAt: new Date('2026-07-25'),
        incomeType: 'ค่าบริการ',
        totalIncomeMinor: 100000,
        whtAmountMinor: 3000,
      },
    ]);

    const csv = await whtService.exportPnd3Csv('clinic-1', 2569, 7);
    expect(csv).toContain('Seq,PayeeTaxId,PayeeName');
    expect(csv).toContain('="1234567890123"');
    expect(csv).toContain('"Dr. Somchai"');
    expect(csv).toContain('1000.00'); // 100000 / 100
    expect(csv).toContain('30.00'); // 3000 / 100
  });
});
