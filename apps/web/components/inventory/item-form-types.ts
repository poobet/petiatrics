import { ItemType, DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';
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
  glAccounts: ReferenceSelectorItem[];
}

// ─── Form values (mirrors CreateItemPayload / UpdateItemPayload) ───────────────

export interface ItemConversionFormValue {
  unitId: string;
  ratioToBase: number | '';
}

export interface ItemAccessoryFormValue {
  childProductId: string;
  name?: string;
  code?: string;
  sku?: string;
  itemType?: ItemType;
  quantityRatio: number | '';
}

export interface BranchSettingFormValue {
  branchId: string;
  isActive: boolean;
  retailPrice: number | '';
  movingAverageCost: number | '';
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
  accessories: ItemAccessoryFormValue[];
  branchSettings: BranchSettingFormValue[];
  defaultVatType: DefaultVatType;
  whtRate: WhtRate;
  dispensingCategory: DispensingCategory;
  revenueAccountId: string;
  cogsAccountId: string;
  inventoryAssetAccountId: string;
}

export const ITEM_FORM_DEFAULTS: ItemFormValues = {
  code: '',
  name: '',
  itemType: ItemType.INVENTORY,
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
  accessories: [],
  branchSettings: [],
  defaultVatType: DefaultVatType.VAT_7,
  whtRate: WhtRate.WHT_0,
  dispensingCategory: DispensingCategory.General_Retail,
  revenueAccountId: '',
  cogsAccountId: '',
  inventoryAssetAccountId: '',
};
