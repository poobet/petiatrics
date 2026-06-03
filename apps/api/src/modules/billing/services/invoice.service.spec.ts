import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceService, CreateInvoiceDto } from './invoice.service';

jest.mock('@petiatrics/database', () => ({
  scopedPrisma: (_prisma: unknown, _clinicId: string) => _prisma,
}));

function buildPrismaMock() {
  const mockInvoiceCreate = jest.fn();
  return {
    invoice: {
      create: mockInvoiceCreate,
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    productAccessory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (cb) => {
      const tx = {
        invoice: {
          create: mockInvoiceCreate,
        },
      };
      return cb(tx);
    }),
  };
}

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: any;
  let events: EventEmitter2;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    events = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaClient, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create()', () => {
    it('creates an invoice with expanded line items when product has accessories', async () => {
      // Mock accessories query
      prisma.productAccessory.findMany.mockResolvedValue([
        {
          childProductId: 'child-1',
          quantityRatio: 2.0,
          childProduct: {
            id: 'child-1',
            name: 'Accessory Item',
            itemType: 'STOCKED_GOOD',
            baseSellingPrice: 50.00, // 50 THB
          },
        },
      ]);

      const mockCreatedInvoice = {
        id: 'invoice-123',
        clinicId: 'clinic-1',
        visitId: 'visit-1',
        patientId: 'patient-1',
        ownerUserId: 'owner-1',
        subtotalMinor: 20000, // parent: 1 * 10000 + child: 2 * 5000 = 20000
        taxRateBps: 700,
        taxTotalMinor: 1400,
        totalMinor: 21400,
        status: 'DRAFT',
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Parent Product',
            quantity: 1,
            unitPriceMinor: 10000,
            subtotalMinor: 10000,
            sourceReferenceId: 'parent-1',
          },
          {
            itemType: 'PRODUCT',
            description: 'Accessory Item',
            quantity: 2,
            unitPriceMinor: 5000,
            subtotalMinor: 10000,
            sourceReferenceId: 'child-1',
          },
        ],
      };

      prisma.invoice.create.mockResolvedValue(mockCreatedInvoice);

      const dto: CreateInvoiceDto = {
        visitId: 'visit-1',
        patientId: 'patient-1',
        ownerUserId: 'owner-1',
        taxRateBps: 700,
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Parent Product',
            quantity: 1,
            unitPriceMinor: 10000,
            sourceReferenceId: 'parent-1',
          },
        ],
      };

      const result = await service.create('clinic-1', dto);

      expect(prisma.productAccessory.findMany).toHaveBeenCalledWith({
        where: { parentProductId: 'parent-1' },
        include: {
          childProduct: {
            select: {
              id: true,
              name: true,
              itemType: true,
              baseSellingPrice: true,
            },
          },
        },
      });

      // Verify that the data passed to invoice create has expanded items and correct calculations
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalMinor: 20000,
            taxTotalMinor: 1400,
            totalMinor: 21400,
            lineItems: {
              create: [
                {
                  itemType: 'PRODUCT',
                  description: 'Parent Product',
                  quantity: 1,
                  unitPriceMinor: 10000,
                  subtotalMinor: 10000,
                  sourceReferenceId: 'parent-1',
                },
                {
                  itemType: 'PRODUCT',
                  description: 'Accessory Item',
                  quantity: 2,
                  unitPriceMinor: 5000,
                  subtotalMinor: 10000,
                  sourceReferenceId: 'child-1',
                },
              ],
            },
          }),
        }),
      );

      expect(result).toEqual(mockCreatedInvoice);
    });
  });
});
