import { Role, Locale, BusinessPartnerType, BpRole, ItemType, GLAccountType, DefaultVatType, WhtRate, DispensingCategory } from './enums';

// ─── Response Envelope ───────────────────────────────────────────────────────

export interface ApiMeta {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  meta: ApiMeta | null;
  error: ApiError | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ─── Session / Auth ───────────────────────────────────────────────────────────

export interface BranchSummary {
  id: string;
  name: string;
}

export interface UserContext {
  userId: string;
  clinicId: string | null;
  clinicName: string | null;
  clinicSlug: string | null;
  role: Role;
  permissions: string[];
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  preferredLocale: Locale;
  authorizedBranches: BranchSummary[];
  /** Optional linkage: the BP id of the logged-in user */
  businessPartnerId?: string | null;
  /** Currency code for the clinic (e.g. "THB") */
  currencyCode?: string | null;
  /** Epoch ms — used to enforce 12h absolute session expiry */
  issuedAt?: number;
}

export interface AuthProfile {
  id: string;
  name?: string;
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  role: Role;
  permissions: string[];
  clinicName: string | null;
  clinicSlug?: string | null;
  branches: BranchSummary[];
  preferredLocale: Locale;
  /** Optional BP linkage for the authenticated user */
  businessPartnerId?: string | null;
  /** Currency code for the clinic (e.g. "THB") */
  currencyCode?: string | null;
}

// ─── Common Query Params ──────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  perPage?: number;
}

export interface DateRangeQuery {
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

// ─── Business Partner DTOs ────────────────────────────────────────────────────

// Global TaxCode reference (seeded by system, no clinicId).
// VAT registration of a BP is inferred: isVatRegistered = defaultVatCode.isVatType
export interface TaxCodeResponse {
  id: string;
  code: string;          // e.g. "VAT7", "VAT0", "WHT3"
  description: string;
  rate: number;          // percentage, e.g. 7.0
  isVatType: boolean;    // true = VAT code; false = WHT code
  isZeroRated: boolean;  // true = 0% rate (zero-rated export or exempt)
  type: string;          // "VAT" or "WHT"
}

export interface BpVetPayload {
  licenseNumber: string;
  specialty?: string | null;
  defaultDfRate?: number | null;
}

export interface BpGroupResponse {
  id: string;
  name: string;
  prefix: string;
  currentSequence: number;
  isActive: boolean;
}

export interface BpContactPayload {
  id?: string;           // present for existing rows; absent for new rows
  name: string;
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  position?: string | null;
  isPrimary?: boolean;
}

export interface BpContactResponse {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  position: string | null;
  isPrimary: boolean;
}

// BpSupplier extension — vendor classification only.
// taxId and creditTermDays have moved to BusinessPartner core Thai fields.
export interface BpSupplierPayload {
  vendorGroupId?: string | null;
}

export interface CreateBusinessPartnerPayload {
  type: BusinessPartnerType;
  name: string;
  // Thai compliance core fields
  taxId?: string | null;          // 13-digit Thai TIN
  isHeadOffice?: boolean;
  branchCode?: string | null;     // 5-digit for non-HO branches
  addressLine1?: string | null;
  subDistrict?: string | null;
  district?: string | null;
  province?: string | null;
  zipcode?: string | null;
  // Hierarchy (same clinic)
  parentBpId?: string | null;
  // Tax defaults — runtime item-level VAT is driven by ItemMaster, not BP profile
  defaultVatCodeId?: string | null;
  defaultWhtCodeId?: string | null;
  // Payment defaults
  creditTermDays?: number;
  // ── Communication
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  // ── Commercial
  creditLimit?: number | null;
  creditHold?: boolean;
  discountGroupId?: string | null;
  // ── BpGroup & auto-code
  groupId?: string | null;
  // ── CRM
  isMarketingOptIn?: boolean;
  internalNotes?: string | null;
  alertMessage?: string | null;
  // ── Bank account
  bankAccountName?: string | null;
  bankAccountBranch?: string | null;
  bankAccountNumber?: string | null;
  // ── Contact persons
  contacts?: BpContactPayload[];
  // Infor LN role activation
  activeRoles?: BpRole[];
  linkUserId?: string | null;
  vet?: BpVetPayload | null;
  supplier?: BpSupplierPayload | null;
}

export interface UpdateBusinessPartnerPayload {
  name?: string;
  taxId?: string | null;
  isHeadOffice?: boolean;
  branchCode?: string | null;
  addressLine1?: string | null;
  subDistrict?: string | null;
  district?: string | null;
  province?: string | null;
  zipcode?: string | null;
  parentBpId?: string | null;
  defaultVatCodeId?: string | null;
  defaultWhtCodeId?: string | null;
  creditTermDays?: number;
  // ── Communication
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  // ── Commercial
  creditLimit?: number | null;
  creditHold?: boolean;
  discountGroupId?: string | null;
  // ── CRM (no groupId — immutable after creation)
  isMarketingOptIn?: boolean;
  internalNotes?: string | null;
  alertMessage?: string | null;
  // ── Bank account
  bankAccountName?: string | null;
  bankAccountBranch?: string | null;
  bankAccountNumber?: string | null;
  // ── Contact persons
  contacts?: BpContactPayload[];
  activeRoles?: BpRole[];
  linkUserId?: string | null;
  vet?: BpVetPayload | null;
  supplier?: BpSupplierPayload | null;
}

export interface BusinessPartnerListQuery {
  type?: BusinessPartnerType;
  search?: string;
  includeInactive?: boolean;
}

export interface BpUserSummary {
  id: string;
  role: Role;
  email: string | null;
  username: string | null;
}

export interface BpVetResponse {
  licenseNumber: string;
  specialty: string | null;
  defaultDfRate: number | null;
}

// Extension-only — vendor classification metadata.
export interface BpSupplierResponse {
  vendorGroupId: string | null;
}

export interface BusinessPartnerResponse {
  id: string;
  clinicId: string;
  type: BusinessPartnerType;
  name: string;
  // Thai compliance fields
  taxId: string | null;
  isHeadOffice: boolean;
  branchCode: string | null;
  addressLine1: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  zipcode: string | null;
  // Hierarchy
  parentBpId: string | null;
  // Tax defaults
  defaultVatCodeId: string | null;
  defaultWhtCodeId: string | null;
  /** Resolved TaxCode objects for display/inference — NOT invoice-level tax calculation */
  defaultVatCode: TaxCodeResponse | null;
  defaultWhtCode: TaxCodeResponse | null;
  /**
   * Inferred VAT registration status — derived from defaultVatCode.isVatType.
   * isVatRegistered is NOT a stored field; it must never be persisted or sent in payloads.
   * Item-level VAT applicability on invoices is driven by ItemMaster, not this flag.
   */
  isVatRegistered: boolean;
  // Payment defaults
  creditTermDays: number;
  // ── Communication
  phone: string | null;
  email: string | null;
  lineId: string | null;
  // ── Commercial
  creditLimit: number | null;
  creditHold: boolean;
  discountGroupId: string | null;
  // ── BpGroup & auto-code
  groupId: string | null;
  code: string | null;
  // ── CRM
  isMarketingOptIn: boolean;
  internalNotes: string | null;
  alertMessage: string | null;
  group: { id: string; name: string; prefix: string } | null;
  // ── Bank account
  bankAccountName: string | null;
  bankAccountBranch: string | null;
  bankAccountNumber: string | null;
  // ── Contact persons
  contacts: BpContactResponse[];
  activeRoles: BpRole[];
  isActive: boolean;
  user: BpUserSummary | null;
  vet: BpVetResponse | null;
  supplier: BpSupplierResponse | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Item Master (006-item-master) ────────────────────────────────────────────

export interface GLAccountResponse {
  id: string;
  code: string;
  name: string;
  type: GLAccountType;
  isActive: boolean;
}

export interface ItemCategoryResponse {
  id: string;
  name: string;
  code: string;
  revenueGlAccountId: string | null;
  expenseGlAccountId: string | null;
  revenueGlAccount: GLAccountResponse | null;
  expenseGlAccount: GLAccountResponse | null;
  isActive: boolean;
}

export interface UnitOfMeasureResponse {
  id: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
}

export interface ItemUnitConversionResponse {
  id: string;
  unitId: string;
  unit: UnitOfMeasureResponse;
  ratioToBase: number;
}

export interface ItemUnitConversionPayload {
  unitId: string;
  ratioToBase: number;
}

export interface ItemAccessoryResponse {
  childProductId: string;
  name?: string;
  code?: string;
  sku?: string | null;
  itemType?: ItemType;
  baseSellingPrice?: number;
  quantityRatio: number;
}

export interface ItemAccessoryPayload {
  childProductId: string;
  quantityRatio: number;
}

export interface ItemSummaryResponse {
  id: string;
  code: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  itemType: ItemType;
  category: { id: string; name: string } | null;
  baseUnit: { id: string; name: string; symbol: string | null } | null;
  standardCost: number;
  baseSellingPrice: number;
  isTaxInclusive: boolean;
  defaultTaxCode: { id: string; code: string; rate: number; type: string } | null;
  isControlledSubstance: boolean;
  requiresBatchAndExpiryTracking: boolean;
  defaultSupplier: { id: string; name: string } | null;
  defaultVatType: DefaultVatType;
  whtRate: WhtRate;
  dispensingCategory: DispensingCategory;
  revenueAccountId: string | null;
  cogsAccountId: string | null;
  inventoryAssetAccountId: string | null;
  isActive: boolean;
}

export interface BranchSettingResponse {
  id: string;
  branchId: string;
  isActive: boolean;
  retailPrice: number;
  movingAverageCost: number;
  updatedAt: string;
}

export interface BranchSettingPayload {
  branchId: string;
  isActive: boolean;
  retailPrice: number;
  movingAverageCost?: number;
}

export interface ItemDetailResponse extends ItemSummaryResponse {
  conversions: ItemUnitConversionResponse[];
  accessories?: ItemAccessoryResponse[];
  branchSettings?: BranchSettingResponse[];
  genericName: string | null;
  defaultDoctorFee: number | null;
  defaultSupplierId: string | null;
  defaultTaxCodeId: string | null;
  categoryId: string | null;
  baseUnitId: string | null;
  quantity: number;
  reorderPoint: number;
  minimumStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemPayload {
  code: string;
  name: string;
  itemType: ItemType;
  categoryId: string;
  baseUnitId: string;
  conversions?: ItemUnitConversionPayload[];
  accessories?: ItemAccessoryPayload[];
  branchSettings?: BranchSettingPayload[];
  standardCost: number;
  baseSellingPrice: number;
  isTaxInclusive?: boolean;
  defaultTaxCodeId?: string | null;
  genericName?: string | null;
  isControlledSubstance?: boolean;
  requiresBatchAndExpiryTracking?: boolean;
  defaultSupplierId?: string | null;
  defaultDoctorFee?: number | null;
  reorderPoint?: number;
  minimumStock?: number;
  barcode?: string | null;
  defaultVatType?: DefaultVatType;
  whtRate?: WhtRate;
  dispensingCategory?: DispensingCategory;
  revenueAccountId?: string | null;
  cogsAccountId?: string | null;
  inventoryAssetAccountId?: string | null;
}

export interface UpdateItemPayload {
  name?: string;
  categoryId?: string;
  baseUnitId?: string;
  conversions?: ItemUnitConversionPayload[];
  accessories?: ItemAccessoryPayload[];
  branchSettings?: BranchSettingPayload[];
  standardCost?: number;
  baseSellingPrice?: number;
  isTaxInclusive?: boolean;
  defaultTaxCodeId?: string | null;
  genericName?: string | null;
  isControlledSubstance?: boolean;
  requiresBatchAndExpiryTracking?: boolean;
  defaultSupplierId?: string | null;
  defaultDoctorFee?: number | null;
  reorderPoint?: number;
  minimumStock?: number;
  barcode?: string | null;
  isActive?: boolean;
  defaultVatType?: DefaultVatType;
  whtRate?: WhtRate;
  dispensingCategory?: DispensingCategory;
  revenueAccountId?: string | null;
  cogsAccountId?: string | null;
  inventoryAssetAccountId?: string | null;
}

export interface ListItemsQuery {
  search?: string;
  itemType?: ItemType;
  categoryId?: string;
  barcode?: string;
  includeInactive?: boolean;
  controlledSubstance?: boolean;
  page?: number;
  perPage?: number;
}

export interface ReferenceSelectorItem {
  id: string;
  name: string;
  code?: string;
  symbol?: string | null;
}
