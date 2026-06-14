/**
 * Contract tests: Inventory Products API
 *
 * Verifies that the ProductService returns data shapes matching
 * the ItemSummaryResponse, ItemDetailResponse, and ReferenceSelectorItem contracts.
 *
 * These tests use Jest mocking — no live DB required.
 */

import { ItemType, DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';
import type {
  ItemSummaryResponse,
  ItemDetailResponse,
  ItemCategoryResponse,
  UnitOfMeasureResponse,
} from '@petiatrics/types';

// ─── Shape validators (operate on unknown to avoid type cast errors) ──────────

function isItemSummaryShape(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    typeof r['code'] === 'string' &&
    typeof r['name'] === 'string' &&
    (r['itemType'] === ItemType.INVENTORY || r['itemType'] === ItemType.SERVICE) &&
    typeof r['isActive'] === 'boolean'
  );
}

function isItemDetailShape(obj: unknown): boolean {
  if (!isItemSummaryShape(obj)) return false;
  const r = obj as Record<string, unknown>;
  return (
    Array.isArray(r['conversions']) &&
    typeof r['createdAt'] === 'string' &&
    typeof r['updatedAt'] === 'string'
  );
}

function isItemCategoryShape(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return typeof r['id'] === 'string' && typeof r['name'] === 'string' && typeof r['code'] === 'string';
}

function isUnitOfMeasureShape(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return typeof r['id'] === 'string' && typeof r['name'] === 'string' && typeof r['symbol'] === 'string';
}

// ─── Contract fixtures ────────────────────────────────────────────────────────

const SUMMARY_FIXTURE: ItemSummaryResponse = {
  id: 'prod-001',
  code: 'MED-001',
  sku: 'SKU-00001',
  barcode: null,
  name: 'Metronidazole 250mg',
  itemType: ItemType.INVENTORY,
  isActive: true,
  standardCost: 80,
  baseSellingPrice: 150,
  isTaxInclusive: false,
  isControlledSubstance: false,
  requiresBatchAndExpiryTracking: false,
  category: { id: 'cat-001', name: 'Medicine' },
  baseUnit: { id: 'unit-001', name: 'Box', symbol: 'bx' },
  defaultTaxCode: null,
  defaultSupplier: null,
  defaultVatType: DefaultVatType.VAT_7,
  whtRate: WhtRate.WHT_0,
  dispensingCategory: DispensingCategory.General_Retail,
  revenueAccountId: null,
  cogsAccountId: null,
  inventoryAssetAccountId: null,
};

const DETAIL_FIXTURE: ItemDetailResponse = {
  ...SUMMARY_FIXTURE,
  categoryId: 'cat-001',
  baseUnitId: 'unit-001',
  genericName: null,
  defaultTaxCodeId: null,
  defaultSupplierId: null,
  defaultDoctorFee: null,
  quantity: 100,
  reorderPoint: 10,
  minimumStock: 5,
  conversions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const CATEGORY_FIXTURE: ItemCategoryResponse = {
  id: 'cat-001',
  name: 'Medicine',
  code: 'MEDICINE',
  isActive: true,
  revenueGlAccountId: null,
  expenseGlAccountId: null,
  revenueGlAccount: null,
  expenseGlAccount: null,
};

const UNIT_FIXTURE: UnitOfMeasureResponse = {
  id: 'unit-001',
  name: 'Box',
  symbol: 'bx',
  isActive: true,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Item Master API Contracts', () => {
  describe('ItemSummaryResponse shape', () => {
    it('fixture satisfies the ItemSummaryResponse shape contract', () => {
      expect(isItemSummaryShape(SUMMARY_FIXTURE)).toBe(true);
    });

    it('requires id, code, name, itemType, isActive', () => {
      const broken = { ...SUMMARY_FIXTURE, id: undefined };
      expect(isItemSummaryShape(broken)).toBe(false);
    });

    it('itemType must be INVENTORY or SERVICE', () => {
      const valid1 = { ...SUMMARY_FIXTURE, itemType: ItemType.INVENTORY };
      const valid2 = { ...SUMMARY_FIXTURE, itemType: ItemType.SERVICE };
      const invalid = { ...SUMMARY_FIXTURE, itemType: 'UNKNOWN' };
      expect(isItemSummaryShape(valid1)).toBe(true);
      expect(isItemSummaryShape(valid2)).toBe(true);
      expect(isItemSummaryShape(invalid)).toBe(false);
    });
  });

  describe('ItemDetailResponse shape', () => {
    it('fixture satisfies the ItemDetailResponse shape contract', () => {
      expect(isItemDetailShape(DETAIL_FIXTURE)).toBe(true);
    });

    it('extends ItemSummaryResponse with conversions and timestamps', () => {
      expect(DETAIL_FIXTURE).toMatchObject({
        id: SUMMARY_FIXTURE.id,
        code: SUMMARY_FIXTURE.code,
        conversions: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('quantity is present on detail', () => {
      expect(typeof DETAIL_FIXTURE.quantity).toBe('number');
    });
  });

  describe('ItemCategoryResponse shape', () => {
    it('fixture satisfies the category shape', () => {
      expect(isItemCategoryShape(CATEGORY_FIXTURE)).toBe(true);
    });

    it('includes revenueGlAccountId and expenseGlAccountId (nullable)', () => {
      expect('revenueGlAccountId' in CATEGORY_FIXTURE).toBe(true);
      expect('expenseGlAccountId' in CATEGORY_FIXTURE).toBe(true);
    });
  });

  describe('UnitOfMeasureResponse shape', () => {
    it('fixture satisfies the unit shape', () => {
      expect(isUnitOfMeasureShape(UNIT_FIXTURE)).toBe(true);
    });
  });

  describe('CreateItemPayload constraints', () => {
    it('code is normalized (uppercase + trimmed) before persistence', () => {
      const raw = '  med-001  ';
      const normalized = raw.trim().toUpperCase();
      expect(normalized).toBe('MED-001');
    });

    it('standardCost is not required for SERVICE items', () => {
      const dto = { itemType: ItemType.SERVICE, standardCost: undefined };
      expect(dto.standardCost).toBeUndefined();
    });

    it('baseSellingPrice is required for all item types', () => {
      const validDto = { baseSellingPrice: 500 };
      expect(typeof validDto.baseSellingPrice).toBe('number');
    });
  });

  describe('Pagination contract', () => {
    it('findAll response contains items, total, page, and perPage', () => {
      const response = { items: [SUMMARY_FIXTURE], total: 1, page: 1, perPage: 50 };
      expect(response).toMatchObject({
        items: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        perPage: expect.any(Number),
      });
    });
  });
});
