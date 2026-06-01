import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './product.service';
import { SkuSequenceService } from './sku-sequence.service';
import type { CreateProductDto } from '../dto/create-product.dto';
import { ItemType } from '@petiatrics/types';

// Make scopedPrisma pass-through so tests work against the same mock prisma object
jest.mock('@petiatrics/database', () => ({
  scopedPrisma: (_prisma: unknown, _clinicId: string) => _prisma,
}));

// ─── Minimal mock factory ─────────────────────────────────────────────────────

function buildPrismaMock() {
  return {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    branchStockBalance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    itemCategory: { findUnique: jest.fn() },
    unitOfMeasure: { findUnique: jest.fn() },
    taxCode: { findUnique: jest.fn() },
    businessPartner: { findFirst: jest.fn() },
    itemUnitConversion: { deleteMany: jest.fn() },
  };
}

const CATEGORY_ID = 'cat-medicine-001';
const UNIT_ID = 'unit-box-001';
const CLINIC_ID = 'clinic-001';

function validCreateDto(overrides: Partial<CreateProductDto> = {}): CreateProductDto {
  return {
    code: 'MED-001',
    name: 'Test Medication',
    itemType: ItemType.STOCKED_GOOD,
    categoryId: CATEGORY_ID,
    baseUnitId: UNIT_ID,
    standardCost: 100,
    baseSellingPrice: 180,
    ...overrides,
  };
}

describe('ProductService', () => {
  let service: ProductService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaClient, useValue: prisma },
        { provide: SkuSequenceService, useValue: { nextSku: jest.fn().mockResolvedValue('SKU-00001') } },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── normalizeCode ──────────────────────────────────────────────────────────

  describe('normalizeCode()', () => {
    it('uppercases and trims the code', () => {
      expect(service.normalizeCode('  med-001  ')).toBe('MED-001');
      expect(service.normalizeCode('vax_002')).toBe('VAX_002');
    });
  });

  // ─── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    beforeEach(() => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.itemCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID, isActive: true });
      prisma.unitOfMeasure.findUnique.mockResolvedValue({ id: UNIT_ID, isActive: true });
      prisma.product.create.mockResolvedValue({ id: 'prod-001', code: 'MED-001', name: 'Test Medication' });
    });

    it('creates a stocked good with normalized code', async () => {
      await service.create(CLINIC_ID, validCreateDto({ code: 'med-001' }));
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'MED-001', clinicId: CLINIC_ID }),
        }),
      );
    });

    it('throws ConflictException when code already exists', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create(CLINIC_ID, validCreateDto())).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException when category does not exist', async () => {
      prisma.itemCategory.findUnique.mockResolvedValue(null);
      await expect(service.create(CLINIC_ID, validCreateDto())).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when base unit does not exist', async () => {
      prisma.unitOfMeasure.findUnique.mockResolvedValue(null);
      await expect(service.create(CLINIC_ID, validCreateDto())).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a service item without error', async () => {
      await service.create(CLINIC_ID, validCreateDto({ itemType: ItemType.SERVICE }));
      expect(prisma.product.create).toHaveBeenCalled();
    });
  });

  // ─── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    beforeEach(() => {
      prisma.product.count.mockResolvedValue(2);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Medication A', itemType: 'STOCKED_GOOD', isActive: true },
        { id: 'p2', name: 'Service B', itemType: 'SERVICE', isActive: true },
      ]);
    });

    it('returns paginated results with default page=1', async () => {
      const result = await service.findAll(CLINIC_ID, 'branch-1', {});
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('applies itemType filter to query', async () => {
      await service.findAll(CLINIC_ID, 'branch-1', { itemType: ItemType.SERVICE });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ itemType: ItemType.SERVICE }),
        }),
      );
    });

    it('applies search filter across code and name', async () => {
      await service.findAll(CLINIC_ID, 'branch-1', { search: 'med' });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('excludes inactive items by default', async () => {
      await service.findAll(CLINIC_ID, 'branch-1', {});
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('includes inactive items when includeInactive=true', async () => {
      await service.findAll(CLINIC_ID, 'branch-1', { includeInactive: true });
      const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.isActive).toBeUndefined();
    });
  });

  // ─── findById() ────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('throws NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findById(CLINIC_ID, 'bad-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the product when found', async () => {
      const product = { id: 'p1', clinicId: CLINIC_ID };
      prisma.product.findUnique.mockResolvedValue(product);
      const result = await service.findById(CLINIC_ID, 'p1');
      expect(result).toEqual(product);
    });
  });

  // ─── deactivate() ──────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('sets isActive=false on the product', async () => {
      const existing = { id: 'p1', clinicId: CLINIC_ID };
      prisma.product.findUnique.mockResolvedValue(existing);
      prisma.product.update.mockResolvedValue({ ...existing, isActive: false });

      await service.deactivate(CLINIC_ID, 'p1');
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('throws NotFoundException for unknown id', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.deactivate(CLINIC_ID, 'bad')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── getLowStock() ─────────────────────────────────────────────────────────

  describe('getLowStock()', () => {
    it('returns only stocked goods at or below threshold via branch balance', async () => {
      prisma.branchStockBalance.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 3, product: { id: 'p1', reorderPoint: 5, minimumStock: 0, itemType: 'STOCKED_GOOD', isActive: true } },
        { productId: 'p2', quantity: 10, product: { id: 'p2', reorderPoint: 5, minimumStock: 0, itemType: 'STOCKED_GOOD', isActive: true } },
      ]);
      const result = await service.getLowStock(CLINIC_ID, 'branch-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });
  });
});
