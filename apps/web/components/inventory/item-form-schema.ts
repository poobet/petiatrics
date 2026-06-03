import { ItemType } from '@petiatrics/types';
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
      values.itemType === ItemType.STOCKED_GOOD ? values.requiresBatchAndExpiryTracking : false,
    standardCost: Number(values.standardCost) || 0,
    baseSellingPrice: Number(values.baseSellingPrice) || 0,
    isTaxInclusive: values.isTaxInclusive,
    defaultTaxCodeId: values.defaultTaxCodeId || null,
    defaultSupplierId:
      values.itemType === ItemType.STOCKED_GOOD ? values.defaultSupplierId || null : null,
    defaultDoctorFee:
      values.itemType === ItemType.SERVICE ? (Number(values.defaultDoctorFee) || null) : null,
    reorderPoint:
      values.itemType === ItemType.STOCKED_GOOD ? Number(values.reorderPoint) || 0 : 0,
    minimumStock:
      values.itemType === ItemType.STOCKED_GOOD ? Number(values.minimumStock) || 0 : 0,
    barcode: values.barcode.trim() || null,
    conversions: values.conversions
      .filter((c) => c.unitId && Number(c.ratioToBase) > 0)
      .map((c) => ({ unitId: c.unitId, ratioToBase: Number(c.ratioToBase) })),
    accessories: values.accessories
      .filter((a) => a.childProductId && Number(a.quantityRatio) > 0)
      .map((a) => ({ childProductId: a.childProductId, quantityRatio: Number(a.quantityRatio) })),
  };
}
