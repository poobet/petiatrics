import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceService, CreateInvoiceDto } from './invoice.service';
import { TaxEngineService } from './tax-engine.service';
import { DispensingCategory, DefaultVatType } from '@petiatrics/types';

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
    product: {
      findUnique: jest.fn().mockResolvedValue(null), // default: product not found → no tax profile
    },
    $transaction: jest.fn(async (cb) => {
      const tx = { invoice: { create: mockInvoiceCreate } };
      return cb(tx);
    }),
  };
}

/** Build a real TaxEngineService backed by the mock prisma. */
function buildTaxEngine(prisma: any): TaxEngineService {
  const engine = new TaxEngineService(prisma);
  return engine;
}

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: any;
  let events: EventEmitter2;
  let taxEngine: TaxEngineService;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    events = { emit: jest.fn() } as any;
    taxEngine = buildTaxEngine(prisma);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaClient, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
        { provide: TaxEngineService, useValue: taxEngine },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create()', () => {
    it('creates an invoice with expanded line items when product has accessories', async () => {
      // Mock accessories query for parent product
      prisma.productAccessory.findMany.mockResolvedValue([
        {
          childProductId: 'child-1',
          quantityRatio: 2.0,
          childProduct: {
            id: 'child-1',
            name: 'Accessory Item',
            itemType: 'INVENTORY',
            baseSellingPrice: 50.00,
          },
        },
      ]);

      // Mock product tax profiles: parent = General_Retail VAT_7, child = General_Retail VAT_7
      prisma.product.findUnique
        .mockResolvedValueOnce({
          id: 'parent-1',
          name: 'Parent Product',
          defaultVatType: DefaultVatType.VAT_7,
          dispensingCategory: DispensingCategory.General_Retail,
        })
        .mockResolvedValueOnce({
          id: 'child-1',
          name: 'Accessory Item',
          defaultVatType: DefaultVatType.VAT_7,
          dispensingCategory: DispensingCategory.General_Retail,
        });

      const mockCreatedInvoice = {
        id: 'invoice-123',
        clinicId: 'clinic-1',
        visitId: 'visit-1',
        lineItems: [],
      };
      prisma.invoice.create.mockResolvedValue(mockCreatedInvoice);

      const dto: CreateInvoiceDto = {
        visitId: 'visit-1',
        patientId: 'patient-1',
        ownerUserId: 'owner-1',
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Parent Product',
            quantity: 1,
            unitPriceMinor: 10_000, // 100 THB
            sourceReferenceId: 'parent-1',
          },
        ],
      };

      const result = await service.create('clinic-1', dto);

      // Verify accessories were fetched
      expect(prisma.productAccessory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentProductId: 'parent-1' } }),
      );

      // Verify invoice was created with per-line VAT (clinical context → 700 bps on all lines)
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalMinor: 20_000, // 10000 parent + 10000 child (2 x 5000)
            lineItems: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  description: 'Parent Product',
                  subtotalMinor: 10_000,
                  vatRateBps: 700,
                }),
                expect.objectContaining({
                  description: 'Accessory Item',
                  subtotalMinor: 10_000,
                  vatRateBps: 700,
                }),
              ]),
            },
          }),
        }),
      );

      expect(result).toEqual(mockCreatedInvoice);
    });

    it('creates an OTC invoice without visitId (retail context)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-001',
        name: 'Dog Shampoo',
        defaultVatType: DefaultVatType.VAT_7,
        dispensingCategory: DispensingCategory.General_Retail,
      });

      const mockCreatedInvoice = { id: 'invoice-otc-1', lineItems: [] };
      prisma.invoice.create.mockResolvedValue(mockCreatedInvoice);

      const dto: CreateInvoiceDto = {
        visitId: null, // OTC — no visit
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Dog Shampoo',
            quantity: 1,
            unitPriceMinor: 15_000,
            sourceReferenceId: 'prod-001',
          },
        ],
      };

      const result = await service.create('clinic-1', dto);
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visitId: null, patientId: null }),
        }),
      );
      expect(result).toEqual(mockCreatedInvoice);
    });

    it('BLOCKS dispensing of a Dangerous_Drug in OTC context', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'drug-001',
        name: 'Metronidazole',
        defaultVatType: DefaultVatType.VAT_7,
        dispensingCategory: DispensingCategory.Dangerous_Drug,
      });

      const dto: CreateInvoiceDto = {
        visitId: null, // OTC context — no clinical visit
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Metronidazole',
            quantity: 1,
            unitPriceMinor: 18_000,
            sourceReferenceId: 'drug-001',
          },
        ],
      };

      await expect(service.create('clinic-1', dto)).rejects.toThrow(
        'can only be dispensed in a clinical visit context',
      );
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });
  });
});
