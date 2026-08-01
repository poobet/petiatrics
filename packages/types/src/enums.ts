// Shared enums across API and web packages.
// These mirror the Prisma enums in packages/database/prisma/schema.prisma.

export enum SubscriptionTier {
  FREE = 'FREE',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
}

export enum ClinicStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  CLINIC_OWNER = 'CLINIC_OWNER',
  VET = 'VET',
  ASSISTANT = 'ASSISTANT',
  CASHIER = 'CASHIER',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

export enum UserStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
  PENDING = 'PENDING',
}

export enum Locale {
  TH = 'TH',
  EN = 'EN',
}

export enum AppointmentStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VisitStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
  AMENDED = 'amended',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  VOIDED = 'VOIDED',
}

export enum StockMovementReason {
  DISPENSE = 'DISPENSE',
  REPLENISH = 'REPLENISH',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

export enum InvoiceLineItemType {
  SERVICE = 'SERVICE',
  PRODUCT = 'PRODUCT',
}

export enum GLAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  COGS = 'COGS',
}

export enum ItemType {
  INVENTORY = 'INVENTORY',
  SERVICE = 'SERVICE',
  CONSUMABLE = 'CONSUMABLE',
}

/** Default VAT classification on the Product master (Thai RD context rules). */
export enum DefaultVatType {
  VAT_7 = 'VAT_7',         // Standard 7% VAT
  VAT_EXEMPT = 'VAT_EXEMPT', // Legally exempt (registered animal food/drugs)
  NON_VAT = 'NON_VAT',     // Out of VAT scope
}

/** Withholding Tax rates (for procurement / outsourced services). */
export enum WhtRate {
  WHT_0 = 'WHT_0',   // 0%
  WHT_1 = 'WHT_1',   // 1% transport / delivery
  WHT_3 = 'WHT_3',   // 3% services / consulting
}

/** Legal dispensing category — enforces Thai FDA and Veterinary Profession Act rules at POS. */
export enum DispensingCategory {
  General_Retail = 'General_Retail',
  Household_Remedy = 'Household_Remedy',
  Dangerous_Drug = 'Dangerous_Drug',
  Specially_Controlled_Drug = 'Specially_Controlled_Drug',
  Clinic_Use_Only = 'Clinic_Use_Only',
}

export enum AuditOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VOID = 'void',
  AMEND = 'amend',
  STATUS_CHANGE = 'status_change',
  PASSWORD_RESET = 'password_reset',
  CLOSE = 'close',
  REOPEN = 'reopen',
  CREATE_CREDIT_NOTE = 'create_credit_note',
  CREATE_ADJUSTMENT = 'create_adjustment',
}

// 8 Infor LN partner roles — AR side (receivables) and AP side (payables).
// Mirrors the BpRole enum in schema.prisma.
export enum BpRole {
  AR_SOLD_TO = 'AR_SOLD_TO',
  AR_SHIP_TO = 'AR_SHIP_TO',
  AR_INVOICE_TO = 'AR_INVOICE_TO',
  AR_PAY_BY = 'AR_PAY_BY',
  AP_BUY_FROM = 'AP_BUY_FROM',
  AP_SHIP_FROM = 'AP_SHIP_FROM',
  AP_INVOICE_FROM = 'AP_INVOICE_FROM',
  AP_PAY_TO = 'AP_PAY_TO',
}

export enum BusinessPartnerType {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  VET = 'VET',
  SUPPLIER = 'SUPPLIER',
  OTHER = 'OTHER',
}

// System-level role codes (non-clinic-scoped — these bypass normal permission checks)
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;
export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

// Reserved role codes that clinics cannot delete or rename
export const SYSTEM_ROLE_CODES = [
  'CLINIC_OWNER', 'VET', 'CASHIER', 'STAFF', 'ASSISTANT',
  'SUPER_ADMIN', 'CUSTOMER',
] as const;


