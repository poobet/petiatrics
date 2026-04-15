# Data Model: Identity & Business Partner Architecture

## Overview

This feature adds a new relational Business Partner aggregate to the existing identity schema and connects it to the current clinic, branch, and user model. The main design objective is to preserve strict tenant isolation while allowing business actors to exist with or without system login credentials.

---

## Relational Changes (PostgreSQL via Prisma)

### TaxCode (new)

**Purpose**: Master table defining all applicable Taxes (VAT, WHT) to ensure compliance and avoid hardcoded rates.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `code` | `String` | required, unique | e.g. "VAT7", "VAT0", "WHT3" |
| `isVatType` | `Boolean` | required | Indicates if this is a VAT tax |
| `isZeroRated` | `Boolean` | required | Indicates if 0% rate (eg. zero-rated exports or exempt) |
| `rate` | `Decimal` | required | Percentage rate (e.g. 7.00) |
| `type` | `String` | required | "VAT" or "WHT" |

---

### BusinessPartner (modified)

**Purpose**: Root master-data record for customers, staff, vets, suppliers, and other clinic-associated parties. Implements Enterprise-Grade Thai Business Partner Architecture.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `clinicId` | `String` | FK to `Clinic.id`, indexed | Tenant boundary |
| `type` | `BpType` | required | Root BP category |
| `name` | `String` | required | Display name |
| `taxId` | `String?` | 13 digits | Thai compliance: Tax Identification Number |
| `isHeadOffice` | `Boolean` | `@default(true)` | Thai compliance: Is Head Office |
| `branchCode` | `String?` | 5 digits | Thai compliance: Branch code |
| `addressLine1` | `String?` | | Structured Address: House No., Building, Street |
| `subDistrict` | `String?` | | Structured Address |
| `district` | `String?` | | Structured Address |
| `province` | `String?` | | Structured Address |
| `zipcode` | `String?` | | Structured Address |
| `parentBpId` | `String?` | FK to `BusinessPartner.id` | Hierarchy: Link to parent BP (e.g., Head Office) |
| `defaultVatCodeId`| `String?` | FK to `TaxCode.id` | Financial: Default VAT Code |
| `defaultWhtCodeId`| `String?` | FK to `TaxCode.id` | Financial: Default WHT Code |
| `creditTermDays` | `Int` | `@default(0)` | Financial: Default credit terms |
| `isActive` | `Boolean` | `@default(true)` | Soft-delete flag |
| `createdAt` | `DateTime` | `@default(now())` | Audit support |
| `updatedAt` | `DateTime` | `@updatedAt` | Audit support |

*Note: The `isVatRegistered` boolean field has been explicitly **DEPRECATED and REMOVED**. VAT registration status is now inferred via the `defaultVatCodeId` relation.*

**Relationships**:

- `Clinic 1 -> many BusinessPartner`
- `BusinessPartner 1 -> 0..1 User`
- `BusinessPartner 1 -> 0..1 BpVet`
- `BusinessPartner 1 -> 0..1 BpSupplier`
- `BusinessPartner 1 -> many BpRoleActive`
- `BusinessPartner (parent) 1 -> many BusinessPartner (children)`
- `TaxCode 1 -> many BusinessPartner`

**Indexes**:

- `@@index([clinicId])`
- `@@index([clinicId, isActive])`

---

### BpRoleActive (new)

**Purpose**: Junction table to map a Business Partner to the 8 standard Infor LN roles.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `bpId` | `String` | FK to `BusinessPartner.id` | The Business Partner |
| `role` | `BpRole` | required | AR/AP specific role |

*Valid Roles (Infor LN standard):*
- AR (Accounts Receivable): `AR_SOLD_TO`, `AR_SHIP_TO`, `AR_INVOICE_TO`, `AR_PAY_BY`
- AP (Accounts Payable): `AP_BUY_FROM`, `AP_SHIP_FROM`, `AP_INVOICE_FROM`, `AP_PAY_TO`

### BpVet (new)

**Purpose**: Veterinary-specific attributes attached to a BP.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `bpId` | `String` | PK + FK to `BusinessPartner.id` | 1:1 extension |
| `licenseNumber` | `String` | unique | Must be unique across active and inactive rows |

**Validation rules**:

- `licenseNumber` required when `BusinessPartner.type = VET`
- `whtRate` has been **DEPRECATED and REMOVED** — WHT defaults are now set via `BusinessPartner.defaultWhtCodeId`

---

### BpSupplier (modified)

**Purpose**: Supplier-specific extensions attached to a BP. General financial fields (`taxId`, `creditTermDays`) have been lifted up to `BusinessPartner`.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `bpId` | `String` | PK + FK to `BusinessPartner.id` | 1:1 extension |
| `vendorGroupId` | `String?`| optional | Supplier grouping if needed |

---

### User (modified)

The current `User` model remains the system-login record but gains optional linkage to a BP.

| Field | Before | After | Notes |
|------|--------|-------|------|
| `businessPartnerId` | absent | `String?` + unique FK | Optional link to BP |
| `email` | `String? @unique` | unchanged | Still optional for some users |
| `username` | `String? @unique` | unchanged | Existing login approach remains valid |
| `role` | existing enum | unchanged enum | BP permissions are policy-level, not enum-level |

**Validation rules**:

- A `User` with BP linkage must reference a BP from the same clinic unless the user is a global `SUPER_ADMIN`
- BP linkage is optional so existing users can migrate incrementally
- BP creation does not require a linked user account

---

### Clinic and Branch (unchanged structure, new usage)

- `Clinic` remains the tenant boundary and now owns BP records in addition to users, branches, products, and other future business data.
- `Branch` is still validated via `x-active-branch` for protected requests. BP operations remain clinic-scoped, but route access still requires valid branch context for authenticated clinic users.

---

## Enumerations

### BpType (new)

Recommended enum values for this slice:

```text
CUSTOMER
STAFF
VET
SUPPLIER
OTHER
```

`OTHER` prevents premature schema churn for business actors that do not yet need a dedicated extension table.

---

## Authorization Matrix

| Role | View BP | Create/Edit BP | Soft-delete BP |
|------|---------|----------------|----------------|
| `SUPER_ADMIN` | Yes | Yes | Yes |
| `CLINIC_OWNER` | Yes | Yes | Yes |
| `STAFF` | Yes | Yes | No by default unless explicitly allowed in service policy |
| `VET` | Yes | No | No |
| `CASHIER` | Yes | No | No |
| `ASSISTANT` | Yes | No | No |

`ASSISTANT` is included here because it exists in the current schema even though the feature spec does not mention it.

---

## Query Modes

To satisfy the soft-delete requirement without leaking inactive rows into normal workflows, service methods should separate query intent:

1. `listActiveByClinic(clinicId, filters)`
2. `getByIdForManagement(id, clinicId)` including inactive rows
3. `findForReference(id, clinicId)` for future historical-document lookups

This avoids a single overloaded list endpoint that mixes active and inactive semantics.

---

## Session / Auth Implications

### UserContext (potential extension)

The current session payload already includes `role`, `clinicId`, and `authorizedBranches`. If linked-user flows need BP awareness in the UI, extend the auth profile and session payload with:

| Field | Type | Notes |
|------|------|------|
| `businessPartnerId` | `string | null` | Optional BP linkage for the logged-in user |

This is additive and backward-compatible.

### Session Expiry Model

The feature requires:

- absolute expiry: 12 hours from login
- idle expiry: 1 hour since last valid authenticated request

Recommended session payload additions if the current implementation only stores one Redis TTL:

| Field | Type | Notes |
|------|------|------|
| `issuedAt` | epoch ms | Used to enforce 12h absolute max |
| `lastSeenAt` | epoch ms | Optional audit/debug field |

Redis key expiry can then track idle time, while service logic rejects sessions older than 12 hours even if the key still exists.

---

## Suggested Prisma Summary Diff

```prisma
enum BpType {
  CUSTOMER
  STAFF
  VET
  SUPPLIER
  OTHER
}

enum BpRole {
  SOLD_TO
  SHIP_TO
  INVOICE_TO
  PAY_BY
  BUY_FROM
  SHIP_FROM
  INVOICE_FROM
  PAY_TO
}

model TaxCode {
  id          String   @id @default(uuid())
  code        String   @unique
  isVatType   Boolean
  isZeroRated Boolean
  rate        Decimal  @db.Decimal(5, 2)
  type        String
  
  vats        BusinessPartner[] @relation("DefaultVat")
  whts        BusinessPartner[] @relation("DefaultWht")
  
  @@map("tax_codes")
}

model BusinessPartner {
  id               String       @id @default(uuid())
  clinicId         String
  type             BpType
  name             String
  
  taxId            String?      @db.VarChar(13)
  isHeadOffice     Boolean      @default(true)
  branchCode       String?      @db.VarChar(5)
  parentBpId       String?
  addressLine1     String?
  subDistrict      String?
  district         String?
  province         String?
  zipcode          String?
  defaultVatCodeId String?
  defaultWhtCodeId String?
  creditTermDays   Int          @default(0)

  isActive         Boolean      @default(true)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  clinic           Clinic       @relation(fields: [clinicId], references: [id])
  parent           BusinessPartner? @relation("Hierarchy", fields: [parentBpId], references: [id])
  children         BusinessPartner[] @relation("Hierarchy")
  
  defaultVat       TaxCode?     @relation("DefaultVat", fields: [defaultVatCodeId], references: [id])
  defaultWht       TaxCode?     @relation("DefaultWht", fields: [defaultWhtCodeId], references: [id])

  user             User?
  vetExt           BpVet?
  suppExt          BpSupplier?
  roles            BpRoleActive[]

  @@index([clinicId])
  @@index([clinicId, isActive])
  @@index([clinicId, type, isActive])
  @@map("business_partners")
}

model BpRoleActive {
  id        String          @id @default(uuid())
  bpId      String
  role      BpRole

  bp        BusinessPartner @relation(fields: [bpId], references: [id])
  
  @@index([bpId, role])
  @@map("bp_role_active")
}

model BpVet {
  bpId          String          @id
  licenseNumber String          @unique
  whtRate       Decimal         @default(3.00) @db.Decimal(5, 2)

  bp            BusinessPartner @relation(fields: [bpId], references: [id])

  @@map("bp_vet")
}

model BpSupplier {
  bpId           String          @id
  vendorGroupId  String?

  bp             BusinessPartner @relation(fields: [bpId], references: [id])

  @@map("bp_supplier")
}

model User {
  // existing fields...
  businessPartnerId String? @unique

  businessPartner   BusinessPartner? @relation(fields: [businessPartnerId], references: [id])
}
```

---

## Migration Notes

1. Add BP tables first, then the optional `User.businessPartnerId` relation
2. Do not make BP linkage mandatory in the first migration
3. Seed at least one BP of each supported type for test and local verification
4. Ensure inactive BPs remain selectable in direct detail queries for future downstream references
5. Re-run Prisma client generation before touching NestJS services or DTO mapping code