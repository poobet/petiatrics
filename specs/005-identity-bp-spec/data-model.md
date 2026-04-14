# Data Model: Identity & Business Partner Architecture

## Overview

This feature adds a new relational Business Partner aggregate to the existing identity schema and connects it to the current clinic, branch, and user model. The main design objective is to preserve strict tenant isolation while allowing business actors to exist with or without system login credentials.

---

## Relational Changes (PostgreSQL via Prisma)

### BusinessPartner (new)

**Purpose**: Root master-data record for customers, staff, vets, suppliers, and other clinic-associated parties.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `clinicId` | `String` | FK to `Clinic.id`, indexed | Tenant boundary |
| `type` | `BpType` | required | Root BP category |
| `name` | `String` | required | Display name |
| `isActive` | `Boolean` | `@default(true)` | Soft-delete flag |
| `createdAt` | `DateTime` | `@default(now())` | Audit support |
| `updatedAt` | `DateTime` | `@updatedAt` | Audit support |

**Relationships**:

- `Clinic 1 -> many BusinessPartner`
- `BusinessPartner 1 -> 0..1 User`
- `BusinessPartner 1 -> 0..1 BpVet`
- `BusinessPartner 1 -> 0..1 BpSupplier`

**Indexes**:

- `@@index([clinicId])`
- `@@index([clinicId, isActive])`
- optional `@@index([clinicId, type, isActive])` for filtered lists

---

### BpVet (new)

**Purpose**: Veterinary-specific attributes attached to a BP.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `bpId` | `String` | PK + FK to `BusinessPartner.id` | 1:1 extension |
| `licenseNumber` | `String` | unique | Must be unique across active and inactive rows |
| `whtRate` | `Decimal` | `@default(3.00)` | Withholding tax rate |

**Validation rules**:

- `licenseNumber` required when `BusinessPartner.type = VET`
- `whtRate` defaults to `3.00` and must be non-negative

---

### BpSupplier (new)

**Purpose**: Supplier-specific regulatory and payment terms attached to a BP.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `bpId` | `String` | PK + FK to `BusinessPartner.id` | 1:1 extension |
| `taxId` | `String` | required | Supplier tax identifier |
| `creditTermDays` | `Int` | required | Payment terms |

**Validation rules**:

- `taxId` required when `BusinessPartner.type = SUPPLIER`
- `creditTermDays` must be `>= 0`

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

model BusinessPartner {
  id        String       @id @default(uuid())
  clinicId  String
  type      BpType
  name      String
  isActive  Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  clinic    Clinic       @relation(fields: [clinicId], references: [id])
  user      User?
  vetExt    BpVet?
  suppExt   BpSupplier?

  @@index([clinicId])
  @@index([clinicId, isActive])
  @@index([clinicId, type, isActive])
  @@map("business_partners")
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
  taxId          String
  creditTermDays Int

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