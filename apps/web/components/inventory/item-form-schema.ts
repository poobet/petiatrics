import { ItemType, DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';
import type { ItemFormValues } from './item-form-types';

export interface ValidationError {
  field: keyof ItemFormValues | string;
  message: string;
}

export function validateItemForm(values: ItemFormValues): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!values.code.trim()) errors.push({ field: 'code', message: 'Item code is required.' });
  if (!values.name.trim()) errors.push({ field: 'name', message: 'Item name is required.' });
  if (!values.itemType) errors.push({ field: 'itemType', message: 'Item type is required.' });
  if (!values.categoryId) errors.push({ field: 'categoryId', message: 'Category is required.' });
  if (!values.baseUnitId) errors.push({ field: 'baseUnitId', message: 'Base unit is required.' });

  if (values.standardCost === '' || Number(values.standardCost) < 0) {
    errors.push({ field: 'standardCost', message: 'Standard cost must be ≥ 0.' });
  }
  if (values.baseSellingPrice === '' || Number(values.baseSellingPrice) < 0) {
    errors.push({ field: 'baseSellingPrice', message: 'Selling price must be ≥ 0.' });
  }

  // Validate Compliance / Taxes enums
  if (!values.defaultVatType || !Object.values(DefaultVatType).includes(values.defaultVatType)) {
    errors.push({ field: 'defaultVatType', message: 'Invalid Default VAT type selection.' });
  }
  if (!values.whtRate || !Object.values(WhtRate).includes(values.whtRate)) {
    errors.push({ field: 'whtRate', message: 'Invalid Withholding Tax rate selection.' });
  }
  if (!values.dispensingCategory || !Object.values(DispensingCategory).includes(values.dispensingCategory)) {
    errors.push({ field: 'dispensingCategory', message: 'Invalid Dispensing category selection.' });
  }

  for (let i = 0; i < values.conversions.length; i++) {
    const c = values.conversions[i];
    if (!c.unitId) errors.push({ field: `conversions.${i}.unitId`, message: `Conversion ${i + 1}: unit is required.` });
    if (c.ratioToBase === '' || Number(c.ratioToBase) <= 0) {
      errors.push({ field: `conversions.${i}.ratioToBase`, message: `Conversion ${i + 1}: ratio must be > 0.` });
    }
  }

  for (let i = 0; i < values.accessories.length; i++) {
    const a = values.accessories[i];
    if (!a.childProductId) {
      errors.push({ field: `accessories.${i}.childProductId`, message: `Accessory ${i + 1}: child product is required.` });
    }
    if (a.quantityRatio === '' || Number(a.quantityRatio) <= 0) {
      errors.push({ field: `accessories.${i}.quantityRatio`, message: `Accessory ${i + 1}: ratio must be > 0.` });
    }
  }

  if (values.branchSettings) {
    for (let i = 0; i < values.branchSettings.length; i++) {
      const bs = values.branchSettings[i];
      if (!bs.branchId) {
        errors.push({ field: `branchSettings.${i}.branchId`, message: `Branch setting ${i + 1}: Branch ID is required.` });
      }
      if (bs.retailPrice === '' || Number(bs.retailPrice) < 0) {
        errors.push({
          field: `branchSettings.${i}.retailPrice`,
          message: `Branch setting ${i + 1}: Retail price must be ≥ 0.`,
        });
      }
      if (bs.movingAverageCost === '' || Number(bs.movingAverageCost) < 0) {
        errors.push({
          field: `branchSettings.${i}.movingAverageCost`,
          message: `Branch setting ${i + 1}: Moving average cost must be ≥ 0.`,
        });
      }
    }
  }

  return errors;
}

/** Map form values to CreateItemPayload / UpdateItemPayload shape for API submission. */
export function toApiPayload(values: ItemFormValues) {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    itemType: values.itemType,
    categoryId: values.categoryId || undefined,
    baseUnitId: values.baseUnitId || undefined,
    genericName: values.genericName.trim() || null,
    isControlledSubstance: values.isControlledSubstance,
    requiresBatchAndExpiryTracking:
      values.itemType === ItemType.INVENTORY ? values.requiresBatchAndExpiryTracking : false,
    standardCost: Number(values.standardCost) || 0,
    baseSellingPrice: Number(values.baseSellingPrice) || 0,
    isTaxInclusive: values.isTaxInclusive,
    defaultTaxCodeId: values.defaultTaxCodeId || null,
    defaultSupplierId:
      values.itemType === ItemType.INVENTORY ? values.defaultSupplierId || null : null,
    defaultDoctorFee:
      values.itemType === ItemType.SERVICE ? (Number(values.defaultDoctorFee) || null) : null,
    reorderPoint:
      values.itemType === ItemType.INVENTORY ? Number(values.reorderPoint) || 0 : 0,
    minimumStock:
      values.itemType === ItemType.INVENTORY ? Number(values.minimumStock) || 0 : 0,
    barcode: values.barcode.trim() || null,
    conversions: values.conversions
      .filter((c) => c.unitId && Number(c.ratioToBase) > 0)
      .map((c) => ({ unitId: c.unitId, ratioToBase: Number(c.ratioToBase) })),
    accessories: values.accessories
      .filter((a) => a.childProductId && Number(a.quantityRatio) > 0)
      .map((a) => ({ childProductId: a.childProductId, quantityRatio: Number(a.quantityRatio) })),
    branchSettings: values.branchSettings?.map((s) => ({
      branchId: s.branchId,
      isActive: s.isActive,
      retailPrice: Number(s.retailPrice) || 0,
      movingAverageCost: Number(s.movingAverageCost) || 0,
    })),
    defaultVatType: values.defaultVatType,
    whtRate: values.whtRate,
    dispensingCategory: values.dispensingCategory,
    revenueAccountId: values.revenueAccountId || null,
    cogsAccountId: values.itemType === ItemType.INVENTORY ? (values.cogsAccountId || null) : null,
    inventoryAssetAccountId: values.itemType === ItemType.INVENTORY ? (values.inventoryAssetAccountId || null) : null,
  };
}
