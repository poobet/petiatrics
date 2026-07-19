import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, PurchaseInvoiceStatus } from '@prisma/client';
import { SupplierPaymentService } from './supplier-payment.service';
import { DocumentSequenceService } from '../../document-sequence/services/document-sequence.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '../dtos/create-supplier-payment.dto';

function buildSequenceServiceMock() {
  return {
    generate: jest.fn().mockImplementation(() => {
      return Promise.resolve('SP2026-0001');
    }),
  };
}

function buildPrismaMock() {
  const payments: any[] = [];
  const allocations: any[] = [];
  const invoices: any[] = [
    {
      id: 'inv-1',
      clinicId: 'clinic-1',
      code: 'PI2026-0001',
      totalMinor: 10000,
      amountPaidMinor: 0,
      status: PurchaseInvoiceStatus.POSTED,
    },
    {
      id: 'inv-2',
      clinicId: 'clinic-1',
      code: 'PI2026-0002',
      totalMinor: 5000,
      amountPaidMinor: 2000,
      status: PurchaseInvoiceStatus.PARTIALLY_PAID,
    },
  ];

  const mock: any = {
    payments,
    allocations,
    invoices,
    supplierPayment: {
      create: jest.fn().mockImplementation(({ data }) => {
        const payment = {
          id: `sp-${payments.length + 1}`,
          ...data,
          allocations: (data.allocations?.create || []).map((a: any, idx: number) => ({
            id: `alloc-${idx}`,
            purchaseInvoiceId: a.purchaseInvoiceId,
            amountAllocatedMinor: a.amountAllocatedMinor,
          })),
        };
        payments.push(payment);
        return Promise.resolve(payment);
      }),
    },
    purchaseInvoice: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const inv = invoices.find((i) => i.id === where.id && i.clinicId === where.clinicId);
        return Promise.resolve(inv || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const inv = invoices.find((i) => i.id === where.id);
        if (inv) {
          if (data.amountPaidMinor?.increment) {
            inv.amountPaidMinor += data.amountPaidMinor.increment;
          }
          if (data.status) {
            inv.status = data.status;
          }
        }
        return Promise.resolve(inv);
      }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mock)),
  };

  return mock;
}

describe('SupplierPaymentService', () => {
  let service: SupplierPaymentService;
  let prismaMock: any;
  let sequenceMock: any;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
    sequenceMock = buildSequenceServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierPaymentService,
        { provide: PrismaClient, useValue: prismaMock as any },
        { provide: DocumentSequenceService, useValue: sequenceMock },
      ],
    }).compile();

    service = module.get<SupplierPaymentService>(SupplierPaymentService);
  });

  it('should successfully create a payment and transition allocated invoice to PAID', async () => {
    const dto = {
      supplierId: 'supplier-1',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountMinor: 10000,
      allocations: [
        {
          purchaseInvoiceId: 'inv-1',
          amountAllocatedMinor: 10000,
        },
      ],
    };

    const payment = await service.create('clinic-1', 'user-1', 'branch-1', dto);
    expect(payment.amountMinor).toBe(10000);
    // e-WHT auto calculation for BANK_TRANSFER should be 1% (100 minor WHT for 10000 amount)
    expect(payment.whtRateBps).toBe(100);
    expect(payment.whtAmountMinor).toBe(100);
    
    // Check that invoice updated to PAID
    const inv = prismaMock.invoices.find((i: any) => i.id === 'inv-1');
    expect(inv.amountPaidMinor).toBe(10000);
    expect(inv.status).toBe(PurchaseInvoiceStatus.PAID);
  });

  it('should transition allocated invoice to PARTIALLY_PAID if not fully paid', async () => {
    const dto = {
      supplierId: 'supplier-1',
      paymentMethod: PaymentMethod.CASH,
      amountMinor: 5000,
      allocations: [
        {
          purchaseInvoiceId: 'inv-1',
          amountAllocatedMinor: 5000,
        },
      ],
    };

    await service.create('clinic-1', 'user-1', 'branch-1', dto);
    const inv = prismaMock.invoices.find((i: any) => i.id === 'inv-1');
    expect(inv.amountPaidMinor).toBe(5000);
    expect(inv.status).toBe(PurchaseInvoiceStatus.PARTIALLY_PAID);
  });

  it('should throw an error if allocation amount exceeds outstanding invoice amount', async () => {
    const dto = {
      supplierId: 'supplier-1',
      paymentMethod: PaymentMethod.CASH,
      amountMinor: 5000,
      allocations: [
        {
          purchaseInvoiceId: 'inv-2', // Outstanding is 3000 (5000 total - 2000 paid)
          amountAllocatedMinor: 4000, // Exceeds outstanding!
        },
      ],
    };

    await expect(service.create('clinic-1', 'user-1', 'branch-1', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should support manual WHT rate and amount override', async () => {
    const dto = {
      supplierId: 'supplier-1',
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountMinor: 10000,
      whtRateBps: 300, // 3%
      whtAmountMinor: 300,
      allocations: [
        {
          purchaseInvoiceId: 'inv-1',
          amountAllocatedMinor: 10000,
        },
      ],
    };

    const payment = await service.create('clinic-1', 'user-1', 'branch-1', dto);
    expect(payment.whtRateBps).toBe(300);
    expect(payment.whtAmountMinor).toBe(300);
  });
});
