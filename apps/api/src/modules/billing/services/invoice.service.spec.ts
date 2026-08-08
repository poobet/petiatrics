import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceService, CreateInvoiceDto } from './invoice.service';
import { TaxEngineService } from './tax-engine.service';
import { GLPostingService } from './gl-posting.service';
import { VisitService } from '../../clinical/services/visit.service';
import { DocumentSequenceService } from '../../document-sequence/services/document-sequence.service';
import { DispensingCategory, DefaultVatType } from '@petiatrics/types';

jest.mock('@petiatrics/database', () => ({
  scopedPrisma: (_prisma: unknown, _clinicId: string) => _prisma,
  MODEL_NAMES: {
    VISIT_RECORD: 'VisitRecord',
    PET_PROFILE: 'PetProfile',
    VACCINATION_RECORD: 'VaccinationRecord',
  },
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
    invoiceLineItem: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    branchStockBalance: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    dfTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    accountingPeriod: {
      findUnique: jest.fn(),
    },
    productAccessory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue(null), // default: product not found → no tax profile
    },
    user: {
      findFirst: jest.fn(),
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
  let visitService: any;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    events = { emit: jest.fn() } as any;
    taxEngine = buildTaxEngine(prisma);
    visitService = {
      getOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaClient, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
        { provide: TaxEngineService, useValue: taxEngine },
        { provide: VisitService, useValue: visitService },
        {
          provide: DocumentSequenceService,
          useValue: { generate: jest.fn().mockResolvedValue('CN2026-0001') },
        },
        {
          provide: GLPostingService,
          useValue: { postJournal: jest.fn() },
        },
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

    it('BLOCKS dispensing of a Dangerous_Drug in OTC context without PIN override', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'drug-001',
        name: 'Metronidazole',
        defaultVatType: DefaultVatType.VAT_7,
        dispensingCategory: DispensingCategory.Dangerous_Drug,
      });

      const dto: CreateInvoiceDto = {
        visitId: null,
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
        'requires a supervisor PIN override for OTC sales',
      );
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it('ALLOWS dispensing of a Dangerous_Drug in OTC context with valid PIN override', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'drug-001',
        name: 'Metronidazole',
        defaultVatType: DefaultVatType.VAT_7,
        dispensingCategory: DispensingCategory.Dangerous_Drug,
      });

      prisma.user.findFirst.mockResolvedValue({
        id: 'vet-1',
        name: 'Dr. John',
        role: 'VET',
        status: 'ACTIVE',
      });

      prisma.invoice.create.mockResolvedValue({ id: 'invoice-1' });

      const dto: CreateInvoiceDto = {
        visitId: null,
        overrideApprovedByUserId: 'vet-1',
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

      const result = await service.create('clinic-1', dto);
      expect(result).toBeDefined();
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'vet-1',
          clinicId: 'clinic-1',
          role: { in: ['VET', 'CLINIC_OWNER'] },
          status: 'ACTIVE',
        },
      });
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('BLOCKS Specially_Controlled_Drug in OTC context', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'drug-002',
        name: 'Morphine',
        defaultVatType: DefaultVatType.VAT_EXEMPT,
        dispensingCategory: DispensingCategory.Specially_Controlled_Drug,
      });

      const dto: CreateInvoiceDto = {
        visitId: null,
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Morphine',
            quantity: 1,
            unitPriceMinor: 20_000,
            sourceReferenceId: 'drug-002',
          },
        ],
      };

      await expect(service.create('clinic-1', dto)).rejects.toThrow(
        'cannot be sold at retail (OTC)',
      );
    });

    it('ALLOWS Specially_Controlled_Drug in clinical context if prescribed in finalized visit', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'drug-002',
        name: 'Morphine',
        defaultVatType: DefaultVatType.VAT_EXEMPT,
        dispensingCategory: DispensingCategory.Specially_Controlled_Drug,
      });

      visitService.getOne.mockResolvedValue({
        id: 'visit-1',
        status: 'finalized',
        prescriptions: [
          { productId: 'drug-002', drug: 'Morphine' },
        ],
      });

      prisma.invoice.create.mockResolvedValue({ id: 'invoice-2' });

      const dto: CreateInvoiceDto = {
        visitId: 'visit-1',
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Morphine',
            quantity: 1,
            unitPriceMinor: 20_000,
            sourceReferenceId: 'drug-002',
          },
        ],
      };

      const result = await service.create('clinic-1', dto);
      expect(result).toBeDefined();
      expect(visitService.getOne).toHaveBeenCalledWith('clinic-1', 'visit-1');
    });

    it('BLOCKS Specially_Controlled_Drug if not prescribed in the visit', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'drug-002',
        name: 'Morphine',
        defaultVatType: DefaultVatType.VAT_EXEMPT,
        dispensingCategory: DispensingCategory.Specially_Controlled_Drug,
      });

      visitService.getOne.mockResolvedValue({
        id: 'visit-1',
        status: 'finalized',
        prescriptions: [],
      });

      const dto: CreateInvoiceDto = {
        visitId: 'visit-1',
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Morphine',
            quantity: 1,
            unitPriceMinor: 20_000,
            sourceReferenceId: 'drug-002',
          },
        ],
      };

      await expect(service.create('clinic-1', dto)).rejects.toThrow(
        'must be prescribed in the associated visit',
      );
    });

    it('BLOCKS Clinic_Use_Only in OTC context', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'good-003',
        name: 'Surgical Gown',
        defaultVatType: DefaultVatType.VAT_7,
        dispensingCategory: DispensingCategory.Clinic_Use_Only,
      });

      const dto: CreateInvoiceDto = {
        visitId: null,
        lineItems: [
          {
            itemType: 'PRODUCT',
            description: 'Surgical Gown',
            quantity: 1,
            unitPriceMinor: 5_000,
            sourceReferenceId: 'good-003',
          },
        ],
      };

      await expect(service.create('clinic-1', dto)).rejects.toThrow(
        'cannot be sold at retail (OTC)',
      );
    });
  });

  describe('createCreditNote()', () => {
    const paidInvoice = {
      id: 'inv-1',
      clinicId: 'clinic-1',
      status: 'PAID',
      documentType: 'INVOICE',
      taxRateBps: 700,
      totalMinor: 53500,
      paidAt: new Date('2026-06-15'),
      createdAt: new Date('2026-06-15'),
      lineItems: [
        { itemType: 'SERVICE', description: 'Vet Exam', quantity: 1, unitPriceMinor: 50000 },
      ],
    };

    const closedPeriod = {
      id: 'p-1',
      clinicId: 'clinic-1',
      year: 2026,
      month: 6,
      status: 'CLOSED',
    };

    it('creates a Credit Note with negative amounts for a PAID invoice in a CLOSED period', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);
      prisma.accountingPeriod.findUnique.mockResolvedValue(closedPeriod);
      // No existing CNs — full refund available
      prisma.invoice.findMany.mockResolvedValue([]);

      prisma.invoice.create.mockResolvedValue({
        id: 'cn-1',
        code: 'CN2026-0001',
        documentType: 'CREDIT_NOTE',
        referenceInvoiceId: 'inv-1',
        totalMinor: -53500,
      });

      const result = await service.createCreditNote('clinic-1', 'inv-1', {
        reasonCode: 'WRONG_PRICE',
        reason: 'Overcharged customer',
      });

      expect(result.documentType).toBe('CREDIT_NOTE');
      expect(result.totalMinor).toBe(-53500);
    });

    it('creates a partial refund Credit Note when refundAmountMinor is provided', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);
      prisma.accountingPeriod.findUnique.mockResolvedValue(closedPeriod);
      prisma.invoice.findMany.mockResolvedValue([]); // No existing CNs

      prisma.invoice.create.mockResolvedValue({
        id: 'cn-partial',
        code: 'CN2026-0002',
        documentType: 'CREDIT_NOTE',
        referenceInvoiceId: 'inv-1',
        totalMinor: -10000,
      });

      const result = await service.createCreditNote('clinic-1', 'inv-1', {
        reasonCode: 'WRONG_PRICE',
        reason: 'Partial refund for overcharge',
        refundAmountMinor: 10000,
      });

      expect(result.documentType).toBe('CREDIT_NOTE');
      expect(result.totalMinor).toBe(-10000);
      // Verify the create call includes a single-line item
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: 'CREDIT_NOTE',
            lineItems: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  description: expect.stringContaining('Partial refund'),
                  quantity: -1,
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('rejects CN when refund amount exceeds remaining refundable balance', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);
      prisma.accountingPeriod.findUnique.mockResolvedValue(closedPeriod);
      // Existing CN already refunded 50000 of the 53500 total
      prisma.invoice.findMany.mockResolvedValue([
        { totalMinor: -50000 },
      ]);

      await expect(
        service.createCreditNote('clinic-1', 'inv-1', {
          reasonCode: 'WRONG_PRICE',
          reason: 'Another refund',
          refundAmountMinor: 5000, // Only 3500 remaining
        }),
      ).rejects.toThrow('exceeds remaining refundable balance');
    });

    it('rejects CN when invoice is already fully refunded', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);
      prisma.accountingPeriod.findUnique.mockResolvedValue(closedPeriod);
      // Existing CN already refunded full amount
      prisma.invoice.findMany.mockResolvedValue([
        { totalMinor: -53500 },
      ]);

      await expect(
        service.createCreditNote('clinic-1', 'inv-1', {
          reasonCode: 'WRONG_PRICE',
          reason: 'Try another refund',
        }),
      ).rejects.toThrow('already been fully refunded');
    });

    it('creates CN for a PAID invoice regardless of period status', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        clinicId: 'clinic-1',
        status: 'PAID',
        documentType: 'INVOICE',
        taxRateBps: 700,
        totalMinor: 53500,
        paidAt: new Date('2026-07-15'),
        createdAt: new Date('2026-07-15'),
        lineItems: [],
      });
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.invoice.create.mockResolvedValue({
        id: 'cn-open',
        code: 'CN2026-0003',
        documentType: 'CREDIT_NOTE',
        referenceInvoiceId: 'inv-1',
        totalMinor: -53500,
      });

      const result = await service.createCreditNote('clinic-1', 'inv-1', {
        reasonCode: 'WRONG_PRICE',
        reason: 'Overcharged in open period',
      });
      expect(result.documentType).toBe('CREDIT_NOTE');
    });
  });

  describe('createDebitNote()', () => {
    const paidInvoice = {
      id: 'inv-1',
      clinicId: 'clinic-1',
      status: 'PAID',
      documentType: 'INVOICE',
      taxRateBps: 700,
      totalMinor: 53500,
      paidAt: new Date('2026-06-15'),
      createdAt: new Date('2026-06-15'),
      lineItems: [
        { itemType: 'SERVICE', description: 'Vet Exam', quantity: 1, unitPriceMinor: 50000 },
      ],
    };

    it('creates a Debit Note with positive amounts for a PAID invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);

      prisma.invoice.create.mockResolvedValue({
        id: 'dn-1',
        code: 'DN2026-0001',
        documentType: 'DEBIT_NOTE',
        referenceInvoiceId: 'inv-1',
        totalMinor: 10000,
      });

      const result = await service.createDebitNote('clinic-1', 'inv-1', {
        reasonCode: 'UNDERCHARGED',
        reason: 'Additional service not billed',
        additionalAmountMinor: 10000,
      });

      expect(result.documentType).toBe('DEBIT_NOTE');
      expect(result.totalMinor).toBe(10000);
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: 'DEBIT_NOTE',
            referenceInvoiceId: 'inv-1',
          }),
        }),
      );
    });

    it('rejects Debit Note for non-PAID invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...paidInvoice,
        status: 'ISSUED',
      });

      await expect(
        service.createDebitNote('clinic-1', 'inv-1', {
          reasonCode: 'UNDERCHARGED',
          reason: 'Additional charge',
          additionalAmountMinor: 5000,
        }),
      ).rejects.toThrow('Debit Note can only be issued for PAID invoices');
    });
  });

  describe('createItemizedAdjustment()', () => {
    const paidInvoice = {
      id: 'inv-itemized-1',
      clinicId: 'clinic-1',
      status: 'PAID',
      documentType: 'INVOICE',
      taxRateBps: 700,
      totalMinor: 107000,
      paidAt: new Date('2026-06-15'),
      createdAt: new Date('2026-06-15'),
      lineItems: [
        {
          id: 'item-1',
          itemType: 'SERVICE',
          description: 'Vet Exam',
          quantity: 1,
          unitPriceMinor: 50000,
          subtotalMinor: 50000,
          vatRateBps: 700,
          vatTotalMinor: 3500,
        },
        {
          id: 'item-2',
          itemType: 'PRODUCT',
          description: 'Dog Shampoo',
          quantity: 2,
          unitPriceMinor: 25000,
          subtotalMinor: 50000,
          vatRateBps: 700,
          vatTotalMinor: 3500,
          productId: 'prod-shampoo-1',
        },
      ],
    };

    it('creates an itemized Credit Note with per-line VAT and linked originalInvoiceItemId', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);
      prisma.invoiceLineItem.findMany.mockResolvedValue([]); // No previous adjustments

      prisma.invoice.create.mockResolvedValue({
        id: 'cn-itemized-1',
        code: 'CN2026-0010',
        documentType: 'CREDIT_NOTE',
        referenceInvoiceId: 'inv-itemized-1',
        totalMinor: -53500,
      });

      const result = await service.createItemizedAdjustment('clinic-1', 'inv-itemized-1', {
        type: 'CREDIT_NOTE',
        reasonCode: 'CUSTOMER_RETURN',
        reason: 'Returned 1 shampoo bottle',
        items: [
          {
            originalItemId: 'item-2',
            adjustQty: 1,
            adjustAmountMinor: 25000,
            returnToStock: true,
          },
        ],
      });

      expect(result.documentType).toBe('CREDIT_NOTE');
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: 'CREDIT_NOTE',
            referenceInvoiceId: 'inv-itemized-1',
            lineItems: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  originalInvoiceItemId: 'item-2',
                  quantity: -1,
                  subtotalMinor: -25000,
                  vatTotalMinor: -1750, // 7% of 25000
                  returnToStock: true,
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('rejects adjustment if adjustQty exceeds remaining quantity', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);
      // Already refunded 1.5 of the 2 shampoo bottles
      prisma.invoiceLineItem.findMany.mockResolvedValue([
        { quantity: -1.5, subtotalMinor: -37500 },
      ]);

      await expect(
        service.createItemizedAdjustment('clinic-1', 'inv-itemized-1', {
          type: 'CREDIT_NOTE',
          reasonCode: 'CUSTOMER_RETURN',
          reason: 'Try refunding 1 more bottle',
          items: [
            {
              originalItemId: 'item-2',
              adjustQty: 1, // Only 0.5 left
              adjustAmountMinor: 12500,
            },
          ],
        }),
      ).rejects.toThrow('exceeds remaining quantity');
    });

    it('rejects adjustment if adjustAmountMinor exceeds remaining balance', async () => {
      prisma.invoice.findFirst.mockResolvedValue(paidInvoice);
      // Already refunded 30000 of the 50000 subtotal
      prisma.invoiceLineItem.findMany.mockResolvedValue([
        { quantity: -1, subtotalMinor: -30000 },
      ]);

      await expect(
        service.createItemizedAdjustment('clinic-1', 'inv-itemized-1', {
          type: 'CREDIT_NOTE',
          reasonCode: 'WRONG_PRICE',
          reason: 'Try refunding 25000',
          items: [
            {
              originalItemId: 'item-2',
              adjustQty: 0.5,
              adjustAmountMinor: 25000, // Only 20000 left
            },
          ],
        }),
      ).rejects.toThrow('exceeds remaining balance');
    });
  });
});


