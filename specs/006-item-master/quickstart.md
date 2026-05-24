# Quickstart: Item Master ERP Foundation

## Prerequisites

- Node.js 20+
- PostgreSQL, MongoDB, and Redis available locally or via Docker
- Working branch: `006-item-master`

```bash
git checkout 006-item-master
```

---

## 1. Install dependencies

From the repo root:

```bash
npm install
```

---

## 2. Apply database changes

This feature expands the inventory product schema and adds category/unit reference tables.

```bash
npm run db:migrate
npm run db:generate
```

If you need to run Prisma directly while iterating:

```bash
cd packages/database
npx prisma migrate dev --name 006-item-master
npx prisma generate
```

---

## 3. Start the applications

From the repo root:

```bash
npm run dev
```

Expected apps:

- web: `http://localhost:3000`
- api: local NestJS API port configured by the repo

---

## 4. Verify authentication and clinic context

1. Log in with a clinic user who can manage inventory/master data.
2. Confirm branch selection succeeds and the web app retains an active branch.
3. Confirm protected item requests include `x-active-branch`.
4. Confirm no item request accepts `clinicId` from the UI payload.

---

## 5. Verify item master manually

1. Open `/clinic/inventory`.
2. Create a stocked item with:
   - item code
   - category
   - base unit
   - one alternate conversion
   - standard cost
   - base selling price
   - `isTaxInclusive = false`
   - default tax code
   - preferred supplier
   - batch/expiry tracking enabled
3. Create a service item with:
   - item code
   - service category
   - service base unit
   - selling price
   - default doctor fee
   - `isTaxInclusive = true`
4. Edit both items and confirm tab changes preserve unsaved state within the form session.
5. Deactivate one item and confirm it disappears from default active lists but remains retrievable in management detail flows.

Expected results:

- duplicate normalized item codes are rejected
- invalid or duplicate alternate units are rejected
- service items do not require stock-only fields
- stocked items can persist vendor and batch/expiry flags

---

## 6. Verify reference selectors manually

1. Load tax-code selector and confirm values come from `/api/v1/reference/tax-codes`.
2. Load item-category selector and confirm results are clinic-scoped.
3. Load unit selector and confirm results are clinic-scoped.
4. Confirm inactive categories/units do not appear in default selectors.

---

## 7. Verify audit behavior manually

1. Create an item.
2. Update the item’s pricing or clinic flags.
3. Deactivate the item.
4. Confirm audit entries are queryable through the existing clinic/admin audit tooling with the correct entity and actor context.

---

## 8. Run the test suites

### API

```bash
npm --prefix apps/api test
```

Focus areas:

- clinic-scoped item CRUD
- normalized code uniqueness
- tax-code validation
- category and unit validation
- service-vs-stocked rules
- preferred supplier same-clinic validation
- deactivation and low-stock compatibility

### Web

```bash
npm --prefix apps/web test
```

Focus areas:

- tabbed item form validation
- inline field errors
- filter/search behavior
- bilingual labels and validation text

### E2E

```bash
npm --prefix apps/web run test:e2e
```

Recommended E2E path:

1. Login
2. Select branch
3. Create stocked item
4. Create service item
5. Filter list by type/category/status
6. Edit item
7. Deactivate item
8. Verify read-only role cannot mutate item data

---

## 9. Example API calls

### Login

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"owner@clinic.com","password":"Password1!"}'
```

### Create stocked item

```bash
curl -b cookies.txt -X POST http://localhost:3001/api/v1/inventory/products \
  -H 'Content-Type: application/json' \
  -H 'x-active-branch: <branch-id>' \
  -d '{
    "code":"MED-001",
    "name":"Amoxicillin 250 mg",
    "itemType":"STOCKED_GOOD",
    "categoryId":"<category-id>",
    "baseUnitId":"<unit-id>",
    "standardCost":12.50,
    "baseSellingPrice":20.00,
    "isTaxInclusive":false,
    "defaultTaxCodeId":"<tax-code-id>",
    "requiresBatchAndExpiryTracking":true,
    "defaultSupplierId":"<supplier-bp-id>",
    "conversions":[{"unitId":"<box-unit-id>","ratioToBase":10}]
  }'
```

### Create service item

```bash
curl -b cookies.txt -X POST http://localhost:3001/api/v1/inventory/products \
  -H 'Content-Type: application/json' \
  -H 'x-active-branch: <branch-id>' \
  -d '{
    "code":"CONSULT-STD",
    "name":"Standard Consultation",
    "itemType":"SERVICE",
    "categoryId":"<category-id>",
    "baseUnitId":"<visit-unit-id>",
    "standardCost":0,
    "baseSellingPrice":500,
    "isTaxInclusive":true,
    "defaultTaxCodeId":"<tax-code-id>",
    "defaultDoctorFee":200
  }'
```

### Deactivate item

```bash
curl -b cookies.txt -X PATCH http://localhost:3001/api/v1/inventory/products/<item-id>/deactivate \
  -H 'x-active-branch: <branch-id>'
```

---

## 10. Verification Notes (Implementation Validated)

**Validated via automated test suite — 2026-05-16**

### API unit tests (48 passing)

- ✅ `normalizeCode()` uppercases and trims item codes
- ✅ `create()` — stocked good and service item creation
- ✅ `create()` — duplicate normalized code rejected with ConflictException
- ✅ `create()` — missing category/unit rejected with NotFoundException
- ✅ `findAll()` — paginated, filtered by itemType/categoryId/inactive/controlledSubstance
- ✅ `findById()` — not found throws NotFoundException; found returns full detail
- ✅ `deactivate()` — sets isActive=false
- ✅ `getLowStock()` — filters STOCKED_GOOD items where quantity ≤ reorderThreshold
- ✅ SERVICE item stock mutations rejected in replenish/deduct
- ✅ LowStockEvent emitted as `inventory.low_stock` when quantity hits reorderThreshold
- ✅ Role matrix: CLINIC_OWNER-only for mutations; all clinic roles for reads
- ✅ `@Audit` metadata verified on create, update, deactivate handlers
- ✅ Contract shapes: ItemSummaryResponse, ItemDetailResponse, ItemCategoryResponse, UnitOfMeasureResponse

### Web component tests (47 passing)

- ✅ Item form: 4-tab navigation (General / Units / Pricing / Clinic Details)
- ✅ Item form: validation — code, name, category, baseUnit, standardCost, baseSellingPrice required
- ✅ Item form: tab switching preserves unsaved state
- ✅ Item form: create mode calls POST, edit mode calls PATCH
- ✅ Item form: code field disabled in edit mode; pre-fills from initial data
- ✅ Item table: renders item data; low-stock icon; SERVICE shows dash for quantity
- ✅ Item filter bar: search, type filter, category filter, checkbox toggles
- ✅ `toApiPayload()`: normalizes code, strips service/stocked-specific fields appropriately

### Database

- ✅ Migration `20260516172332_006_item_master_expand_product` applied
- ✅ Seed: 6 ItemCategory rows + 6 UnitOfMeasure rows confirmed inserted

### Known gaps (manual verification required)

- E2E Playwright tests require running app stack (not automated in CI yet)
- Audit log persistence requires AuditModule (Phase 9, not in scope)
- Tax-code selector requires TaxCode rows seeded via clinic setup flow