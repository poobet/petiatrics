# Data Model: Item Master ERP Foundation

## Overview

This feature turns the current inventory `Product` row into the canonical clinic item aggregate while adding normalized reference data for categories and units. The design preserves strict clinic ownership, keeps stock movements pointed at the same product identity, and stores tax behavior as references and flags rather than hardcoded percentages.

Tenant and constitution alignment:

- All item-master relational tables that belong to a clinic carry `clinicId` explicitly.
- `ItemCategory` and `UnitOfMeasure` are globally seeded reference tables and do not carry a `clinicId`; items reference these by ID only.
- `TaxCode` remains a global reference table and is only referenced by ID.
- Preferred vendor linkage references clinic-owned `BusinessPartner` records and must be validated against the current clinic.
- Material item mutations remain auditable through the existing audit event pipeline.

---

## Relational Changes (PostgreSQL via Prisma)

### Product (evolved canonical item aggregate)

**Purpose**: Represents the clinic’s authoritative item master record for both stocked goods and services while preserving the existing identity used by stock movement and clinical linking code.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Existing primary key remains authoritative |
| `clinicId` | `String` | FK to `Clinic.id`, indexed | Tenant boundary |
| `code` | `String` | required, clinic-unique | Canonical stored item code; normalized before persistence |
| `name` | `String` | required | Display name |
| `itemType` | `ItemType` | required | `STOCKED_GOOD` or `SERVICE` |
| `categoryId` | `String` | FK to `ItemCategory.id` | Required globally seeded category |
| `baseUnitId` | `String` | FK to `UnitOfMeasure.id` | Canonical unit for quantity normalization |
| `standardCost` | `Decimal` | required | Commercial cost basis |
| `baseSellingPrice` | `Decimal` | required | Default selling price configured by clinic |
| `isTaxInclusive` | `Boolean` | `@default(false)` | Pricing strategy flag |
| `defaultTaxCodeId` | `String?` | FK to `TaxCode.id` | No hardcoded percentage stored on item |
| `genericName` | `String?` | optional | Clinic/medical naming |
| `isControlledSubstance` | `Boolean` | `@default(false)` | Medical control flag |
| `requiresBatchAndExpiryTracking` | `Boolean` | `@default(false)` | Downstream receiving/dispensing control |
| `defaultSupplierId` | `String?` | FK to `BusinessPartner.id` | Optional preferred vendor |
| `defaultDoctorFee` | `Decimal?` | optional | Used for service items |
| `quantity` | `Decimal` | retained | Existing stock-state field kept for compatibility |
| `reorderThreshold` | `Decimal` | retained | Existing low-stock threshold kept for compatibility |
| `isActive` | `Boolean` | `@default(true)` | Soft-deactivation for master data |
| `createdAt` | `DateTime` | `@default(now())` | Audit support |
| `updatedAt` | `DateTime` | `@updatedAt` | Audit support |

**Validation rules**:

- `code` is normalized on write, for example trim + uppercase, before uniqueness checks.
- `itemType = SERVICE` cannot require stock-only behavior in create/update validation.
- `defaultDoctorFee` is allowed only for service items.
- `requiresBatchAndExpiryTracking` applies only to stocked items.
- `defaultSupplierId`, when provided, must reference a same-clinic `BusinessPartner` with an active `SUPPLIER` `BpRole`.
- `defaultTaxCodeId`, when provided, must reference an active global `TaxCode` row.

**Relationships**:

- `Clinic 1 -> many Product`
- `ItemCategory 1 -> many Product`
- `UnitOfMeasure 1 -> many Product (base unit)`
- `Product 1 -> many ItemUnitConversion`
- `BusinessPartner 1 -> many Product (default supplier)`
- `TaxCode 1 -> many Product`
- `Product 1 -> many StockMovement`

---

### ItemCategory (new globally seeded reference)

**Purpose**: Classifies items for filtering, defaults, and future accounting/reporting. Seeded globally; not clinic-managed in this release.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `name` | `String` | required, globally unique | Category label shown in UI |
| `code` | `String` | globally unique | Short stable identifier |
| `revenueGlCode` | `String?` | nullable | Optional accounting mapping |
| `expenseGlCode` | `String?` | nullable | Optional accounting mapping |
| `isActive` | `Boolean` | `@default(true)` | Hide from selectors without deletion |
| `createdAt` | `DateTime` | `@default(now())` | Audit support |
| `updatedAt` | `DateTime` | `@updatedAt` | Audit support |

**Validation rules**:

- Category name/code uniqueness is global (not clinic-scoped).
- GL fields are optional and may remain null.
- Categories are managed via seed data only in V1; no runtime CRUD endpoints are exposed.

---

### UnitOfMeasure (new globally seeded reference)

**Purpose**: Defines reusable unit labels available for item base units and alternate conversions. Seeded globally; not clinic-managed in this release.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `name` | `String` | required, globally unique | Display name, for example `Piece`, `Box`, `Visit` |
| `symbol` | `String?` | optional, globally unique when set | Short label such as `pc`, `bx` |
| `isActive` | `Boolean` | `@default(true)` | Selector hygiene |
| `createdAt` | `DateTime` | `@default(now())` | Audit support |
| `updatedAt` | `DateTime` | `@updatedAt` | Audit support |

**Validation rules**:

- Uniqueness is global on `name`; `symbol` is optional and also globally unique when provided.
- Units referenced by existing items should not be hard-deleted.
- Units are managed via seed data only in V1; no runtime CRUD endpoints are exposed.

---

### ItemUnitConversion (new child relation)

**Purpose**: Converts alternate units for one item back to the canonical base unit.

| Field | Type | Constraints | Notes |
|------|------|-------------|------|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `productId` | `String` | FK to `Product.id`, indexed | Owning item |
| `unitId` | `String` | FK to `UnitOfMeasure.id` | Alternate unit |
| `ratioToBase` | `Decimal` | positive required | Example: `10` for 1 Box = 10 Pieces |
| `createdAt` | `DateTime` | `@default(now())` | Audit support |
| `updatedAt` | `DateTime` | `@updatedAt` | Audit support |

**Validation rules**:

- `ratioToBase` must be strictly greater than zero.
- Base unit must not also appear as an alternate unit.
- Duplicate alternate-unit assignments on the same item are forbidden.

---

## Enumerations

### ItemType

```text
STOCKED_GOOD
SERVICE
```

This keeps service-vs-stock behavior explicit and supports type-specific validation and UI rendering.

---

## API Response Shape Guidance

The item detail response should flatten the aggregate into one read model so the UI does not need multiple follow-up calls to render the form.

Recommended item detail response sections:

- identity: `id`, `code`, `name`, `itemType`, `isActive`
- classification: `category`, `genericName`, `isControlledSubstance`
- units: `baseUnit`, `conversions[]`
- pricing: `standardCost`, `baseSellingPrice`, `isTaxInclusive`, `defaultTaxCode`
- clinic ops: `requiresBatchAndExpiryTracking`, `defaultSupplier`, `defaultDoctorFee`
- inventory compatibility: `quantity`, `reorderThreshold`

---

## Migration Notes

- Existing `Product.sku` should be migrated into the canonical stored item code field used by the new contracts.
- Existing string `category` and `unit` values should be backfilled into new `ItemCategory` and `UnitOfMeasure` rows per clinic before replacing them with relational references.
- Existing stock quantities and reorder thresholds remain on the evolved `Product` row for this slice so current stock flows keep functioning.
- Global `ItemCategory` and `UnitOfMeasure` seed records are created by the seed script (`packages/database/prisma/seed.ts`) immediately after the migration runs. Existing `Product.category` and `Product.unit` string values are backfilled to reference the closest matching seed row during migration.
- No stock-lot, vendor-matrix, or billing-line tax tables are introduced in this phase.
