import { describe, it, expect } from 'vitest';
import { ItemType, DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';
import { validateItemForm, toApiPayload } from './item-form-schema';
import type { ItemFormValues } from './item-form-types';
import { ITEM_FORM_DEFAULTS } from './item-form-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validStockedGood(overrides: Partial<ItemFormValues> = {}): ItemFormValues {
  return {
    ...ITEM_FORM_DEFAULTS,
    code: 'MED-001',
    name: 'Test Medication',
    itemType: ItemType.INVENTORY,
    categoryId: 'cat-001',
    baseUnitId: 'unit-001',
    standardCost: 100,
    baseSellingPrice: 180,
    ...overrides,
  };
}

function validServiceItem(overrides: Partial<ItemFormValues> = {}): ItemFormValues {
  return {
    ...ITEM_FORM_DEFAULTS,
    code: 'SVC-001',
    name: 'Test Consultation',
    itemType: ItemType.SERVICE,
    categoryId: 'cat-consultation',
    baseUnitId: 'unit-visit',
    baseSellingPrice: 500,
    standardCost: 0,
    ...overrides,
  };
}

// ─── validateItemForm ─────────────────────────────────────────────────────────

describe('validateItemForm()', () => {
  it('returns no errors for a valid stocked good', () => {
    expect(validateItemForm(validStockedGood())).toHaveLength(0);
  });

  it('returns no errors for a valid service item', () => {
    expect(validateItemForm(validServiceItem())).toHaveLength(0);
  });

  it('requires code', () => {
    const errors = validateItemForm(validStockedGood({ code: '' }));
    expect(errors.some((e) => e.field === 'code')).toBe(true);
  });

  it('requires name', () => {
    const errors = validateItemForm(validStockedGood({ name: '' }));
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('requires categoryId', () => {
    const errors = validateItemForm(validStockedGood({ categoryId: '' }));
    expect(errors.some((e) => e.field === 'categoryId')).toBe(true);
  });

  it('requires baseUnitId', () => {
    const errors = validateItemForm(validStockedGood({ baseUnitId: '' }));
    expect(errors.some((e) => e.field === 'baseUnitId')).toBe(true);
  });

  it('rejects negative standardCost', () => {
    const errors = validateItemForm(validStockedGood({ standardCost: -1 }));
    expect(errors.some((e) => e.field === 'standardCost')).toBe(true);
  });

  it('rejects negative baseSellingPrice', () => {
    const errors = validateItemForm(validStockedGood({ baseSellingPrice: -5 }));
    expect(errors.some((e) => e.field === 'baseSellingPrice')).toBe(true);
  });

  it('accepts zero standardCost (valid for services)', () => {
    const errors = validateItemForm(validServiceItem({ standardCost: 0 }));
    expect(errors.some((e) => e.field === 'standardCost')).toBe(false);
  });

  describe('unit conversions', () => {
    it('requires unitId on each conversion', () => {
      const errors = validateItemForm(
        validStockedGood({
          conversions: [{ unitId: '', ratioToBase: 12 }],
        }),
      );
      expect(errors.some((e) => e.field === 'conversions.0.unitId')).toBe(true);
    });

    it('requires positive ratioToBase on each conversion', () => {
      const errors = validateItemForm(
        validStockedGood({
          conversions: [{ unitId: 'unit-box', ratioToBase: 0 }],
        }),
      );
      expect(errors.some((e) => e.field === 'conversions.0.ratioToBase')).toBe(true);
    });

    it('accepts valid conversion rows', () => {
      const errors = validateItemForm(
        validStockedGood({
          conversions: [{ unitId: 'unit-box', ratioToBase: 12 }],
        }),
      );
      expect(errors).toHaveLength(0);
    });
  });
});

// ─── toApiPayload ─────────────────────────────────────────────────────────────

describe('toApiPayload()', () => {
  it('normalizes code to uppercase trimmed', () => {
    const payload = toApiPayload(validStockedGood({ code: '  med-001  ' }));
    expect(payload.code).toBe('MED-001');
  });

  it('trims name', () => {
    const payload = toApiPayload(validStockedGood({ name: '  Test Drug  ' }));
    expect(payload.name).toBe('Test Drug');
  });

  it('converts standardCost string to number', () => {
    const payload = toApiPayload(validStockedGood({ standardCost: 100 }));
    expect(typeof payload.standardCost).toBe('number');
    expect(payload.standardCost).toBe(100);
  });

  it('sets requiresBatchAndExpiryTracking=false for SERVICE items', () => {
    const payload = toApiPayload(validServiceItem({ requiresBatchAndExpiryTracking: true }));
    expect(payload.requiresBatchAndExpiryTracking).toBe(false);
  });

  it('sets defaultSupplierId=null for SERVICE items', () => {
    const payload = toApiPayload(validServiceItem({ defaultSupplierId: 'bp-001' }));
    expect(payload.defaultSupplierId).toBeNull();
  });

  it('sets defaultDoctorFee=null for INVENTORY items', () => {
    const payload = toApiPayload(validStockedGood({ defaultDoctorFee: 200 }));
    expect(payload.defaultDoctorFee).toBeNull();
  });

  it('sets reorderPoint=0 for SERVICE items', () => {
    const payload = toApiPayload(validServiceItem({ reorderPoint: 10 }));
    expect(payload.reorderPoint).toBe(0);
  });

  it('filters out incomplete conversion rows', () => {
    const payload = toApiPayload(
      validStockedGood({
        conversions: [
          { unitId: 'unit-box', ratioToBase: 12 },
          { unitId: '', ratioToBase: 5 }, // incomplete — no unit
          { unitId: 'unit-vial', ratioToBase: 0 }, // invalid ratio
        ],
      }),
    );
    expect(payload.conversions).toHaveLength(1);
    expect(payload.conversions[0]).toEqual({ unitId: 'unit-box', ratioToBase: 12 });
  });

  it('sets genericName to null when empty', () => {
    const payload = toApiPayload(validStockedGood({ genericName: '' }));
    expect(payload.genericName).toBeNull();
  });

  it('maps compliance and GL fields to payload', () => {
    const payload = toApiPayload(
      validStockedGood({
        defaultVatType: DefaultVatType.VAT_EXEMPT,
        whtRate: WhtRate.WHT_3,
        dispensingCategory: DispensingCategory.Dangerous_Drug,
        revenueAccountId: 'rev-id',
        cogsAccountId: 'cogs-id',
        inventoryAssetAccountId: 'asset-id',
      }),
    );
    expect(payload.defaultVatType).toBe(DefaultVatType.VAT_EXEMPT);
    expect(payload.whtRate).toBe(WhtRate.WHT_3);
    expect(payload.dispensingCategory).toBe(DispensingCategory.Dangerous_Drug);
    expect(payload.revenueAccountId).toBe('rev-id');
    expect(payload.cogsAccountId).toBe('cogs-id');
    expect(payload.inventoryAssetAccountId).toBe('asset-id');
  });

  it('sets COGS and Inventory Asset accounts to null for service items', () => {
    const payload = toApiPayload(
      validServiceItem({
        revenueAccountId: 'rev-id',
        cogsAccountId: 'cogs-id',
        inventoryAssetAccountId: 'asset-id',
      }),
    );
    expect(payload.revenueAccountId).toBe('rev-id');
    expect(payload.cogsAccountId).toBeNull();
    expect(payload.inventoryAssetAccountId).toBeNull();
  });
});

describe('validateItemForm() compliance validation', () => {
  it('rejects invalid defaultVatType', () => {
    const errors = validateItemForm(validStockedGood({ defaultVatType: 'INVALID' as any }));
    expect(errors.some((e) => e.field === 'defaultVatType')).toBe(true);
  });

  it('rejects invalid whtRate', () => {
    const errors = validateItemForm(validStockedGood({ whtRate: 'INVALID' as any }));
    expect(errors.some((e) => e.field === 'whtRate')).toBe(true);
  });

  it('rejects invalid dispensingCategory', () => {
    const errors = validateItemForm(validStockedGood({ dispensingCategory: 'INVALID' as any }));
    expect(errors.some((e) => e.field === 'dispensingCategory')).toBe(true);
  });

  it('rejects invalid or negative branch settings', () => {
    const errors = validateItemForm(
      validStockedGood({
        branchSettings: [
          { branchId: '', isActive: true, retailPrice: 10, movingAverageCost: 5 }, // missing branchId
          { branchId: 'b1', isActive: true, retailPrice: -5, movingAverageCost: 5 }, // negative retailPrice
          { branchId: 'b2', isActive: true, retailPrice: 10, movingAverageCost: -1 }, // negative movingAverageCost
        ],
      }),
    );
    expect(errors.some((e) => e.field === 'branchSettings.0.branchId')).toBe(true);
    expect(errors.some((e) => e.field === 'branchSettings.1.retailPrice')).toBe(true);
    expect(errors.some((e) => e.field === 'branchSettings.2.movingAverageCost')).toBe(true);
  });
});

describe('toApiPayload() branch settings mapping', () => {
  it('maps branchSettings correctly to payload', () => {
    const payload = toApiPayload(
      validStockedGood({
        branchSettings: [
          { branchId: 'b1', isActive: true, retailPrice: 120.5, movingAverageCost: 80.0 },
          { branchId: 'b2', isActive: false, retailPrice: 0, movingAverageCost: 0 },
        ],
      }),
    );
    expect(payload.branchSettings).toHaveLength(2);
    expect(payload.branchSettings?.[0]).toEqual({
      branchId: 'b1',
      isActive: true,
      retailPrice: 120.5,
      movingAverageCost: 80.0,
    });
    expect(payload.branchSettings?.[1]).toEqual({
      branchId: 'b2',
      isActive: false,
      retailPrice: 0,
      movingAverageCost: 0,
    });
  });
});
