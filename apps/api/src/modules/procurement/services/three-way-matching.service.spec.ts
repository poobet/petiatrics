import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, InvoiceMatchStatus, MatchDiscrepancyType } from '@prisma/client';
import { ThreeWayMatchingService } from './three-way-matching.service';

function buildPrismaMock() {
  let mockInvoice: any = null;
  let mockToleranceConfig: any = null;

  return {
    setMockInvoice(invoice: any) {
      mockInvoice = invoice;
    },
    setMockToleranceConfig(config: any) {
      mockToleranceConfig = config;
    },
    purchaseInvoice: {
      findFirst: jest.fn().mockImplementation(() => {
        return Promise.resolve(mockInvoice);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        if (mockInvoice && mockInvoice.id === where.id) {
          mockInvoice.matchStatus = data.matchStatus;
        }
        return Promise.resolve(mockInvoice);
      }),
    },
    matchingToleranceConfig: {
      findFirst: jest.fn().mockImplementation(() => {
        return Promise.resolve(mockToleranceConfig);
      }),
    },
  };
}

describe('ThreeWayMatchingService', () => {
  let service: ThreeWayMatchingService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreeWayMatchingService,
        { provide: PrismaClient, useValue: prismaMock as any },
      ],
    }).compile();

    service = module.get<ThreeWayMatchingService>(ThreeWayMatchingService);
  });

  it('should throw an error if the invoice is not found', async () => {
    prismaMock.setMockInvoice(null);
    await expect(service.performMatch('clinic-1', 'inv-1')).rejects.toThrow(
      'Purchase Invoice inv-1 not found',
    );
  });

  it('should perfectly MATCH when PO, GR, and Invoice values are identical', async () => {
    const mockInvoice = {
      id: 'inv-1',
      clinicId: 'clinic-1',
      lines: [
        {
          id: 'line-1',
          productId: 'prod-1',
          product: { id: 'prod-1', name: 'Product 1', categoryId: 'cat-1' },
          quantity: 10,
          unitPriceMinor: 1000, // 10.00
          poLine: { id: 'poline-1', quantityOrdered: 10, unitPriceMinor: 1000 },
          grLine: { id: 'grline-1', quantityReceived: 10 },
        },
      ],
    };
    prismaMock.setMockInvoice(mockInvoice);
    prismaMock.setMockToleranceConfig({ tolerancePercent: 2.0 });

    const result = await service.performMatch('clinic-1', 'inv-1');
    expect(result.status).toBe(InvoiceMatchStatus.MATCHED);
    expect(result.lineResults[0].status).toBe(InvoiceMatchStatus.MATCHED);
    expect(result.lineResults[0].discrepancyType).toBeNull();
    expect(result.lineResults[0].withinTolerance).toBe(true);
  });

  it('should status TOLERANCE_APPROVED when variances are within the configured category tolerance', async () => {
    // 1% price variance (PO is 1000 minor, Invoice is 1010 minor)
    // 2% is tolerance config
    const mockInvoice = {
      id: 'inv-2',
      clinicId: 'clinic-1',
      lines: [
        {
          id: 'line-1',
          productId: 'prod-1',
          product: { id: 'prod-1', name: 'Product 1', categoryId: 'cat-1' },
          quantity: 10,
          unitPriceMinor: 1010, // 1% over PO unit price
          poLine: { id: 'poline-1', quantityOrdered: 10, unitPriceMinor: 1000 },
          grLine: { id: 'grline-1', quantityReceived: 10 },
        },
      ],
    };
    prismaMock.setMockInvoice(mockInvoice);
    prismaMock.setMockToleranceConfig({ tolerancePercent: 2.0 });

    const result = await service.performMatch('clinic-1', 'inv-2');
    expect(result.status).toBe(InvoiceMatchStatus.TOLERANCE_APPROVED);
    expect(result.lineResults[0].status).toBe(InvoiceMatchStatus.TOLERANCE_APPROVED);
    expect(result.lineResults[0].discrepancyType).toBe(MatchDiscrepancyType.PRICE);
    expect(result.lineResults[0].priceVariancePercent).toBe(1.0);
    expect(result.lineResults[0].withinTolerance).toBe(true);
  });

  it('should status EXCEPTION when quantity or price variance exceeds configured tolerance', async () => {
    // 5% price variance (PO is 1000 minor, Invoice is 1050 minor), which exceeds 2% tolerance
    const mockInvoice = {
      id: 'inv-3',
      clinicId: 'clinic-1',
      lines: [
        {
          id: 'line-1',
          productId: 'prod-1',
          product: { id: 'prod-1', name: 'Product 1', categoryId: 'cat-1' },
          quantity: 10,
          unitPriceMinor: 1050,
          poLine: { id: 'poline-1', quantityOrdered: 10, unitPriceMinor: 1000 },
          grLine: { id: 'grline-1', quantityReceived: 10 },
        },
      ],
    };
    prismaMock.setMockInvoice(mockInvoice);
    prismaMock.setMockToleranceConfig({ tolerancePercent: 2.0 });

    const result = await service.performMatch('clinic-1', 'inv-3');
    expect(result.status).toBe(InvoiceMatchStatus.EXCEPTION);
    expect(result.lineResults[0].status).toBe(InvoiceMatchStatus.EXCEPTION);
    expect(result.lineResults[0].discrepancyType).toBe(MatchDiscrepancyType.PRICE);
    expect(result.lineResults[0].priceVariancePercent).toBe(5.0);
    expect(result.lineResults[0].withinTolerance).toBe(false);
  });

  it('should detect both PRICE and QUANTITY mismatches', async () => {
    const mockInvoice = {
      id: 'inv-4',
      clinicId: 'clinic-1',
      lines: [
        {
          id: 'line-1',
          productId: 'prod-1',
          product: { id: 'prod-1', name: 'Product 1', categoryId: 'cat-1' },
          quantity: 12, // 20% over GR quantity of 10
          unitPriceMinor: 1050, // 5% over PO unit price of 1000
          poLine: { id: 'poline-1', quantityOrdered: 10, unitPriceMinor: 1000 },
          grLine: { id: 'grline-1', quantityReceived: 10 },
        },
      ],
    };
    prismaMock.setMockInvoice(mockInvoice);
    prismaMock.setMockToleranceConfig({ tolerancePercent: 2.0 });

    const result = await service.performMatch('clinic-1', 'inv-4');
    expect(result.status).toBe(InvoiceMatchStatus.EXCEPTION);
    expect(result.lineResults[0].discrepancyType).toBe(MatchDiscrepancyType.BOTH);
    expect(result.lineResults[0].quantityVariancePercent).toBe(20.0);
    expect(result.lineResults[0].priceVariancePercent).toBe(5.0);
    expect(result.lineResults[0].withinTolerance).toBe(false);
  });
});
