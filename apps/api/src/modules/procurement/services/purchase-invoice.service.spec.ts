import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, PurchaseInvoiceStatus, InvoiceMatchStatus } from '@prisma/client';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { ThreeWayMatchingService } from './three-way-matching.service';
import { DocumentSequenceService, DOC_TYPE } from '../../document-sequence/services/document-sequence.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

function buildSequenceServiceMock() {
  return {
    generate: jest.fn().mockImplementation(() => {
      return Promise.resolve('PI2026-0001');
    }),
  };
}

function buildThreeWayMatchingMock() {
  return {
    performMatch: jest.fn().mockImplementation((clinicId, invoiceId) => {
      return Promise.resolve({
        status: InvoiceMatchStatus.MATCHED,
        lineResults: [],
        summary: { totalLines: 0, matchedLines: 0, toleranceApprovedLines: 0, exceptionLines: 0 },
      });
    }),
  };
}

function buildPrismaMock() {
  const invoices: any[] = [];
  const poLines: any[] = [
    { id: 'poline-1', quantityOrdered: 10, quantityReceived: 10, quantityInvoiced: 0 },
  ];

  const mock: any = {
    invoices,
    poLines,
    purchaseInvoice: {
      create: jest.fn().mockImplementation(({ data }) => {
        const invoice = {
          id: `pi-${invoices.length + 1}`,
          status: PurchaseInvoiceStatus.DRAFT,
          matchStatus: InvoiceMatchStatus.PENDING,
          amountPaidMinor: 0,
          ...data,
          lines: data.lines?.create || [],
        };
        invoices.push(invoice);
        return Promise.resolve(invoice);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const inv = invoices.find((i) => i.id === where.id && i.clinicId === where.clinicId);
        return Promise.resolve(inv || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const inv = invoices.find((i) => i.id === where.id);
        if (inv) {
          Object.assign(inv, data);
        }
        return Promise.resolve(inv);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          invoices.filter(
            (i) => i.clinicId === where.clinicId && (!where.status || i.status === where.status),
          ),
        );
      }),
    },
    purchaseOrderLine: {
      update: jest.fn().mockImplementation(({ where, data }) => {
        const line = poLines.find((l) => l.id === where.id);
        if (line && data.quantityInvoiced?.increment) {
          line.quantityInvoiced += data.quantityInvoiced.increment;
        }
        return Promise.resolve(line);
      }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mock)),
  };

  return mock;
}

describe('PurchaseInvoiceService', () => {
  let service: PurchaseInvoiceService;
  let prismaMock: any;
  let sequenceMock: any;
  let matchingMock: any;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));

    sequenceMock = buildSequenceServiceMock();
    matchingMock = buildThreeWayMatchingMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseInvoiceService,
        { provide: PrismaClient, useValue: prismaMock as any },
        { provide: DocumentSequenceService, useValue: sequenceMock },
        { provide: ThreeWayMatchingService, useValue: matchingMock },
      ],
    }).compile();

    service = module.get<PurchaseInvoiceService>(PurchaseInvoiceService);
  });

  it('should successfully create a purchase invoice and update PO lines', async () => {
    const dto = {
      supplierId: 'supplier-1',
      purchaseOrderId: 'po-1',
      invoiceNumber: 'INV-VEN-999',
      invoiceDate: '2026-07-19T00:00:00.000Z',
      dueDate: '2026-08-19T00:00:00.000Z',
      lines: [
        {
          poLineId: 'poline-1',
          productId: 'prod-1',
          quantity: 5,
          unitPriceMinor: 1000,
          taxRateBps: 700,
        },
      ],
    };

    const invoice = await service.create('clinic-1', 'user-1', 'branch-1', dto);
    expect(invoice.invoiceNumber).toBe('INV-VEN-999');
    expect(invoice.totalMinor).toBe(5350); // 5000 + 7% tax (350)
    expect(prismaMock.invoices.length).toBe(1);
    expect(prismaMock.poLines[0].quantityInvoiced).toBe(5);
  });

  it('should throw an error when posting an invoice with EXCEPTION match status', async () => {
    const mockInv = {
      id: 'inv-exc',
      clinicId: 'clinic-1',
      status: PurchaseInvoiceStatus.DRAFT,
      matchStatus: InvoiceMatchStatus.EXCEPTION,
      totalMinor: 5000,
      amountPaidMinor: 0,
    };
    prismaMock.invoices.push(mockInv);

    await expect(service.post('clinic-1', 'inv-exc')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should post a DRAFT invoice if match status is not EXCEPTION', async () => {
    const mockInv = {
      id: 'inv-ok',
      clinicId: 'clinic-1',
      status: PurchaseInvoiceStatus.DRAFT,
      matchStatus: InvoiceMatchStatus.MATCHED,
      totalMinor: 5000,
      amountPaidMinor: 0,
    };
    prismaMock.invoices.push(mockInv);

    const posted = await service.post('clinic-1', 'inv-ok');
    expect(posted.status).toBe(PurchaseInvoiceStatus.POSTED);
  });

  it('should successfully void a non-paid invoice', async () => {
    const mockInv = {
      id: 'inv-to-void',
      clinicId: 'clinic-1',
      status: PurchaseInvoiceStatus.POSTED,
      totalMinor: 5000,
      amountPaidMinor: 0,
    };
    prismaMock.invoices.push(mockInv);

    const voided = await service.void('clinic-1', 'inv-to-void');
    expect(voided.status).toBe(PurchaseInvoiceStatus.VOIDED);
  });

  it('should throw an error when trying to void a fully paid invoice', async () => {
    const mockInv = {
      id: 'inv-paid',
      clinicId: 'clinic-1',
      status: PurchaseInvoiceStatus.PAID,
      totalMinor: 5000,
      amountPaidMinor: 5000,
    };
    prismaMock.invoices.push(mockInv);

    await expect(service.void('clinic-1', 'inv-paid')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
