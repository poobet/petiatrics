# Design: Item Master ERP Extension — GL, SKU/Barcode, Reorder Alerts, Bulk Import

**Date:** 2026-05-23
**Branch:** `006-item-master`
**Status:** Approved for planning
**Prerequisite:** `specs/006-item-master/` (all 42 tasks complete)

---

## Overview

This design extends the completed Item Master with four ERP-grade capabilities that enable accounting integration, rapid item identification, stock-level alerting, and bulk clinic onboarding. All four features share one Prisma migration and one implementation spec.

---

## Feature 1: General Ledger (GL) Account Structure

### Context

`ItemCategory` currently stores `revenueGlCode` and `expenseGlCode` as nullable strings. This design replaces those with proper FK relations to a globally seeded `GLAccount` entity, enabling downstream accounting modules to derive correct account codes from item categories without parsing free-text strings.

### Data Model

**New model: `GLAccount`**

```prisma
enum GLAccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
  COGS
}

model GLAccount {
  id          String        @id @default(uuid())
  code        String        @unique   // e.g. "1200", "4000", "5100"
  name        String                  // e.g. "Inventory Asset", "Drug Revenue"
  accountType GLAccountType
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  categoriesAsRevenue ItemCategory[] @relation("RevenueGLAccount")
  categoriesAsExpense ItemCategory[] @relation("ExpenseGLAccount")

  @@map("gl_accounts")
}
```

**`ItemCategory` changes:**
- Remove: `revenueGlCode String?`, `expenseGlCode String?`
- Add: `revenueGlAccountId String?`, `expenseGlAccountId String?`
- Add relations: `revenueGlAccount GLAccount? @relation("RevenueGLAccount", ...)`, `expenseGlAccount GLAccount? @relation("ExpenseGLAccount", ...)`

### Seed Data

Approximately 20 globally seeded GL accounts covering all six types, suited for a Thai private veterinary clinic:

| Code | Name | Type |
|------|------|------|
| 1100 | Cash and Bank | ASSET |
| 1200 | Inventory Asset | ASSET |
| 1300 | Accounts Receivable | ASSET |
| 2100 | Accounts Payable | LIABILITY |
| 3100 | Owner Equity | EQUITY |
| 4100 | Medicine Revenue | REVENUE |
| 4200 | Service Revenue | REVENUE |
| 4300 | Laboratory Revenue | REVENUE |
| 4400 | Retail Revenue | REVENUE |
| 4500 | Consultation Revenue | REVENUE |
| 4600 | Procedure Revenue | REVENUE |
| 5100 | Cost of Goods Sold (Medicine) | COGS |
| 5200 | Cost of Goods Sold (Retail) | COGS |
| 6100 | Salary Expense | EXPENSE |
| 6200 | Rent Expense | EXPENSE |
| 6300 | Utilities Expense | EXPENSE |
| 6400 | Supplies Expense | EXPENSE |
| 6500 | Marketing Expense | EXPENSE |
| 6600 | Depreciation Expense | EXPENSE |
| 6700 | Miscellaneous Expense | EXPENSE |

### API

- `GET /inventory/reference/gl-accounts` — returns all active GL accounts for dropdown selectors. Response shape: `{ id, code, name, accountType }[]`.

### Backend Rules

- When updating `ItemCategory`, if `revenueGlAccountId` or `expenseGlAccountId` references an inactive GL account, reject with `400`.
- All existing `ItemCategory` rows will have `revenueGlAccountId` and `expenseGlAccountId` set to `null` after migration (the original string codes are discarded because GL accounts are seeded after migration runs; re-assignment is done via future UI).

### Frontend

- GL Account selectors on `ItemCategory` forms are **deferred** to a future Admin UI module. No frontend work for Feature 1 is in scope for this phase.
- The `GET /inventory/reference/gl-accounts` endpoint is the only deliverable; it is consumed by the future category management screen.

### Event Hook (future readiness — deferred)

- A `product.sold` event is intentionally **not** emitted in this phase. It will be introduced in the Accounting module spec when a consumer exists. No changes to `visit.service.ts` are required for this feature.

---

## Feature 2: SKU & Barcode Management

### Context

Items need two machine-readable identifiers: an internal SKU for operations and an optional barcode (EAN-13 or equivalent) for point-of-sale scanning. SKUs are auto-generated if not provided. Barcodes are user-provided and globally unique.

### Data Model

**`Product` additions:**

```prisma
sku     String?  // e.g. "ITM-00042"
barcode String?  @unique

@@unique([clinicId, sku])
```

- `sku` uniqueness is scoped per clinic (`@@unique([clinicId, sku])`).
- `barcode` is globally unique (`@unique`) — EAN-13 barcodes are manufacturer-assigned and not clinic-specific.

### SKU Auto-Generation

**New model: `ClinicItemSequence`** (mirrors the existing `BpGroup.currentSequence` pattern):

```prisma
model ClinicItemSequence {
  clinicId        String   @id
  currentSequence Int      @default(0)
  clinic          Clinic   @relation(fields: [clinicId], references: [id])

  @@map("clinic_item_sequences")
}
```

Generation logic in `product.service.ts`, inside a `$transaction`:

```ts
const seq = await tx.clinicItemSequence.upsert({
  where: { clinicId },
  create: { clinicId, currentSequence: 1 },
  update: { currentSequence: { increment: 1 } },
});
const sku = `ITM-${String(seq.currentSequence).padStart(5, '0')}`;
```

If the caller provides a `sku`, auto-generation is skipped and uniqueness is validated only.

### Validation Rules

- `sku`: alphanumeric and hyphens, 1–30 characters, clinic-unique.
- `barcode`: alphanumeric, 8–14 characters (covers EAN-8 through EAN-14), globally unique.
- Manual SKU that conflicts with an existing auto-generated SKU → `409 Conflict`.

### API

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/inventory/products?sku=&barcode=` | Existing list endpoint, extended with `sku` and `barcode` filter params |
| `GET` | `/inventory/products/by-barcode/:barcode` | Returns single item or `404`. Enables future POS lookup. |

### Frontend

- In `general-tab.tsx`, add an **"Identifiers & Scanning"** section divider below the existing Name/Category/BaseUnit fields.
- Two fields in a 2-column row: **SKU** (monospace input, placeholder "Auto-generated", editable) and **Barcode** (standard input, placeholder "e.g. 8850006100021", optional).
- Hint text under SKU: "Leave blank to auto-generate on save."
- No global barcode scanner listener in this phase. Barcode scanning is deferred to the POS module.

---

## Feature 3: Reorder Point & Minimum Stock Level

### Context

The existing `reorderThreshold` field on `Product` is renamed `reorderPoint`. A new `minimumStock` field is added. Together they form a two-level stock warning system: `minimumStock` is the emergency floor (order immediately), `reorderPoint` is the routine restock trigger.

### Data Model

**`Product` changes:**
- Rename: `reorderThreshold` → `reorderPoint` (migration renames the column; no data loss).
- Add: `minimumStock Decimal @default(0) @db.Decimal(10,3)`.

### Business Rules

- `reorderPoint` ≥ `minimumStock` ≥ `0` — enforced at the DTO level.
- Low-stock check fires in `stock.service.ts` after every stock deduction.
- Event emitted only if `reorderPoint > 0` (items with no threshold configured are silently skipped).

### Event

```ts
// In stock.service.ts after every deduction:
if (product.reorderPoint > 0 && product.quantity <= product.reorderPoint) {
  this.eventEmitter.emit('stock.low_stock_warning', {
    clinicId,
    productId,
    sku: product.sku,
    name: product.name,
    currentStock: product.quantity,
    minimumStock: product.minimumStock,
    reorderPoint: product.reorderPoint,
  });
}
```

A `LowStockListener` in `apps/api/src/modules/inventory/listeners/` logs the event. Future notification modules subscribe to the same event without modifying `stock.service`.

### API

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/inventory/products/low-stock` | Returns `STOCKED_GOOD` items where `reorderPoint > 0 AND quantity <= reorderPoint`. The `reorderPoint > 0` guard excludes unconfigured items. Includes `sku`, `name`, `quantity`, `minimumStock`, `reorderPoint`. Clinic-scoped. Placed in `product.controller.ts` (base path `/inventory/products`). |

### Frontend

**`clinic-details-tab.tsx` additions** (stocked items only, beside existing Supplier field):

- **Minimum Stock** — numeric input, min 0, integer step.
- **Reorder Point** — numeric input, min 0, must be ≥ Minimum Stock (inline validation).
- Hint: "Stock alert fires when quantity falls to or below Reorder Point."

**Low-Stock Dashboard Widget** (`apps/web/components/inventory/low-stock-widget.tsx`):

- Fetches `GET /inventory/products/low-stock` on mount. No polling; a manual refresh button is sufficient if the user needs updated data within the same session.
- Renders a compact table: SKU, Name, Current Stock, Min Stock, Reorder At, and a severity indicator (Critical = quantity ≤ minimumStock; Low = quantity ≤ reorderPoint).
- "View all →" link navigates to a dedicated low-stock list page.
- Severity logic: **Critical** = `quantity <= minimumStock`; **Low** = `quantity <= reorderPoint`. Critical takes precedence — an item that satisfies both conditions is shown as Critical only.
- Placed on the inventory dashboard above the main item table.

---

## Feature 4: Bulk Import (Excel + CSV)

### Context

Clinics migrating to Petiatrics must upload their existing item lists rather than re-entering hundreds of items manually. The system accepts `.xlsx` and `.csv` files, validates each row, and performs an all-or-nothing batch insert.

### API

**`POST /inventory/products/bulk-import`**

- Guard: clinic-authenticated, `CLINIC_OWNER` or `STAFF` with item-master write permission.
- Transport: `multipart/form-data`, field name `file`.
- Multer config: memory storage, max 5 MB, accept `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `text/csv`.
- File type detection: by `mimetype` first, then file extension as fallback.

**Template columns:**

| Column | Required | Notes |
|--------|----------|-------|
| `name` | Yes | Display name |
| `itemType` | Yes | `STOCKED_GOOD` or `SERVICE` |
| `categoryCode` | No | Matched to seeded `ItemCategory.code` |
| `baseUnitSymbol` | No | Matched to seeded `UnitOfMeasure.symbol` |
| `standardCost` | No | Decimal ≥ 0, defaults to 0 |
| `baseSellingPrice` | No | Decimal ≥ 0, defaults to 0 |
| `sku` | No | Auto-generated if omitted |
| `barcode` | No | Must be globally unique |

**Parsing flow:**

1. Detect format → parse with `xlsx` (Excel) or `papaparse` (CSV).
2. Validate each row: required fields, type values, numeric ranges, `categoryCode` / `baseUnitSymbol` existence, duplicate SKU within file, duplicate SKU/barcode in DB.
3. Collect errors as `{ row: number, field: string, message: string }[]`.
4. If any errors → return `400 { errors }`, nothing inserted.
5. If all clean → `prisma.$transaction(createMany(...))`. SKU auto-generation for rows that omit `sku` is delegated to the existing `product.service.ts` SKU generation logic (the `ClinicItemSequence` upsert) — `bulk-import.service.ts` does **not** duplicate this logic.
6. Return `200 { imported: N, errors: [] }`.

**Libraries:**
- `xlsx` (SheetJS) for `.xlsx` parsing.
- `papaparse` for `.csv` parsing.

### Frontend

**Import button** — in `inventory-client.tsx` header toolbar, beside the existing "New Item" button.

**Import modal** (`apps/web/components/inventory/bulk-import-modal.tsx`):

1. **Drop zone** — drag-and-drop or click-to-browse. Shows accepted format badges (XLSX, CSV) and 5MB limit.
2. **Download Template** button — left-aligned below the drop zone. Downloads `items-template.xlsx` from a static `/templates/` path.
3. **File loaded state** — shows filename and row count parsed client-side (optional preview). Upload button becomes available.
4. **Server validation state** — after submit, if `400` returned, show:
   - Summary bar: "X rows ready · Y rows have errors"
   - Row preview table with inline error tags per row
   - Import button disabled until errors resolved (user must fix and re-upload)
5. **Success state** — shows "N items imported successfully" with a close button.

---

## Migration Summary

One migration performs all schema changes in sequence:

1. Create `gl_accounts` table with enum `GLAccountType`.
2. Add `revenue_gl_account_id` / `expense_gl_account_id` FK columns to `item_categories`; set both to `null` for all existing rows (matching to GL accounts is not possible at migration time — GL accounts are seeded via `seed.ts` which runs after migration).
3. Drop `revenue_gl_code` and `expense_gl_code` columns from `item_categories`.
4. Add `sku`, `barcode`, `minimum_stock` columns to `products`.
5. Rename `reorder_threshold` → `reorder_point` on `products`.
6. Add `@@unique([clinic_id, sku])` index to `products`.
7. Create `clinic_item_sequences` table.

**GL account seed data** is loaded exclusively via `packages/database/prisma/seed.ts` (re-runnable with `prisma db seed`), **not** embedded in migration SQL. This keeps the migration reversible and the seed idempotent via upsert.

---

## Component Map

### New Files

| Path | Purpose |
|------|---------|
| `apps/api/src/modules/inventory/listeners/low-stock.listener.ts` | Handles `stock.low_stock_warning` event |
| `apps/web/public/templates/items-template.xlsx` | Download template for bulk import. **Created manually and committed to the repo; column headers must exactly match the Template columns table in Feature 4.** |
| `apps/api/src/modules/inventory/services/bulk-import.service.ts` | File parsing, row validation, batch insert |
| `apps/api/src/modules/inventory/controllers/bulk-import.controller.ts` | `POST /inventory/products/bulk-import` |
| `apps/web/components/inventory/bulk-import-modal.tsx` | Drag-and-drop import UI |
| `apps/web/components/inventory/low-stock-widget.tsx` | Dashboard replenishment widget |

### Modified Files

| Path | Change |
|------|--------|
| `packages/database/prisma/schema.prisma` | `GLAccount`, `ClinicItemSequence`, `Product` + `ItemCategory` changes |
| `packages/database/prisma/seed.ts` | Seed `GLAccount` rows |
| `packages/types/src/enums.ts` | Add `GLAccountType` |
| `packages/types/src/api.ts` | Add GL, SKU, barcode, bulk-import response types |
| `apps/api/src/modules/inventory/services/product.service.ts` | SKU auto-gen, barcode filter, `minimumStock`/`reorderPoint` |
| `apps/api/src/modules/inventory/services/stock.service.ts` | Low-stock event emission |
| `apps/api/src/modules/inventory/services/reference.service.ts` | GL account selector |
| `apps/api/src/modules/inventory/controllers/reference.controller.ts` | `GET /reference/gl-accounts` |
| `apps/api/src/modules/inventory/controllers/product.controller.ts` | `GET /by-barcode/:barcode`, `GET /low-stock` |
| `apps/api/src/modules/inventory/inventory.module.ts` | Register new services, listeners, controllers |
| `apps/api/src/modules/inventory/dto/create-product.dto.ts` | Add `sku`, `barcode`, `minimumStock`, `reorderPoint` |
| `apps/api/src/modules/inventory/dto/update-product.dto.ts` | Same additions |
| `apps/api/src/modules/inventory/dto/list-products.dto.ts` | Add `sku`, `barcode` filter params |
| `apps/web/components/inventory/tabs/general-tab.tsx` | Add Identifiers & Scanning section |
| `apps/web/components/inventory/tabs/clinic-details-tab.tsx` | Add `minimumStock`, `reorderPoint` fields |
| `apps/web/components/inventory/item-form-types.ts` | Add `sku`, `barcode`, `minimumStock`, `reorderPoint` to `ItemFormValues` |
| `apps/web/components/inventory/item-form-schema.ts` | Add validation rules for new fields |
| `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx` | Add Import button, embed low-stock widget |
| `apps/web/messages/en.json` | Copy for new fields and states |
| `apps/web/messages/th.json` | Thai translations for new fields and states |

---

## Out of Scope

- Barcode label printing and hardware scanner integration (deferred to POS module).
- Automatic accounting journal entries (deferred to Accounting module).
- Branch-level GL overrides.
- Partial import (any error blocks the entire batch by design).
- Queue-based async import (BullMQ/Redis) — file sizes under 5 MB are handled synchronously.
- Clinic-managed GL account creation or chart-of-accounts editing.

---

## Success Criteria

| ID | Criterion |
|----|-----------|
| SC-001 | A new item created without a SKU receives an auto-generated `ITM-NNNNN` that is unique within the clinic. |
| SC-002 | A barcode search via `GET /inventory/products/by-barcode/:barcode` returns the correct item in under 100ms. |
| SC-003 | After a stock deduction that brings quantity to or below `reorderPoint`, the `stock.low_stock_warning` event is emitted within the same request. |
| SC-004 | `GET /inventory/products/low-stock` returns only `STOCKED_GOOD` items with `quantity <= reorderPoint`. |
| SC-005 | A valid 100-row XLSX import completes in under 5 seconds and inserts exactly 100 items. |
| SC-006 | A bulk import containing even one invalid row returns `400` with row-level errors and inserts nothing. |
| SC-007 | `GET /inventory/reference/gl-accounts` returns the full seeded GL account list with correct `code`, `name`, and `accountType` fields. |
