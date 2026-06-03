# Parent-Child Product Bundling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow products to define accessory/child product relations, so that selecting a parent product on visit prescriptions or billing invoices automatically appends the child items with a configured multiplier ratio.

**Architecture:** Create a self-referencing many-to-many `ProductAccessory` table in PostgreSQL. Modify backend product service to support accessories CRUD, update frontend product form with an "Accessories/Bundle" tab, and update visit record and billing endpoints/forms to auto-add child lines when a parent item is selected.

**Tech Stack:** NestJS (Backend), Next.js App Router (Frontend), Prisma ORM (Database), Radix UI Sheet (UI components).

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Define ProductAccessory model in schema.prisma**
  Add the `ProductAccessory` model and bidirectional self-references in the `Product` model:
  ```prisma
  // In Product model:
  model Product {
    id                             String    @id @default(uuid())
    // ... existing fields ...
    parentProductAccessories       ProductAccessory[] @relation("ParentProductRelations")
    childProductAccessories        ProductAccessory[] @relation("ChildProductRelations")
  }

  // New model:
  model ProductAccessory {
    id              String   @id @default(uuid())
    parentProductId String
    childProductId  String
    quantityRatio   Decimal  @db.Decimal(10, 3) @default(1.0)
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    parentProduct   Product  @relation("ParentProductRelations", fields: [parentProductId], references: [id], onDelete: Cascade)
    childProduct    Product  @relation("ChildProductRelations", fields: [childProductId], references: [id], onDelete: Cascade)

    @@unique([parentProductId, childProductId])
    @@index([parentProductId])
    @@index([childProductId])
    @@map("product_accessories")
  }
  ```

- [ ] **Step 2: Generate and apply database migration**
  Run in terminal (under `packages/database`):
  `npm run db:migrate --name=add_product_accessories`
  Expected: Migration succeeds and Prisma Client regenerated.

- [ ] **Step 3: Commit**
  ```bash
  git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
  git commit -m "db(schema): add product accessories join table"
  ```

---

### Task 2: Update Product DTOs

**Files:**
- Modify: `apps/api/src/modules/inventory/dto/create-product.dto.ts`
- Modify: `apps/api/src/modules/inventory/dto/update-product.dto.ts`

- [ ] **Step 1: Add ProductAccessoryDto to create-product.dto.ts**
  Add class definition:
  ```typescript
  export class ProductAccessoryDto {
    @IsUUID()
    childProductId!: string;

    @IsNumber()
    @Min(0.001)
    quantityRatio!: number;
  }
  ```
  Add `accessories` to `CreateProductDto`:
  ```typescript
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductAccessoryDto)
    accessories?: ProductAccessoryDto[];
  ```

- [ ] **Step 2: Add accessories to update-product.dto.ts**
  Import `ProductAccessoryDto` from `./create-product.dto` and add to `UpdateProductDto`:
  ```typescript
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductAccessoryDto)
    accessories?: ProductAccessoryDto[];
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/api/src/modules/inventory/dto/create-product.dto.ts apps/api/src/modules/inventory/dto/update-product.dto.ts
  git commit -m "feat(dto): add accessories field to product create and update DTOs"
  ```

---

### Task 3: Backend Product Service & Controller CRUD

**Files:**
- Modify: `apps/api/src/modules/inventory/services/product.service.ts`
- Modify: `apps/api/src/modules/inventory/services/product.service.spec.ts`

- [ ] **Step 1: Update Product Service mapping and creation**
  In `ProductService`:
  * Add `parentProductAccessories: { include: { childProduct: { select: { id: true, name: true, code: true, sku: true, itemType: true } } } }` to `PRODUCT_INCLUDE_DETAIL` constant.
  * In `create()`:
    If `dto.accessories` is provided, create the `parentProductAccessories` nested relation.
  * In `update()`:
    If `dto.accessories` is provided, run `tx.productAccessory.deleteMany({ where: { parentProductId: id } })`, then insert new accessories rows.
  * In `findAll()` and `findById()`, map `parentProductAccessories` to `accessories: { childProductId, name, code, sku, itemType, quantityRatio }[]`.

- [ ] **Step 2: Write unit tests in product.service.spec.ts**
  Add unit tests verifying:
  * Creating a product with accessories saves relations correctly.
  * Updating a product replaces old accessories with new ones.
  * Retrieving product details returns the accessories array.

- [ ] **Step 3: Run service tests**
  Run: `npx turbo run test --filter=@petiatrics/api -- src/modules/inventory/services/product.service.spec.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add apps/api/src/modules/inventory/services/product.service.ts apps/api/src/modules/inventory/services/product.service.spec.ts
  git commit -m "feat(inventory): implement backend product accessories CRUD and service logic"
  ```

---

### Task 4: Frontend Product Accessories Tab

**Files:**
- Create: `apps/web/components/inventory/tabs/accessories-tab.tsx`
- Modify: `apps/web/components/inventory/item-form.tsx`
- Modify: `apps/web/components/inventory/item-form-types.ts`
- Modify: `apps/web/components/inventory/item-form-schema.ts`

- [ ] **Step 1: Update item form types and schema**
  Add `accessories` array properties to `ItemFormValues` and default values.
  Update schema validation in `item-form-schema.ts`.

- [ ] **Step 2: Create accessories-tab.tsx**
  Implement the UI tab listing added accessories with editable multipliers, search/add combobox filtering out current product, and delete buttons.

- [ ] **Step 3: Add tab to item-form.tsx**
  Include `accessories` tab option and render `AccessoriesTab` when active.
  Include `accessories` list mapping on submit payload.

- [ ] **Step 4: Run build check**
  Run: `npx turbo run build --filter=@petiatrics/web`
  Expected: Compiled successfully

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/components/inventory/
  git commit -m "feat(web): add accessories tab to product edit form"
  ```

---

### Task 5: Prescription Form Auto-Population

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/patients/[id]/visits/new/page.tsx`

- [ ] **Step 1: Replace drug name text input with ItemSearchCombobox**
  Import `ItemSearchCombobox` from `@/components/inventory/item-search-combobox`.
  Render it inside the New Prescription input fields section.

- [ ] **Step 2: Auto-populate child items**
  When a product is selected, fetch its details. If accessories exist:
  * Append the selected parent item to `prescriptions`.
  * Append all accessory items to the `prescriptions` array with calculated quantities.

- [ ] **Step 3: Commit**
  ```bash
  git add apps/web/app/(clinic)/clinic/patients/[id]/visits/new/page.tsx
  git commit -m "feat(prescription): auto-populate child items when parent item is added"
  ```

---

### Task 6: Invoice Backend Auto-Population

**Files:**
- Modify: `apps/api/src/modules/billing/services/invoice.service.ts`
- Modify: `apps/api/src/modules/billing/services/invoice.service.spec.ts`

- [ ] **Step 1: Update InvoiceService.create to auto-expand line items**
  In `InvoiceService.create()`:
  * For each `lineItem` of type `PRODUCT` with `sourceReferenceId`:
    * Query `ProductAccessory` relationships for `parentProductId = sourceReferenceId`.
    * For each relation found, fetch child product details.
    * Append child item as a new line item: `itemType: childProduct.itemType`, `description: childProduct.name`, `quantity: parentQty * quantityRatio`, `unitPriceMinor: childProduct.baseSellingPrice`, `sourceReferenceId: childProduct.id`.

- [ ] **Step 2: Write tests in invoice.service.spec.ts**
  Add unit tests verifying:
  * Creating an invoice with a parent product automatically expands line items with child accessories and correct totals.

- [ ] **Step 3: Run billing tests**
  Run: `npx turbo run test --filter=@petiatrics/api -- src/modules/billing/services/invoice.service.spec.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add apps/api/src/modules/billing/services/invoice.service.ts apps/api/src/modules/billing/services/invoice.service.spec.ts
  git commit -m "feat(billing): auto-expand accessories as line items in invoice creation"
  ```
