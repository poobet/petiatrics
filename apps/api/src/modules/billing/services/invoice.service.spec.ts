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
    it('creates a Credit Note with negative amounts for a PAID invoice in a CLOSED period', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        clinicId: 'clinic-1',
        status: 'PAID',
        documentType: 'INVOICE',
        taxRateBps: 700,
        paidAt: new Date('2026-06-15'),
        lineItems: [
          { itemType: 'SERVICE', description: 'Vet Exam', quantity: 1, unitPriceMinor: 50000 },
        ],
      });

      prisma.accountingPeriod.findUnique.mockResolvedValue({
        id: 'p-1',
        clinicId: 'clinic-1',
        year: 2026,
        month: 6,
        status: 'CLOSED',
      });

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

    it('throws BadRequestException if period is OPEN', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        clinicId: 'clinic-1',
        status: 'PAID',
        documentType: 'INVOICE',
        paidAt: new Date('2026-07-15'),
        lineItems: [],
      });

      prisma.accountingPeriod.findUnique.mockResolvedValue({
        id: 'p-2',
        clinicId: 'clinic-1',
        year: 2026,
        month: 7,
        status: 'OPEN',
      });

      await expect(
        service.createCreditNote('clinic-1', 'inv-1', {
          reasonCode: 'WRONG_PRICE',
          reason: 'Overcharged',
        }),
      ).rejects.toThrow('CLOSED accounting periods');
    });
  });
});
