# Item Master ERP Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Item Master with GL Account structure, SKU/barcode identifiers, reorder-point/minimum-stock levels, and a bulk CSV/xlsx import endpoint.

**Architecture:** One shared Prisma migration adds all schema changes (new tables + column renames). Four independent feature slices are then implemented in parallel-safe order: GL Accounts (reference data only), SKU/Barcode (identifier generation + lookup), Reorder Point/Min Stock (field rename + event refactor), Bulk Import (file parsing + all-or-nothing insert). Each slice is independently testable after the migration is applied.

**Tech Stack:** NestJS 11, Prisma 6.19.2 + PostgreSQL, Next.js 15 App Router, TypeScript, Jest (unit), Playwright (E2E), `xlsx` (SheetJS), `papaparse`

---

## File Map

### New files
| File | Purpose |
|---|---|
| `packages/database/prisma/migrations/20260524000100_erp_extension/migration.sql` | Single migration for all 4 features |
| `apps/api/src/modules/inventory/services/sku-sequence.service.ts` | Atomic SKU counter via `$queryRaw` |
| `apps/api/src/modules/inventory/services/sku-sequence.service.spec.ts` | Unit tests for SKU service |
| `apps/api/src/modules/inventory/services/bulk-import.service.ts` | xlsx/CSV parsing + batch product creation |
| `apps/api/src/modules/inventory/services/bulk-import.service.spec.ts` | Unit tests for import parsing + validation |
| `apps/api/src/modules/inventory/controllers/bulk-import.controller.ts` | `POST /inventory/products/bulk-import` with Multer |
| `apps/api/src/modules/inventory/listeners/low-stock.listener.ts` | Logs `stock.low_stock_warning` events |
| `apps/web/components/inventory/bulk-import-modal.tsx` | Drag-and-drop CSV/xlsx import modal |
| `apps/web/components/inventory/low-stock-widget.tsx` | Widget showing items below reorder point |

### Modified files
| File | What changes |
|---|---|
| `packages/database/prisma/schema.prisma` | Add `GLAccount`, `ClinicItemSequence` models; update `Product`, `ItemCategory`, `Clinic` |
| `packages/database/src/seed.ts` | Seed ~20 GL accounts |
| `packages/types/src/enums.ts` | Add `GLAccountType` enum |
| `packages/types/src/api.ts` | Add `GLAccountResponse`; update `ItemCategoryResponse`, `ItemSummaryResponse`, `ItemDetailResponse`, `CreateItemPayload`, `UpdateItemPayload` |
| `apps/api/src/common/events/domain-events.ts` | `LowStockEvent`: rename `reorderThreshold`→`reorderPoint`, add `sku`, `minimumStock` |
| `apps/api/src/modules/inventory/services/reference.service.ts` | Add `getGLAccounts()`; update `getItemCategories()` select |
| `apps/api/src/modules/inventory/services/product.service.ts` | Inject `SkuSequenceService`; SKU auto-gen in `create`; barcode uniqueness guard; `findByBarcode()`; rename field refs |
| `apps/api/src/modules/inventory/services/stock.service.ts` | `product.reorderThreshold` → `product.reorderPoint`; update event emit (name + payload) |
| `apps/api/src/modules/inventory/services/stock.service.spec.ts` | Fix renamed field + event |
| `apps/api/src/modules/inventory/controllers/reference.controller.ts` | Add `GET /inventory/reference/gl-accounts` |
| `apps/api/src/modules/inventory/controllers/product.controller.ts` | Add `GET /inventory/products/by-barcode/:barcode` |
| `apps/api/src/modules/inventory/dto/create-product.dto.ts` | Add optional `sku?`, `barcode?`, `minimumStock?`; rename `reorderThreshold`→`reorderPoint` |
| `apps/api/src/modules/inventory/dto/update-product.dto.ts` | Same renames + additions |
| `apps/api/src/modules/inventory/dto/list-products.dto.ts` | Add optional `barcode?` filter |
| `apps/api/src/modules/inventory/inventory.module.ts` | Register `SkuSequenceService`, `BulkImportService`, `BulkImportController`, `LowStockListener` |
| `apps/web/components/inventory/item-form-types.ts` | Add `sku`, `barcode`, `minimumStock`; rename `reorderThreshold`→`reorderPoint` |
| `apps/web/components/inventory/item-form-schema.ts` | Rename field references; add `sku`/`barcode`/`minimumStock`/`reorderPoint` to payload |
| `apps/web/components/inventory/tabs/general-tab.tsx` | Add Identifiers section (SKU, barcode) |
| `apps/web/components/inventory/tabs/clinic-details-tab.tsx` | Rename field; add `minimumStock` input |
| `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx` | Add Import button + `<BulkImportModal>` |

---

## Task 0: Prisma Migration

**Files:**
- Create: `packages/database/prisma/migrations/20260524000100_erp_extension/migration.sql`
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 0.1: Create the migration SQL file**

Create `packages/database/prisma/migrations/20260524000100_erp_extension/migration.sql` with:

```sql
-- ─── Feature 1: GL Account Structure ────────────────────────────────────────

-- CreateEnum
CREATE TYPE "GLAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS');

-- CreateTable gl_accounts
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GLAccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex gl_accounts_code_key
CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");

-- AlterTable item_categories: add GL FK columns, drop old string columns
ALTER TABLE "item_categories" ADD COLUMN "revenueGlAccountId" TEXT;
ALTER TABLE "item_categories" ADD COLUMN "expenseGlAccountId" TEXT;
ALTER TABLE "item_categories" DROP COLUMN "revenueGlCode";
ALTER TABLE "item_categories" DROP COLUMN "expenseGlCode";

-- AddForeignKey item_categories → gl_accounts (revenue)
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_revenueGlAccountId_fkey"
    FOREIGN KEY ("revenueGlAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey item_categories → gl_accounts (expense)
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_expenseGlAccountId_fkey"
    FOREIGN KEY ("expenseGlAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Feature 2: SKU & Barcode ────────────────────────────────────────────────

-- CreateTable clinic_item_sequences
CREATE TABLE "clinic_item_sequences" (
    "clinicId" TEXT NOT NULL,
    "nextVal" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_item_sequences_pkey" PRIMARY KEY ("clinicId")
);

-- AddForeignKey clinic_item_sequences → clinics
ALTER TABLE "clinic_item_sequences" ADD CONSTRAINT "clinic_item_sequences_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable products: add sku, barcode
ALTER TABLE "products" ADD COLUMN "sku" TEXT;
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;

-- CreateIndex products_barcode_key (nullable — PostgreSQL allows multiple NULLs in UNIQUE)
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex products_clinicId_sku_key (composite unique; NULLs are distinct)
CREATE UNIQUE INDEX "products_clinicId_sku_key" ON "products"("clinicId", "sku");

-- ─── Feature 3: Reorder Point & Minimum Stock ────────────────────────────────

-- Rename reorderThreshold → reorderPoint
ALTER TABLE "products" RENAME COLUMN "reorderThreshold" TO "reorderPoint";

-- Add minimumStock column
ALTER TABLE "products" ADD COLUMN "minimumStock" DECIMAL(10,3) NOT NULL DEFAULT 0;
```

- [ ] **Step 0.2: Update `packages/database/prisma/schema.prisma`**

Make the following changes to the schema file. Add the `GLAccountType` enum after the existing `StockMovementRefType` enum:

```prisma
enum GLAccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
  COGS
}
```

Replace the `ItemCategory` model (remove `revenueGlCode`/`expenseGlCode`, add FK fields + relations):

```prisma
// ─── ItemCategory (globally seeded reference — no clinicId) ─────────────────

model ItemCategory {
  id                 String    @id @default(uuid())
  name               String    @unique
  code               String    @unique
  revenueGlAccountId String?
  expenseGlAccountId String?
  isActive           Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  products         Product[]
  revenueGlAccount GLAccount? @relation("RevenueGLAccount", fields: [revenueGlAccountId], references: [id])
  expenseGlAccount GLAccount? @relation("ExpenseGLAccount", fields: [expenseGlAccountId], references: [id])

  @@map("item_categories")
}
```

Add the `GLAccount` model before `ItemCategory`:

```prisma
// ─── GLAccount (globally seeded chart of accounts) ───────────────────────────

model GLAccount {
  id        String        @id @default(uuid())
  code      String        @unique
  name      String
  type      GLAccountType
  isActive  Boolean       @default(true)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  revenueForCategories ItemCategory[] @relation("RevenueGLAccount")
  expenseForCategories ItemCategory[] @relation("ExpenseGLAccount")

  @@map("gl_accounts")
}
```

Replace the `Product` model (add `sku`, `barcode`, `minimumStock`; rename `reorderThreshold` → `reorderPoint`; add `@@unique([clinicId, sku])`):

```prisma
// ─── Product (Inventory Item) ────────────────────────────────────────────────

model Product {
  id                             String    @id @default(uuid())
  clinicId                       String
  code                           String
  sku                            String?
  barcode                        String?   @unique
  name                           String
  itemType                       ItemType  @default(STOCKED_GOOD)
  categoryId                     String?
  baseUnitId                     String?
  standardCost                   Decimal   @default(0) @db.Decimal(14, 4)
  baseSellingPrice               Decimal   @default(0) @db.Decimal(14, 4)
  isTaxInclusive                 Boolean   @default(false)
  defaultTaxCodeId               String?
  genericName                    String?
  isControlledSubstance          Boolean   @default(false)
  requiresBatchAndExpiryTracking Boolean   @default(false)
  defaultSupplierId              String?
  defaultDoctorFee               Decimal?  @db.Decimal(14, 4)
  quantity                       Decimal   @default(0) @db.Decimal(10, 3)
  reorderPoint                   Decimal   @default(0) @db.Decimal(10, 3)
  minimumStock                   Decimal   @default(0) @db.Decimal(10, 3)
  isActive                       Boolean   @default(true)
  createdAt                      DateTime  @default(now())
  updatedAt                      DateTime  @updatedAt

  clinic          Clinic              @relation(fields: [clinicId], references: [id])
  category        ItemCategory?       @relation(fields: [categoryId], references: [id])
  baseUnit        UnitOfMeasure?      @relation("BaseUnit", fields: [baseUnitId], references: [id])
  defaultTaxCode  TaxCode?            @relation("ProductDefaultTax", fields: [defaultTaxCodeId], references: [id])
  defaultSupplier BusinessPartner?    @relation("ProductDefaultSupplier", fields: [defaultSupplierId], references: [id])
  stockMovements      StockMovement[]
  branchStockBalances BranchStockBalance[]
  unitConversions     ItemUnitConversion[]

  @@unique([clinicId, code])
  @@unique([clinicId, sku])
  @@index([clinicId])
  @@index([clinicId, name])
  @@index([clinicId, itemType])
  @@index([clinicId, categoryId])
  @@index([clinicId, isActive])
  @@map("products")
}
```

Add `ClinicItemSequence` model after `BranchStockBalance`:

```prisma
// ─── ClinicItemSequence (per-clinic SKU counter) ─────────────────────────────

model ClinicItemSequence {
  clinicId  String   @id
  nextVal   Int      @default(1)
  updatedAt DateTime @updatedAt

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@map("clinic_item_sequences")
}
```

Add `clinicItemSequence` relation to `Clinic` model (inside its existing relations block):

```prisma
  clinicItemSequence  ClinicItemSequence?
```

- [ ] **Step 0.3: Apply migration to the running database**

From `packages/database/`:

```bash
npx prisma migrate deploy
```

Expected output:
```
Applying migration `20260524000100_erp_extension`
The following migration have been applied:
  migrations/
    └─ 20260524000100_erp_extension/
      └─ migration.sql

All migrations have been applied.
```

- [ ] **Step 0.4: Commit the migration**

```bash
git add packages/database/prisma/
git commit -m "chore(db): add erp-extension migration (GL accounts, SKU/barcode, reorder-point rename, min-stock)"
```

---

## Task 1: Regenerate Prisma Client + Update Types Package

**Files:**
- Modify: `packages/types/src/enums.ts`
- Modify: `packages/types/src/api.ts`

- [ ] **Step 1.1: Regenerate Prisma client types**

From `packages/database/` (while the NestJS server may still be running — use `--no-engine` to avoid locking the DLL on Windows):

```bash
npx prisma generate --no-engine
```

Expected output:
```
✔ Generated Prisma Client (v6.x) to .\node_modules\.prisma\client in XXXms
```

Then restart the TypeScript language server in VS Code (`Ctrl+Shift+P` → `TypeScript: Restart TS Server`) so that IntelliSense picks up the new types.

- [ ] **Step 1.2: Add `GLAccountType` enum to `packages/types/src/enums.ts`**

Append after the last existing enum in `packages/types/src/enums.ts`:

```typescript
export enum GLAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  COGS = 'COGS',
}
```

- [ ] **Step 1.3: Update `packages/types/src/api.ts` — GL Account response type**

Add after the `// ─── Item Master (006-item-master) ────` comment, before `ItemCategoryResponse`:

```typescript
export interface GLAccountResponse {
  id: string;
  code: string;
  name: string;
  type: GLAccountType;
  isActive: boolean;
}
```

Add `GLAccountType` to the existing import at the top of `packages/types/src/api.ts`:

```typescript
import { Role, Locale, BusinessPartnerType, BpRole, ItemType, GLAccountType } from './enums';
```

- [ ] **Step 1.4: Update `ItemCategoryResponse` in `packages/types/src/api.ts`**

Replace the existing `ItemCategoryResponse` interface:

```typescript
export interface ItemCategoryResponse {
  id: string;
  name: string;
  code: string;
  revenueGlAccountId: string | null;
  expenseGlAccountId: string | null;
  revenueGlAccount: { id: string; code: string; name: string } | null;
  expenseGlAccount: { id: string; code: string; name: string } | null;
  isActive: boolean;
}
```

- [ ] **Step 1.5: Update `ItemSummaryResponse` — add `sku` and `barcode`**

Add `sku` and `barcode` to the existing `ItemSummaryResponse`:

```typescript
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
  isActive: boolean;
}
```

- [ ] **Step 1.6: Update `ItemDetailResponse` — rename field + add new fields**

Replace the existing `ItemDetailResponse`:

```typescript
export interface ItemDetailResponse extends ItemSummaryResponse {
  conversions: ItemUnitConversionResponse[];
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
```

- [ ] **Step 1.7: Update `CreateItemPayload` and `UpdateItemPayload`**

Replace `CreateItemPayload`:

```typescript
export interface CreateItemPayload {
  code: string;
  name: string;
  itemType: ItemType;
  categoryId: string;
  baseUnitId: string;
  conversions?: ItemUnitConversionPayload[];
  standardCost: number;
  baseSellingPrice: number;
  isTaxInclusive?: boolean;
  defaultTaxCodeId?: string | null;
  genericName?: string | null;
  isControlledSubstance?: boolean;
  requiresBatchAndExpiryTracking?: boolean;
  defaultSupplierId?: string | null;
  defaultDoctorFee?: number | null;
  sku?: string | null;
  barcode?: string | null;
  reorderPoint?: number;
  minimumStock?: number;
}
```

Replace `UpdateItemPayload`:

```typescript
export interface UpdateItemPayload {
  name?: string;
  categoryId?: string;
  baseUnitId?: string;
  conversions?: ItemUnitConversionPayload[];
  standardCost?: number;
  baseSellingPrice?: number;
  isTaxInclusive?: boolean;
  defaultTaxCodeId?: string | null;
  genericName?: string | null;
  isControlledSubstance?: boolean;
  requiresBatchAndExpiryTracking?: boolean;
  defaultSupplierId?: string | null;
  defaultDoctorFee?: number | null;
  sku?: string | null;
  barcode?: string | null;
  reorderPoint?: number;
  minimumStock?: number;
  isActive?: boolean;
}
```

- [ ] **Step 1.8: Build the types package to verify no errors**

From the repo root:

```bash
cd packages/types
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.9: Commit**

```bash
git add packages/types/src/
git commit -m "feat(types): GLAccountType enum + updated Item Master API types (sku, barcode, reorderPoint, minimumStock)"
```

---

## Task 2: Seed GL Accounts

**Files:**
- Modify: `packages/database/src/seed.ts`

- [ ] **Step 2.1: Add GL account seed data**

In `packages/database/src/seed.ts`, add a GL accounts seeding block after the `taxCodes` upsert block (before the clinic/user seeding):

```typescript
  // ── 0.5 GL Accounts — standard chart of accounts ────────────────────────
  //
  // Globally seeded — no clinicId. Idempotent upsert on `code`.
  const glAccounts = [
    // Assets
    { code: '1100', name: 'Cash and Cash Equivalents', type: 'ASSET' },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '1300', name: 'Inventory — Medications', type: 'ASSET' },
    { code: '1310', name: 'Inventory — Supplies & Consumables', type: 'ASSET' },
    { code: '1320', name: 'Inventory — Vaccines', type: 'ASSET' },
    // Liabilities
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '2200', name: 'VAT Payable', type: 'LIABILITY' },
    { code: '2300', name: 'Withholding Tax Payable', type: 'LIABILITY' },
    // Equity
    { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
    // Revenue
    { code: '4100', name: 'Veterinary Service Revenue', type: 'REVENUE' },
    { code: '4200', name: 'Medication Sales Revenue', type: 'REVENUE' },
    { code: '4300', name: 'Grooming & Boarding Revenue', type: 'REVENUE' },
    { code: '4400', name: 'Vaccination Revenue', type: 'REVENUE' },
    { code: '4500', name: 'Laboratory & Diagnostic Revenue', type: 'REVENUE' },
    // COGS
    { code: '5100', name: 'Cost of Goods Sold — Medications', type: 'COGS' },
    { code: '5200', name: 'Cost of Goods Sold — Supplies', type: 'COGS' },
    { code: '5300', name: 'Cost of Goods Sold — Vaccines', type: 'COGS' },
    // Expenses
    { code: '6100', name: 'Staff Salaries & Wages', type: 'EXPENSE' },
    { code: '6200', name: 'Rent & Utilities', type: 'EXPENSE' },
    { code: '6300', name: 'Medical Equipment Depreciation', type: 'EXPENSE' },
  ] as const;

  for (const gl of glAccounts) {
    await prisma.gLAccount.upsert({
      where: { code: gl.code },
      update: { name: gl.name, type: gl.type as any },
      create: { code: gl.code, name: gl.name, type: gl.type as any },
    });
  }
  console.log(`✓ ${glAccounts.length} GL accounts seeded`);
```

- [ ] **Step 2.2: Run the seed to verify**

From `packages/database/`:

```bash
npx ts-node src/seed.ts
```

Expected output includes:
```
✓ 20 GL accounts seeded
```

- [ ] **Step 2.3: Commit**

```bash
git add packages/database/src/seed.ts
git commit -m "feat(seed): seed 20 GL accounts (chart of accounts)"
```

---

## Task 3: GL Account Reference Endpoint

**Files:**
- Modify: `apps/api/src/modules/inventory/services/reference.service.ts`
- Modify: `apps/api/src/modules/inventory/controllers/reference.controller.ts`

- [ ] **Step 3.1: Add `getGLAccounts()` to `ReferenceService`**

In `apps/api/src/modules/inventory/services/reference.service.ts`, add after `getTaxCodes()`:

```typescript
  async getGLAccounts() {
    return this.prisma.gLAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true, type: true, isActive: true },
    });
  }
```

Also update `getItemCategories()` to return the new FK fields instead of the old string fields:

```typescript
  async getItemCategories() {
    return this.prisma.itemCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        revenueGlAccountId: true,
        expenseGlAccountId: true,
        revenueGlAccount: { select: { id: true, code: true, name: true } },
        expenseGlAccount: { select: { id: true, code: true, name: true } },
        isActive: true,
      },
    });
  }
```

- [ ] **Step 3.2: Add `GET /gl-accounts` route to `ReferenceController`**

In `apps/api/src/modules/inventory/controllers/reference.controller.ts`, add:

```typescript
  @Get('gl-accounts')
  getGLAccounts() {
    return this.referenceService.getGLAccounts();
  }
```

- [ ] **Step 3.3: Verify the endpoint works**

With the NestJS server running:

```bash
curl -s http://localhost:3001/api/v1/inventory/reference/gl-accounts \
  -H "Cookie: <session-cookie>" | jq '.[0:3]'
```

Expected: array of GL account objects with `id`, `code`, `name`, `type`, `isActive`.

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/src/modules/inventory/services/reference.service.ts \
        apps/api/src/modules/inventory/controllers/reference.controller.ts
git commit -m "feat(inventory): GL account reference endpoint + updated category select"
```

---

## Task 4: SKU Sequence Service

**Files:**
- Create: `apps/api/src/modules/inventory/services/sku-sequence.service.ts`
- Create: `apps/api/src/modules/inventory/services/sku-sequence.service.spec.ts`

- [ ] **Step 4.1: Write the failing unit test**

Create `apps/api/src/modules/inventory/services/sku-sequence.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { SkuSequenceService } from './sku-sequence.service';

const CLINIC_ID = 'clinic-001';

function buildPrismaMock() {
  return {
    $queryRaw: jest.fn(),
  };
}

describe('SkuSequenceService', () => {
  let service: SkuSequenceService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkuSequenceService,
        { provide: PrismaClient, useValue: prisma },
      ],
    }).compile();

    service = module.get(SkuSequenceService);
  });

  it('returns ITM-00001 on first call (nextVal=1)', async () => {
    prisma.$queryRaw.mockResolvedValue([{ nextVal: 1 }]);
    const sku = await service.nextSku(CLINIC_ID);
    expect(sku).toBe('ITM-00001');
  });

  it('returns ITM-00042 when nextVal=42', async () => {
    prisma.$queryRaw.mockResolvedValue([{ nextVal: 42 }]);
    const sku = await service.nextSku(CLINIC_ID);
    expect(sku).toBe('ITM-00042');
  });

  it('pads to 5 digits — ITM-00100 when nextVal=100', async () => {
    prisma.$queryRaw.mockResolvedValue([{ nextVal: 100 }]);
    const sku = await service.nextSku(CLINIC_ID);
    expect(sku).toBe('ITM-00100');
  });

  it('handles large values — ITM-99999 when nextVal=99999', async () => {
    prisma.$queryRaw.mockResolvedValue([{ nextVal: 99999 }]);
    const sku = await service.nextSku(CLINIC_ID);
    expect(sku).toBe('ITM-99999');
  });
});
```

- [ ] **Step 4.2: Run the test to confirm it fails**

From `apps/api/`:

```bash
npx jest sku-sequence.service.spec.ts --no-coverage
```

Expected: `Cannot find module './sku-sequence.service'`

- [ ] **Step 4.3: Implement `SkuSequenceService`**

Create `apps/api/src/modules/inventory/services/sku-sequence.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Sql } from '@prisma/client/runtime/library';

/**
 * Generates clinic-scoped SKUs in the format ITM-NNNNN.
 *
 * Uses an atomic upsert+increment in `clinic_item_sequences` so concurrent
 * product creations never produce duplicate SKUs, even under load.
 *
 * Implementation: a single `INSERT … ON CONFLICT DO UPDATE … RETURNING` statement
 * via Prisma's tagged-template $queryRaw avoids the need for a separate SELECT + UPDATE.
 */
@Injectable()
export class SkuSequenceService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Returns the next available SKU for the given clinic.
   * Safe to call inside or outside a transaction.
   */
  async nextSku(clinicId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ nextVal: number }[]>`
      INSERT INTO "clinic_item_sequences" ("clinicId", "nextVal", "updatedAt")
      VALUES (${clinicId}, 1, NOW())
      ON CONFLICT ("clinicId") DO UPDATE
        SET "nextVal"   = "clinic_item_sequences"."nextVal" + 1,
            "updatedAt" = NOW()
      RETURNING "nextVal"
    `;
    const n = Number(rows[0].nextVal);
    return `ITM-${String(n).padStart(5, '0')}`;
  }
}
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
npx jest sku-sequence.service.spec.ts --no-coverage
```

Expected: `PASS  src/modules/inventory/services/sku-sequence.service.spec.ts` — 4 tests pass.

- [ ] **Step 4.5: Register `SkuSequenceService` in `InventoryModule`**

In `apps/api/src/modules/inventory/inventory.module.ts`, add to imports and providers:

```typescript
import { SkuSequenceService } from './services/sku-sequence.service';

// In @Module providers array, add:
SkuSequenceService,

// In @Module exports array, add:
SkuSequenceService,
```

Full updated module:

```typescript
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './services/product.service';
import { StockService } from './services/stock.service';
import { ReferenceService } from './services/reference.service';
import { SkuSequenceService } from './services/sku-sequence.service';
import { UnlinkedItemsService } from './services/unlinked-items.service';
import { InventoryWriteGuardService } from './services/inventory-write-guard.service';
import { BulkImportService } from './services/bulk-import.service';
import { ProductController } from './controllers/product.controller';
import { StockController } from './controllers/stock.controller';
import { ReferenceController } from './controllers/reference.controller';
import { BranchTestController } from './controllers/branch-test.controller';
import { BulkImportController } from './controllers/bulk-import.controller';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';
import { LowStockListener } from './listeners/low-stock.listener';

@Module({
  imports: [],
  controllers: [ProductController, StockController, ReferenceController, BranchTestController, BulkImportController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    ProductService,
    StockService,
    ReferenceService,
    SkuSequenceService,
    UnlinkedItemsService,
    InventoryWriteGuardService,
    BulkImportService,
    BranchContextGuard,
    LowStockListener,
  ],
  exports: [UnlinkedItemsService, ReferenceService, StockService, InventoryWriteGuardService, SkuSequenceService],
})
export class InventoryModule {}
```

> Note: `BulkImportService`, `BulkImportController`, and `LowStockListener` are referenced here but implemented in later tasks. If the module fails to compile before those tasks are done, comment them out and uncomment as each task is completed.

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/src/modules/inventory/services/sku-sequence.service.ts \
        apps/api/src/modules/inventory/services/sku-sequence.service.spec.ts \
        apps/api/src/modules/inventory/inventory.module.ts
git commit -m "feat(inventory): SKU sequence service with atomic upsert+increment"
```

---

## Task 5: Product Service — SKU Integration + Barcode Lookup

**Files:**
- Modify: `apps/api/src/modules/inventory/services/product.service.ts`
- Modify: `apps/api/src/modules/inventory/services/product.service.spec.ts`

- [ ] **Step 5.1: Write failing tests for new behavior**

Add to `apps/api/src/modules/inventory/services/product.service.spec.ts` (in the `describe('ProductService')` block):

```typescript
// Add SkuSequenceService to mock setup at the top of the file:
// In buildPrismaMock(), the mock already has product, category etc.
// Add a separate skuSeqMock:
const skuSeqMock = { nextSku: jest.fn().mockResolvedValue('ITM-00001') };

// In beforeEach, update the module setup to include SkuSequenceService:
// { provide: SkuSequenceService, useValue: skuSeqMock }

// Test: auto-generates SKU on create when not provided
it('auto-generates SKU via SkuSequenceService when sku not in dto', async () => {
  prisma.itemCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID, isActive: true });
  prisma.unitOfMeasure.findUnique.mockResolvedValue({ id: UNIT_ID, isActive: true });
  prisma.product.findFirst.mockResolvedValue(null); // code unique check
  prisma.product.create.mockResolvedValue({ id: 'p-1', sku: 'ITM-00001' });

  await service.create(CLINIC_ID, validCreateDto());

  expect(skuSeqMock.nextSku).toHaveBeenCalledWith(CLINIC_ID);
});

// Test: uses explicit SKU when provided
it('uses provided SKU instead of auto-generating', async () => {
  prisma.itemCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID, isActive: true });
  prisma.unitOfMeasure.findUnique.mockResolvedValue({ id: UNIT_ID, isActive: true });
  prisma.product.findFirst.mockResolvedValue(null);
  prisma.product.findUnique.mockResolvedValue(null); // barcode uniqueness (not called for sku)
  prisma.product.create.mockResolvedValue({ id: 'p-1', sku: 'CUSTOM-SKU' });

  await service.create(CLINIC_ID, validCreateDto({ sku: 'CUSTOM-SKU' }));

  expect(skuSeqMock.nextSku).not.toHaveBeenCalled();
});

// Test: throws ConflictException on duplicate barcode
it('throws ConflictException when barcode already exists', async () => {
  prisma.itemCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID, isActive: true });
  prisma.unitOfMeasure.findUnique.mockResolvedValue({ id: UNIT_ID, isActive: true });
  prisma.product.findFirst
    .mockResolvedValueOnce(null)    // code unique
    .mockResolvedValueOnce({ id: 'other-product' }); // barcode exists

  await expect(
    service.create(CLINIC_ID, validCreateDto({ barcode: '1234567890123' }))
  ).rejects.toThrow('Barcode "1234567890123" is already registered');
});
```

Also add `SkuSequenceService` import at top of spec file:
```typescript
import { SkuSequenceService } from './sku-sequence.service';
```

- [ ] **Step 5.2: Update `product.service.ts` — inject SKU service + new create logic**

Update the constructor in `apps/api/src/modules/inventory/services/product.service.ts`:

```typescript
import { SkuSequenceService } from './sku-sequence.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly skuSeq: SkuSequenceService,
  ) {}
```

Add `assertBarcodeUnique` private method after the existing `assertUnitExists`:

```typescript
  private async assertBarcodeUnique(barcode: string, excludeId?: string) {
    const existing = await this.prisma.product.findFirst({
      where: { barcode, id: excludeId ? { not: excludeId } : undefined },
    });
    if (existing) throw new ConflictException(`Barcode "${barcode}" is already registered to another item.`);
  }
```

Update `create()` to auto-generate SKU and validate barcode:

```typescript
  async create(clinicId: string, dto: CreateProductDto) {
    const code = this.normalizeCode(dto.code);
    await this.assertCodeUnique(clinicId, code);
    await this.assertCategoryExists(dto.categoryId);
    await this.assertUnitExists(dto.baseUnitId);

    if (dto.defaultTaxCodeId) {
      const tc = await this.prisma.taxCode.findUnique({ where: { id: dto.defaultTaxCodeId } });
      if (!tc) throw new BadRequestException(`Tax code "${dto.defaultTaxCodeId}" not found.`);
    }
    if (dto.defaultSupplierId) {
      const bp = await this.prisma.businessPartner.findFirst({ where: { id: dto.defaultSupplierId, clinicId } });
      if (!bp) throw new BadRequestException(`Supplier "${dto.defaultSupplierId}" not found.`);
    }
    if (dto.barcode) {
      await this.assertBarcodeUnique(dto.barcode);
    }

    // Auto-generate SKU if not explicitly provided
    const sku = dto.sku ?? await this.skuSeq.nextSku(clinicId);

    const { conversions, sku: _dtoSku, ...rest } = dto;
    const db = scopedPrisma(this.prisma, clinicId);

    return db.product.create({
      data: {
        clinicId,
        ...rest,
        code,
        sku,
        unitConversions: conversions?.length
          ? { create: conversions.map((c) => ({ unitId: c.unitId, ratioToBase: c.ratioToBase })) }
          : undefined,
      },
      include: PRODUCT_INCLUDE_DETAIL,
    });
  }
```

- [ ] **Step 5.3: Update `findAll()` mapping to include new fields**

In `product.service.ts`, update the `findAll` mapping section:

```typescript
    const mappedItems = items.map((item) => ({
      ...item,
      quantity: item.itemType === ItemType.SERVICE ? null : (byProductId.get(item.id) ?? 0),
      reorderPoint: Number(item.reorderPoint),
      minimumStock: Number(item.minimumStock),
    }));
```

Also add `sku`/`barcode` to the search OR conditions in `findAll()`:

```typescript
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
```

- [ ] **Step 5.4: Update `getLowStock()` to use renamed field**

In `product.service.ts`, update `getLowStock()`:

```typescript
  async getLowStock(clinicId: string, branchId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const balances = await db.branchStockBalance.findMany({
      where: {
        clinicId,
        branchId,
        product: { isActive: true, itemType: ItemType.STOCKED_GOOD },
      },
      include: { product: { include: PRODUCT_INCLUDE } },
    });

    return balances
      .filter(
        (row) =>
          Number(row.product.reorderPoint) > 0 &&
          Number(row.quantity) <= Number(row.product.reorderPoint),
      )
      .map((row) => ({
        ...row.product,
        quantity: Number(row.quantity),
        reorderPoint: Number(row.product.reorderPoint),
        minimumStock: Number(row.product.minimumStock),
      }));
  }
```

- [ ] **Step 5.5: Add `findByBarcode()` method**

Add to `product.service.ts` after `findById()`:

```typescript
  async findByBarcode(clinicId: string, barcode: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const product = await db.product.findFirst({
      where: { barcode },
      include: PRODUCT_INCLUDE_DETAIL,
    });
    if (!product) throw new NotFoundException(`No item found with barcode "${barcode}".`);
    return product;
  }
```

- [ ] **Step 5.6: Run product service tests**

```bash
npx jest product.service.spec.ts --no-coverage
```

Expected: all existing tests pass + 3 new tests pass.

- [ ] **Step 5.7: Commit**

```bash
git add apps/api/src/modules/inventory/services/product.service.ts \
        apps/api/src/modules/inventory/services/product.service.spec.ts
git commit -m "feat(inventory): SKU auto-generation in product create + barcode lookup + reorderPoint rename"
```

---

## Task 6: API — DTO Updates + Barcode Endpoint

**Files:**
- Modify: `apps/api/src/modules/inventory/dto/create-product.dto.ts`
- Modify: `apps/api/src/modules/inventory/dto/update-product.dto.ts`
- Modify: `apps/api/src/modules/inventory/dto/list-products.dto.ts`
- Modify: `apps/api/src/modules/inventory/controllers/product.controller.ts`

- [ ] **Step 6.1: Update `CreateProductDto`**

Add `sku`, `barcode`, `minimumStock` and rename `reorderThreshold` → `reorderPoint` in `apps/api/src/modules/inventory/dto/create-product.dto.ts`:

```typescript
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;
```

Remove the old `reorderThreshold` field.

- [ ] **Step 6.2: Update `UpdateProductDto`**

Same renames/additions in `apps/api/src/modules/inventory/dto/update-product.dto.ts`:

```typescript
  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;
```

Remove the old `reorderThreshold` field.

- [ ] **Step 6.3: Add `barcode` filter to `ListProductsDto`**

Add to `apps/api/src/modules/inventory/dto/list-products.dto.ts`:

```typescript
  @IsOptional()
  @IsString()
  barcode?: string;
```

- [ ] **Step 6.4: Add barcode filter to `product.service.ts` `findAll()`**

In `findAll()`, in the `where` building section:

```typescript
    const { search, itemType, categoryId, includeInactive, controlledSubstance, barcode, page = 1, perPage = 50 } = query;
    // ...existing where building...
    if (barcode) where.barcode = barcode;
```

- [ ] **Step 6.5: Add `GET /by-barcode/:barcode` to `ProductController`**

In `apps/api/src/modules/inventory/controllers/product.controller.ts`, add before the `@Get(':id')` route:

```typescript
  @Get('by-barcode/:barcode')
  @Roles(...READ_ROLES)
  findByBarcode(@TenantId() clinicId: string, @Param('barcode') barcode: string) {
    return this.productService.findByBarcode(clinicId, barcode);
  }
```

> Important: This route must be declared **before** `@Get(':id')` to prevent NestJS from matching `by-barcode` as an ID param.

- [ ] **Step 6.6: Verify route order**

The routes in `ProductController` must appear in this order:
1. `@Post()` — create
2. `@Get()` — findAll
3. `@Get('low-stock')` — getLowStock
4. `@Get('by-barcode/:barcode')` — findByBarcode ← NEW
5. `@Get(':id')` — findOne
6. `@Patch(':id')` — update
7. `@Patch(':id/deactivate')` — deactivate

- [ ] **Step 6.7: Compile check**

From `apps/api/`:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6.8: Commit**

```bash
git add apps/api/src/modules/inventory/dto/ \
        apps/api/src/modules/inventory/controllers/product.controller.ts \
        apps/api/src/modules/inventory/services/product.service.ts
git commit -m "feat(inventory): barcode lookup endpoint + DTO updates (sku, barcode, reorderPoint, minimumStock)"
```

---

## Task 7: Frontend — SKU & Barcode Fields in General Tab

**Files:**
- Modify: `apps/web/components/inventory/item-form-types.ts`
- Modify: `apps/web/components/inventory/item-form-schema.ts`
- Modify: `apps/web/components/inventory/tabs/general-tab.tsx`

- [ ] **Step 7.1: Update `ItemFormValues` in `item-form-types.ts`**

Add `sku` and `barcode` to the `ItemFormValues` interface and `ITEM_FORM_DEFAULTS`:

```typescript
export interface ItemFormValues {
  code: string;
  sku: string;
  barcode: string;
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
  reorderThreshold: number | '';  // will be renamed in Task 8
  conversions: ItemConversionFormValue[];
}

export const ITEM_FORM_DEFAULTS: ItemFormValues = {
  code: '',
  sku: '',
  barcode: '',
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
  reorderThreshold: 0,  // will be renamed in Task 8
  conversions: [],
};
```

- [ ] **Step 7.2: Add SKU/barcode to `toApiPayload()` in `item-form-schema.ts`**

Add to the returned object in `toApiPayload()`:

```typescript
    sku: values.sku.trim() || null,
    barcode: values.barcode.trim() || null,
```

- [ ] **Step 7.3: Add Identifiers section to `general-tab.tsx`**

Add after the Item Code field block (before the Name field):

```tsx
      {/* Identifiers — SKU and Barcode */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
            SKU
            <span className="ml-1 text-xs text-gray-400">(auto-generated if empty)</span>
          </label>
          <input
            id="sku"
            name="sku"
            value={values.sku}
            onChange={(e) => onChange('sku', e.target.value)}
            placeholder="e.g. ITM-00001"
            className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.sku && <p className="text-xs text-red-600 mt-0.5">{errors.sku}</p>}
        </div>
        <div>
          <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1">
            Barcode
          </label>
          <input
            id="barcode"
            name="barcode"
            value={values.barcode}
            onChange={(e) => onChange('barcode', e.target.value)}
            placeholder="e.g. 8850999123456"
            className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.barcode && <p className="text-xs text-red-600 mt-0.5">{errors.barcode}</p>}
        </div>
      </div>
```

- [ ] **Step 7.4: Initialize SKU/barcode in the item-form edit state**

Find where the form is initialized from an existing item in the item form page/component (likely `apps/web/app/(clinic)/clinic/inventory/[id]/edit/page.tsx` or the form client component). Add `sku` and `barcode` to the initial values hydration from the `ItemDetailResponse`:

```typescript
// When initializing form from existing item, add:
sku: item.sku ?? '',
barcode: item.barcode ?? '',
```

- [ ] **Step 7.5: TypeScript check**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7.6: Commit**

```bash
git add apps/web/components/inventory/item-form-types.ts \
        apps/web/components/inventory/item-form-schema.ts \
        apps/web/components/inventory/tabs/general-tab.tsx
git commit -m "feat(web/inventory): SKU and barcode input fields in item general tab"
```

---

## Task 8: Rename `reorderThreshold` → `reorderPoint` + Add `minimumStock`

This task sweeps all remaining references to the old field name across the full stack. Do it in one commit so the rename is atomic.

**Files:**
- Modify: `apps/api/src/common/events/domain-events.ts`
- Modify: `apps/api/src/modules/inventory/services/stock.service.ts`
- Modify: `apps/api/src/modules/inventory/services/stock.service.spec.ts`
- Modify: `apps/web/components/inventory/item-form-types.ts`
- Modify: `apps/web/components/inventory/item-form-schema.ts`
- Modify: `apps/web/components/inventory/tabs/clinic-details-tab.tsx`

- [ ] **Step 8.1: Update `LowStockEvent` in `domain-events.ts`**

Replace the `LowStockEvent` class in `apps/api/src/common/events/domain-events.ts`:

```typescript
/** Emitted when a product's stock falls at or below its reorder point */
export class LowStockEvent {
  constructor(
    public readonly clinicId: string,
    public readonly branchId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly sku: string | null,
    public readonly currentQuantity: number,
    public readonly minimumStock: number,
    public readonly reorderPoint: number,
  ) {}
}
```

- [ ] **Step 8.2: Update `stock.service.ts` emit call in `deduct()`**

Replace the `if (qAfter <= ...)` block at the end of the `deduct()` transaction:

```typescript
      if (Number(product.reorderPoint) > 0 && qAfter <= Number(product.reorderPoint)) {
        this.events.emit(
          'stock.low_stock_warning',
          new LowStockEvent(
            clinicId,
            dto.branchId,
            product.id,
            product.name,
            product.sku ?? null,
            qAfter,
            Number(product.minimumStock),
            Number(product.reorderPoint),
          ),
        );
      }
```

- [ ] **Step 8.3: Update `stock.service.spec.ts` to match new event**

Find the test that asserts `events.emit` was called with `'inventory.low_stock'` and update it:

```typescript
expect(events.emit).toHaveBeenCalledWith(
  'stock.low_stock_warning',
  expect.objectContaining({
    clinicId: CLINIC_ID,
    productId: 'p1',
    branchId: BRANCH_ID,
    reorderPoint: expect.any(Number),
    minimumStock: expect.any(Number),
  }),
);
```

Also update the mock product in the spec that currently has `reorderThreshold`:

```typescript
// Change all occurrences of:
reorderThreshold: 5
// To:
reorderPoint: 5,
minimumStock: 2,
sku: null,
```

- [ ] **Step 8.4: Update `item-form-types.ts` — rename field**

Replace `reorderThreshold` with `reorderPoint` in `ItemFormValues` and `ITEM_FORM_DEFAULTS`:

```typescript
  reorderPoint: number | '';

// ...

export const ITEM_FORM_DEFAULTS: ItemFormValues = {
  // ...
  reorderPoint: 0,
  minimumStock: 0,
  // ...
};
```

Also add `minimumStock` to `ItemFormValues`:

```typescript
  minimumStock: number | '';
```

- [ ] **Step 8.5: Update `item-form-schema.ts` — rename in `toApiPayload()`**

Replace:
```typescript
    reorderThreshold:
      values.itemType === ItemType.STOCKED_GOOD ? Number(values.reorderThreshold) || 0 : 0,
```
With:
```typescript
    reorderPoint:
      values.itemType === ItemType.STOCKED_GOOD ? Number(values.reorderPoint) || 0 : 0,
    minimumStock:
      values.itemType === ItemType.STOCKED_GOOD ? Number(values.minimumStock) || 0 : 0,
```

- [ ] **Step 8.6: Update `clinic-details-tab.tsx` — rename + add minimumStock input**

Replace the Reorder Threshold section with:

```tsx
      {/* Reorder Point and Minimum Stock (stocked goods only) */}
      {values.itemType === ItemType.STOCKED_GOOD && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="minimumStock" className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Stock
              <span className="ml-1 text-xs text-gray-400">(critical alert level)</span>
            </label>
            <input
              id="minimumStock"
              type="number"
              min="0"
              step="1"
              value={values.minimumStock}
              onChange={(e) => onChange('minimumStock', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="reorderPoint" className="block text-sm font-medium text-gray-700 mb-1">
              Reorder Point
              <span className="ml-1 text-xs text-gray-400">(trigger reorder at this level)</span>
            </label>
            <input
              id="reorderPoint"
              type="number"
              min="0"
              step="1"
              value={values.reorderPoint}
              onChange={(e) => onChange('reorderPoint', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
```

- [ ] **Step 8.7: Initialize `reorderPoint` and `minimumStock` from item detail in the edit form**

Wherever the edit form initializes from `ItemDetailResponse`, replace:

```typescript
reorderThreshold: item.reorderThreshold ?? 0,
```

With:

```typescript
reorderPoint: item.reorderPoint ?? 0,
minimumStock: item.minimumStock ?? 0,
```

- [ ] **Step 8.8: Run all affected tests**

```bash
cd apps/api && npx jest stock.service.spec.ts --no-coverage
```

Expected: all tests pass.

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8.9: Commit**

```bash
git add apps/api/src/common/events/domain-events.ts \
        apps/api/src/modules/inventory/services/stock.service.ts \
        apps/api/src/modules/inventory/services/stock.service.spec.ts \
        apps/web/components/inventory/item-form-types.ts \
        apps/web/components/inventory/item-form-schema.ts \
        apps/web/components/inventory/tabs/clinic-details-tab.tsx
git commit -m "feat(inventory): rename reorderThreshold→reorderPoint + add minimumStock (backend + frontend)"
```

---

## Task 9: Low Stock Listener

**Files:**
- Create: `apps/api/src/modules/inventory/listeners/low-stock.listener.ts`

- [ ] **Step 9.1: Create `LowStockListener`**

Create `apps/api/src/modules/inventory/listeners/low-stock.listener.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LowStockEvent } from '../../../common/events/domain-events';

/**
 * Listens for stock.low_stock_warning events and logs them.
 *
 * Extension point: replace the log statement with a push notification,
 * email, or database alert record in the future.
 */
@Injectable()
export class LowStockListener {
  private readonly logger = new Logger(LowStockListener.name);

  @OnEvent('stock.low_stock_warning', { async: true })
  handle(event: LowStockEvent): void {
    this.logger.warn(
      `Low stock: "${event.productName}" (SKU: ${event.sku ?? 'N/A'}) ` +
      `in branch ${event.branchId} — ` +
      `current: ${event.currentQuantity}, ` +
      `minimum: ${event.minimumStock}, ` +
      `reorder point: ${event.reorderPoint}`,
    );
  }
}
```

- [ ] **Step 9.2: Verify `LowStockListener` is already registered in `InventoryModule`**

Check that `inventory.module.ts` includes `LowStockListener` in providers (added in Task 4 Step 4.5). If you deferred registration, add it now.

- [ ] **Step 9.3: Commit**

```bash
git add apps/api/src/modules/inventory/listeners/low-stock.listener.ts
git commit -m "feat(inventory): LowStockListener logs stock.low_stock_warning events"
```

---

## Task 10: Low Stock Widget (Frontend)

**Files:**
- Create: `apps/web/components/inventory/low-stock-widget.tsx`
- Modify: `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx`

- [ ] **Step 10.1: Create `low-stock-widget.tsx`**

Create `apps/web/components/inventory/low-stock-widget.tsx`:

```tsx
'use client';

import type { ItemSummaryResponse } from '@petiatrics/types';

interface Props {
  items: ItemSummaryResponse[];
  onItemClick?: (itemId: string) => void;
}

/**
 * Displays a compact list of items at or below their reorder point.
 * Items below minimumStock are highlighted in red; others in amber.
 */
export default function LowStockWidget({ items, onItemClick }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-700 font-medium">All stock levels are healthy.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      <div className="px-4 py-3 border-b border-amber-200">
        <h3 className="text-sm font-semibold text-amber-800">
          Low Stock Alert — {items.length} item{items.length !== 1 ? 's' : ''} need attention
        </h3>
      </div>
      <ul className="divide-y divide-amber-100 max-h-64 overflow-y-auto">
        {items.map((item) => {
          const qty = item.quantity ?? 0;
          const reorderPoint = (item as any).reorderPoint ?? 0;
          const minimumStock = (item as any).minimumStock ?? 0;
          const isCritical = minimumStock > 0 && qty <= minimumStock;

          return (
            <li
              key={item.id}
              className={`px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-amber-100 ${
                isCritical ? 'bg-red-50 hover:bg-red-100' : ''
              }`}
              onClick={() => onItemClick?.(item.id)}
            >
              <div>
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                {item.sku && (
                  <span className="ml-2 text-xs text-gray-500 font-mono">{item.sku}</span>
                )}
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-semibold ${
                    isCritical ? 'text-red-600' : 'text-amber-700'
                  }`}
                >
                  {qty} {item.baseUnit?.symbol ?? 'units'}
                </span>
                <span className="block text-xs text-gray-400">
                  reorder at {reorderPoint}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 10.2: Add `LowStockWidget` to `inventory-client.tsx`**

In `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx`, import and place the widget above the item table when there are low stock items:

```typescript
import LowStockWidget from '@/components/inventory/low-stock-widget';
```

Add in the JSX, above the `<ItemTable>` or in a dedicated section:

```tsx
        {lowStockItems.length > 0 && (
          <div className="mb-4">
            <LowStockWidget
              items={lowStockItems}
              onItemClick={(id) => {/* navigate to item detail if needed */}}
            />
          </div>
        )}
```

- [ ] **Step 10.3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10.4: Commit**

```bash
git add apps/web/components/inventory/low-stock-widget.tsx \
        apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx
git commit -m "feat(web/inventory): LowStockWidget component with critical/warning levels"
```

---

## Task 11: Install Bulk Import Libraries

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 11.1: Install `xlsx` and `papaparse` in the API package**

From `apps/api/`:

```bash
npm install xlsx papaparse
npm install --save-dev @types/papaparse
```

> `xlsx` ships its own types. `papaparse` requires `@types/papaparse`.

- [ ] **Step 11.2: Verify installations**

```bash
node -e "require('xlsx'); require('papaparse'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 11.3: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json
git commit -m "chore(api): add xlsx and papaparse for bulk product import"
```

---

## Task 12: BulkImportService

**Files:**
- Create: `apps/api/src/modules/inventory/services/bulk-import.service.ts`
- Create: `apps/api/src/modules/inventory/services/bulk-import.service.spec.ts`

- [ ] **Step 12.1: Write failing tests**

Create `apps/api/src/modules/inventory/services/bulk-import.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BulkImportService, BulkImportRow } from './bulk-import.service';
import { ProductService } from './product.service';
import { SkuSequenceService } from './sku-sequence.service';

jest.mock('@petiatrics/database', () => ({
  scopedPrisma: (_prisma: unknown) => _prisma,
}));

const CLINIC_ID = 'clinic-001';

const validRow: BulkImportRow = {
  code: 'MED-001',
  name: 'Amoxicillin 250mg',
  itemType: 'STOCKED_GOOD',
  categoryCode: 'MEDS',
  baseUnitSymbol: 'box',
  standardCost: 100,
  baseSellingPrice: 180,
};

function buildPrismaMock() {
  return {
    itemCategory: { findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', code: 'MEDS', isActive: true }) },
    unitOfMeasure: { findUnique: jest.fn().mockResolvedValue({ id: 'unit-1', symbol: 'box', isActive: true }) },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
  };
}

function buildProductServiceMock() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'p-1' }),
    normalizeCode: jest.fn((c: string) => c.trim().toUpperCase()),
  };
}

function buildSkuSeqMock() {
  return { nextSku: jest.fn().mockResolvedValue('ITM-00001') };
}

describe('BulkImportService', () => {
  let service: BulkImportService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let productService: ReturnType<typeof buildProductServiceMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    productService = buildProductServiceMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkImportService,
        { provide: PrismaClient, useValue: prisma },
        { provide: ProductService, useValue: productService },
        { provide: SkuSequenceService, useValue: buildSkuSeqMock() },
      ],
    }).compile();

    service = module.get(BulkImportService);
  });

  describe('parseRows()', () => {
    it('rejects a file with no content rows', () => {
      const rows: BulkImportRow[] = [];
      expect(() => service.validateRows(rows)).toThrow('File contains no data rows');
    });

    it('rejects a row with missing required "code" column', () => {
      const rows = [{ ...validRow, code: '' }];
      const errors = service.validateRows(rows);
      expect(errors).toContainEqual(
        expect.objectContaining({ row: 1, field: 'code', message: expect.stringContaining('required') }),
      );
    });

    it('rejects a row with invalid itemType', () => {
      const rows = [{ ...validRow, itemType: 'INVALID' as any }];
      const errors = service.validateRows(rows);
      expect(errors).toContainEqual(
        expect.objectContaining({ row: 1, field: 'itemType' }),
      );
    });

    it('returns empty array for a valid row', () => {
      const errors = service.validateRows([validRow]);
      expect(errors).toEqual([]);
    });

    it('aggregates errors from multiple rows', () => {
      const rows = [
        { ...validRow, code: '' },
        { ...validRow, name: '' },
      ];
      const errors = service.validateRows(rows);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors[0].row).toBe(1);
      expect(errors[1].row).toBe(2);
    });
  });

  describe('process()', () => {
    it('throws BadRequestException with row errors when validation fails', async () => {
      const file = Buffer.from('') as any;
      jest.spyOn(service, 'parseFile').mockReturnValue([{ ...validRow, code: '' }]);

      await expect(service.process(CLINIC_ID, { buffer: file, mimetype: 'text/csv' } as any))
        .rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 12.2: Run failing tests**

```bash
npx jest bulk-import.service.spec.ts --no-coverage
```

Expected: `Cannot find module './bulk-import.service'`

- [ ] **Step 12.3: Implement `BulkImportService`**

Create `apps/api/src/modules/inventory/services/bulk-import.service.ts`:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ItemType } from '@petiatrics/types';
import { ProductService } from './product.service';
import { SkuSequenceService } from './sku-sequence.service';

export interface BulkImportRow {
  code: string;
  name: string;
  itemType: ItemType | string;
  categoryCode: string;
  baseUnitSymbol: string;
  standardCost: number;
  baseSellingPrice: number;
  sku?: string;
  barcode?: string;
  genericName?: string;
  reorderPoint?: number;
  minimumStock?: number;
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

const VALID_ITEM_TYPES = Object.values(ItemType) as string[];

/**
 * Parses xlsx or CSV files and batch-creates products.
 * All-or-nothing: any validation error aborts the entire import.
 */
@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly productService: ProductService,
    private readonly skuSeq: SkuSequenceService,
  ) {}

  /** Parse xlsx or CSV buffer into row objects. */
  parseFile(file: Express.Multer.File): BulkImportRow[] {
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.originalname?.endsWith('.csv');

    if (isCsv) {
      const text = file.buffer.toString('utf-8');
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      return result.data.map((r) => this.mapRow(r));
    }

    // xlsx
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    return raw.map((r) => this.mapRow(r as Record<string, unknown>));
  }

  private mapRow(r: Record<string, unknown>): BulkImportRow {
    return {
      code: String(r['code'] ?? r['Code'] ?? '').trim(),
      name: String(r['name'] ?? r['Name'] ?? '').trim(),
      itemType: String(r['itemType'] ?? r['item_type'] ?? r['ItemType'] ?? '').trim(),
      categoryCode: String(r['categoryCode'] ?? r['category_code'] ?? r['CategoryCode'] ?? '').trim(),
      baseUnitSymbol: String(r['baseUnitSymbol'] ?? r['base_unit_symbol'] ?? r['BaseUnitSymbol'] ?? '').trim(),
      standardCost: Number(r['standardCost'] ?? r['standard_cost'] ?? 0),
      baseSellingPrice: Number(r['baseSellingPrice'] ?? r['base_selling_price'] ?? 0),
      sku: String(r['sku'] ?? r['SKU'] ?? '').trim() || undefined,
      barcode: String(r['barcode'] ?? r['Barcode'] ?? '').trim() || undefined,
      genericName: String(r['genericName'] ?? r['generic_name'] ?? '').trim() || undefined,
      reorderPoint: r['reorderPoint'] !== undefined && r['reorderPoint'] !== ''
        ? Number(r['reorderPoint']) : undefined,
      minimumStock: r['minimumStock'] !== undefined && r['minimumStock'] !== ''
        ? Number(r['minimumStock']) : undefined,
    };
  }

  /** Validate parsed rows. Returns an array of row errors (empty = valid). */
  validateRows(rows: BulkImportRow[]): RowError[] {
    if (rows.length === 0) {
      throw new BadRequestException('File contains no data rows. Check that the file has a header row and at least one data row.');
    }

    const errors: RowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.code) errors.push({ row: rowNum, field: 'code', message: 'code is required' });
      if (!row.name) errors.push({ row: rowNum, field: 'name', message: 'name is required' });
      if (!row.itemType || !VALID_ITEM_TYPES.includes(row.itemType)) {
        errors.push({ row: rowNum, field: 'itemType', message: `itemType must be one of: ${VALID_ITEM_TYPES.join(', ')}` });
      }
      if (!row.categoryCode) errors.push({ row: rowNum, field: 'categoryCode', message: 'categoryCode is required' });
      if (!row.baseUnitSymbol) errors.push({ row: rowNum, field: 'baseUnitSymbol', message: 'baseUnitSymbol is required' });
      if (isNaN(row.standardCost) || row.standardCost < 0) {
        errors.push({ row: rowNum, field: 'standardCost', message: 'standardCost must be a non-negative number' });
      }
      if (isNaN(row.baseSellingPrice) || row.baseSellingPrice < 0) {
        errors.push({ row: rowNum, field: 'baseSellingPrice', message: 'baseSellingPrice must be a non-negative number' });
      }
    }

    return errors;
  }

  /** Process an uploaded file: parse → validate → resolve references → batch create. */
  async process(clinicId: string, file: Express.Multer.File): Promise<{ created: number }> {
    const rows = this.parseFile(file);
    const errors = this.validateRows(rows);

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    // Resolve categoryCode → categoryId and baseUnitSymbol → baseUnitId
    const categoryCodes = [...new Set(rows.map((r) => r.categoryCode))];
    const unitSymbols = [...new Set(rows.map((r) => r.baseUnitSymbol))];

    const [categories, units] = await Promise.all([
      Promise.all(
        categoryCodes.map((code) =>
          this.prisma.itemCategory.findUnique({ where: { code } })
        )
      ),
      Promise.all(
        unitSymbols.map((symbol) =>
          this.prisma.unitOfMeasure.findUnique({ where: { symbol } })
        )
      ),
    ]);

    const categoryMap = new Map(
      categories.filter(Boolean).map((c) => [c!.code, c!.id])
    );
    const unitMap = new Map(
      units.filter(Boolean).map((u) => [u!.symbol!, u!.id])
    );

    // Check all references resolve
    const refErrors: RowError[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      if (!categoryMap.has(row.categoryCode)) {
        refErrors.push({ row: rowNum, field: 'categoryCode', message: `Category code "${row.categoryCode}" not found` });
      }
      if (!unitMap.has(row.baseUnitSymbol)) {
        refErrors.push({ row: rowNum, field: 'baseUnitSymbol', message: `Unit symbol "${row.baseUnitSymbol}" not found` });
      }
    }

    if (refErrors.length > 0) {
      throw new BadRequestException({ message: 'Reference lookup failed', errors: refErrors });
    }

    // All-or-nothing batch create
    let created = 0;
    for (const row of rows) {
      await this.productService.create(clinicId, {
        code: row.code,
        name: row.name,
        itemType: row.itemType as ItemType,
        categoryId: categoryMap.get(row.categoryCode)!,
        baseUnitId: unitMap.get(row.baseUnitSymbol)!,
        standardCost: row.standardCost,
        baseSellingPrice: row.baseSellingPrice,
        sku: row.sku,
        barcode: row.barcode,
        genericName: row.genericName,
        reorderPoint: row.reorderPoint,
        minimumStock: row.minimumStock,
      });
      created++;
    }

    return { created };
  }
}
```

- [ ] **Step 12.4: Run tests**

```bash
npx jest bulk-import.service.spec.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 12.5: Commit**

```bash
git add apps/api/src/modules/inventory/services/bulk-import.service.ts \
        apps/api/src/modules/inventory/services/bulk-import.service.spec.ts
git commit -m "feat(inventory): BulkImportService — xlsx/CSV parsing, row validation, batch create"
```

---

## Task 13: BulkImportController

**Files:**
- Create: `apps/api/src/modules/inventory/controllers/bulk-import.controller.ts`
- Modify: `apps/api/src/modules/inventory/inventory.module.ts` (already updated in Task 4)

- [ ] **Step 13.1: Create `BulkImportController`**

Create `apps/api/src/modules/inventory/controllers/bulk-import.controller.ts`:

```typescript
import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { BulkImportService } from '../services/bulk-import.service';

const WRITE_ROLES = [Role.CLINIC_OWNER];
const FIVE_MB = 5 * 1024 * 1024;
const ALLOWED_MIMETYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Controller('inventory/products')
export class BulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  /**
   * POST /inventory/products/bulk-import
   * Accepts a multipart/form-data file (field name: "file") — csv or xlsx.
   * Returns { created: number } on success.
   * Returns 400 with { message, errors: RowError[] } on validation failure.
   */
  @Post('bulk-import')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: FIVE_MB },
    }),
  )
  async bulkImport(
    @TenantId() clinicId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send a "file" field in multipart/form-data.');
    }
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Upload a .csv or .xlsx file.`,
      );
    }
    return this.bulkImportService.process(clinicId, file);
  }
}
```

- [ ] **Step 13.2: Verify `BulkImportController` is registered in `InventoryModule`**

Confirm `inventory.module.ts` includes `BulkImportController` in `controllers` and `BulkImportService` in `providers` (added in Task 4 Step 4.5). Import the controller:

```typescript
import { BulkImportController } from './controllers/bulk-import.controller';
```

- [ ] **Step 13.3: Compile check**

From `apps/api/`:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 13.4: Manual smoke test**

With the NestJS server running, test with a minimal CSV:

```bash
# Create a test CSV
echo "code,name,itemType,categoryCode,baseUnitSymbol,standardCost,baseSellingPrice
TEST-001,Test Product,STOCKED_GOOD,MEDS,box,50,120" > /tmp/test-import.csv

curl -s -X POST http://localhost:3001/api/v1/inventory/products/bulk-import \
  -H "Cookie: <session-cookie>" \
  -F "file=@/tmp/test-import.csv;type=text/csv"
```

Expected: `{"created":1}`

- [ ] **Step 13.5: Commit**

```bash
git add apps/api/src/modules/inventory/controllers/bulk-import.controller.ts \
        apps/api/src/modules/inventory/inventory.module.ts
git commit -m "feat(inventory): BulkImportController POST /inventory/products/bulk-import with Multer"
```

---

## Task 14: Frontend — Bulk Import Modal + Inventory Client

**Files:**
- Create: `apps/web/components/inventory/bulk-import-modal.tsx`
- Modify: `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx`

- [ ] **Step 14.1: Create `bulk-import-modal.tsx`**

Create `apps/web/components/inventory/bulk-import-modal.tsx`:

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface Props {
  onClose: () => void;
  onSuccess: (created: number) => void;
}

const TEMPLATE_CSV = `code,name,itemType,categoryCode,baseUnitSymbol,standardCost,baseSellingPrice,sku,barcode,genericName,reorderPoint,minimumStock
MED-001,Amoxicillin 250mg,STOCKED_GOOD,MEDS,box,100,180,,,Amoxicillin,10,5
SVC-001,Consultation Service,SERVICE,SVCS,each,0,500,,,,,`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(f.type) && !f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) {
      setServerError('Only .csv and .xlsx files are supported.');
      return;
    }
    setFile(f);
    setRowErrors([]);
    setServerError(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile],
  );

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setRowErrors([]);
    setServerError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await apiClient.postForm<{ created: number }>(
        '/inventory/products/bulk-import',
        formData,
      );
      onSuccess(result.created);
    } catch (err: unknown) {
      const errObj = err as { status?: number; data?: { errors?: RowError[]; message?: string } };
      if (errObj?.data?.errors?.length) {
        setRowErrors(errObj.data.errors);
      } else {
        setServerError(errObj?.data?.message ?? 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Bulk Import Products</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-md bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-700">
              Download the CSV template with the required column headers.
            </p>
            <button
              onClick={downloadTemplate}
              className="ml-3 shrink-0 text-sm font-medium text-blue-600 underline hover:text-blue-800"
            >
              Download template
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg px-6 py-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <p className="text-sm font-medium text-gray-800">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">Drag & drop a .csv or .xlsx file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse — max 5 MB</p>
              </>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-4 py-2">{serverError}</p>
          )}

          {/* Row-level errors */}
          {rowErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 max-h-48 overflow-y-auto">
              <p className="px-4 py-2 text-sm font-semibold text-red-800">
                {rowErrors.length} validation error{rowErrors.length !== 1 ? 's' : ''} — fix and re-upload:
              </p>
              <ul className="divide-y divide-red-100">
                {rowErrors.map((e, i) => (
                  <li key={i} className="px-4 py-1 text-xs text-red-700">
                    Row {e.row} · <span className="font-mono">{e.field}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!file || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

> **Note on `apiClient.postForm`:** Check if `apiClient` already has a `postForm` method. If not, add one:
>
> In `apps/web/lib/api-client.ts`, add:
> ```typescript
> async postForm<T>(path: string, formData: FormData): Promise<T> {
>   const res = await fetch(`/api/v1${path}`, {
>     method: 'POST',
>     body: formData,
>     headers: { 'x-active-branch': this.getActiveBranchId() ?? '' },
>   });
>   const envelope = await res.json();
>   if (!res.ok) throw { status: res.status, data: envelope };
>   return envelope.data ?? envelope;
> }
> ```
>
> Adjust to match the existing `apiClient` pattern for request building (headers, cookie forwarding).

- [ ] **Step 14.2: Add Import button + modal to `inventory-client.tsx`**

In `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx`:

Import the modal:
```typescript
import BulkImportModal from '@/components/inventory/bulk-import-modal';
```

Add state:
```typescript
const [showImport, setShowImport] = useState(false);
```

Add the button near the "New Item" / header action area:
```tsx
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
          >
            Import
          </button>
```

Add the modal at the end of the JSX return:
```tsx
        {showImport && (
          <BulkImportModal
            onClose={() => setShowImport(false)}
            onSuccess={(created) => {
              setShowImport(false);
              fetchItems(); // re-fetch after import
              // Optionally show a toast: `${created} items imported`
            }}
          />
        )}
```

- [ ] **Step 14.3: Check that `fetchItems` is accessible in `inventory-client.tsx`**

The `fetchItems` callback should already exist (it fetches from `apiClient`). If the function is defined inline in a `useEffect`, extract it to a `useCallback` so it can be called imperatively:

```typescript
const fetchItems = useCallback(async () => {
  // ...existing fetch logic...
}, [activeBranch]);

useEffect(() => {
  fetchItems();
}, [fetchItems]);
```

- [ ] **Step 14.4: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 14.5: Commit**

```bash
git add apps/web/components/inventory/bulk-import-modal.tsx \
        apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx \
        apps/web/lib/api-client.ts
git commit -m "feat(web/inventory): BulkImportModal with drag-and-drop, template download, row error display"
```

---

## Final Integration Check

- [ ] **Step F.1: Run all API unit tests**

From `apps/api/`:

```bash
npx jest --no-coverage
```

Expected: all tests pass (including `sku-sequence.service.spec.ts`, `bulk-import.service.spec.ts`, `product.service.spec.ts`, `stock.service.spec.ts`).

- [ ] **Step F.2: TypeScript clean build**

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
cd packages/types && npx tsc --noEmit
```

Expected: no errors in any package.

- [ ] **Step F.3: Run E2E tests**

With both servers running (NestJS on 3001, Next.js on 3000):

```bash
cd apps/web && npx playwright test test/e2e/inventory-items.spec.ts --reporter=list
```

Expected: all inventory item tests pass.

- [ ] **Step F.4: Final commit**

```bash
git add .
git commit -m "chore: Item Master ERP Extension — GL accounts, SKU/barcode, reorder-point, bulk import complete"
```

---

## Appendix: CSV Template Column Reference

| Column | Required | Type | Notes |
|---|---|---|---|
| `code` | Yes | string | Unique item code within clinic; uppercase |
| `name` | Yes | string | Display name |
| `itemType` | Yes | `STOCKED_GOOD` or `SERVICE` | |
| `categoryCode` | Yes | string | Must match an existing `ItemCategory.code` |
| `baseUnitSymbol` | Yes | string | Must match an existing `UnitOfMeasure.symbol` |
| `standardCost` | Yes | number ≥ 0 | Cost price |
| `baseSellingPrice` | Yes | number ≥ 0 | Retail price |
| `sku` | No | string | Leave blank for auto-generation (`ITM-NNNNN`) |
| `barcode` | No | string | EAN-13, QR, etc. — must be globally unique |
| `genericName` | No | string | Generic/INN name (medications) |
| `reorderPoint` | No | number ≥ 0 | Trigger reorder at this quantity |
| `minimumStock` | No | number ≥ 0 | Critical alert threshold |

---

## Appendix: GL Account Codes Reference (Seeded)

| Code | Name | Type |
|---|---|---|
| 1100 | Cash and Cash Equivalents | ASSET |
| 1200 | Accounts Receivable | ASSET |
| 1300 | Inventory — Medications | ASSET |
| 1310 | Inventory — Supplies & Consumables | ASSET |
| 1320 | Inventory — Vaccines | ASSET |
| 2100 | Accounts Payable | LIABILITY |
| 2200 | VAT Payable | LIABILITY |
| 2300 | Withholding Tax Payable | LIABILITY |
| 3100 | Retained Earnings | EQUITY |
| 4100 | Veterinary Service Revenue | REVENUE |
| 4200 | Medication Sales Revenue | REVENUE |
| 4300 | Grooming & Boarding Revenue | REVENUE |
| 4400 | Vaccination Revenue | REVENUE |
| 4500 | Laboratory & Diagnostic Revenue | REVENUE |
| 5100 | Cost of Goods Sold — Medications | COGS |
| 5200 | Cost of Goods Sold — Supplies | COGS |
| 5300 | Cost of Goods Sold — Vaccines | COGS |
| 6100 | Staff Salaries & Wages | EXPENSE |
| 6200 | Rent & Utilities | EXPENSE |
| 6300 | Medical Equipment Depreciation | EXPENSE |
