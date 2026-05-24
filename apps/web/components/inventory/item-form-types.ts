import { ItemType } from '@petiatrics/types';
import type {
  ItemCategoryResponse,
  UnitOfMeasureResponse,
  ReferenceSelectorItem,
} from '@petiatrics/types';

// ─── Reference data passed into form ──────────────────────────────────────────

export interface ItemFormReferenceData {
  categories: ItemCategoryResponse[];
  units: UnitOfMeasureResponse[];
  taxCodes: ReferenceSelectorItem[];
  suppliers: ReferenceSelectorItem[];
}

// ─── Form values (mirrors CreateItemPayload / UpdateItemPayload) ───────────────

export interface ItemConversionFormValue {
  unitId: string;
  ratioToBase: number | '';
}

export interface ItemFormValues {
  code: string;
  name: string;
  itemType: ItemType;
  categoryId: string;
  baseUnitId: string;
  genericName: string;
  isControlledSubstance: boolean;
  requiresBatchAndExpiryTracking: boolean;
  standardCost: number | '';
  baseSellingPrice: number | '';
  isTaxInclusive: boolean;
  defaultTaxCodeId: string;
  defaultSupplierId: string;
  defaultDoctorFee: number | '';
  reorderPoint: number | '';
  minimumStock: number | '';
  sku: string;
  barcode: string;
  conversions: ItemConversionFormValue[];
}

export const ITEM_FORM_DEFAULTS: ItemFormValues = {
  code: '',
  name: '',
  itemType: ItemType.STOCKED_GOOD,
  categoryId: '',
  baseUnitId: '',
  genericName: '',
  isControlledSubstance: false,
  requiresBatchAndExpiryTracking: false,
  standardCost: '',
  baseSellingPrice: '',
  isTaxInclusive: false,
  defaultTaxCodeId: '',
  defaultSupplierId: '',
  defaultDoctorFee: '',
  reorderPoint: 0,
  minimumStock: 0,
  sku: '',
  barcode: '',
  conversions: [],
};
