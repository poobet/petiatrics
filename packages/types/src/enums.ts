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
  STOCKED_GOOD = 'STOCKED_GOOD',
  SERVICE = 'SERVICE',
}

export enum AuditOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VOID = 'void',
  AMEND = 'amend',
  STATUS_CHANGE = 'status_change',
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

