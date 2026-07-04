# Procurement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full-lifecycle multi-tenant Procurement module (Purchase Orders, Goods Receipts, Purchase Invoices, and Supplier Payments) with strict line-item matching and branch-scoped physical stock updates.

**Architecture:** NestJS REST controllers calling transactional services using Prisma client. Events will be emitted on major status transitions (`goods_receipt.committed`, `purchase_invoice.posted`). The Next.js clinic portal will expose a tabbed ERP-style workspace with form wizards.

**Tech Stack:** TypeScript, NestJS, Prisma, PostgreSQL, Next.js, Tailwind CSS, Radix UI.

---

## Proposed Changes

### Task 1: Prisma Schema Migration
**Files:**
*   Modify: [schema.prisma](file:///d:/Deaw/petiatrics/packages/database/prisma/schema.prisma)
*   Run: `npm run prisma:migrate` (or local equivalent)

- [ ] **Step 1: Add Enums & Models to schema.prisma**
  Open [schema.prisma](file:///d:/Deaw/petiatrics/packages/database/prisma/schema.prisma) and append the following enums and models:
  ```prisma
  enum PurchaseOrderStatus {
    DRAFT
    PENDING_APPROVAL
    APPROVED
    PARTIALLY_RECEIVED
    FULLY_RECEIVED
    CANCELLED
    CLOSED
  }

  enum GoodsReceiptStatus {
    DRAFT
    COMMITTED
    CANCELLED
  }

  enum PurchaseInvoiceStatus {
    DRAFT
    POSTED
    PARTIALLY_PAID
    PAID
    VOIDED
  }

  model PurchaseOrder {
    id              String              @id @default(uuid())
    clinicId        String
    supplierId      String
    code            String              // e.g., "PO-2026-0001"
    status          PurchaseOrderStatus @default(DRAFT)
    orderDate       DateTime            @default(now())
    creditTermDays  Int                 @default(0)
    notes           String?             @db.Text
    subtotalMinor   Int                 @default(0)
    taxTotalMinor   Int                 @default(0)
    totalMinor      Int                 @default(0)
    createdById     String
    approvedById    String?
    approvedAt      DateTime?
    createdAt       DateTime            @default(now())
    updatedAt       DateTime            @updatedAt

    clinic          Clinic            @relation(fields: [clinicId], references: [id])
    supplier        BusinessPartner   @relation(fields: [supplierId], references: [id])
    createdBy       User              @relation("POCreatedBy", fields: [createdById], references: [id])
    approvedBy      User?             @relation("POApprovedBy", fields: [approvedById], references: [id])
    lines           PurchaseOrderLine[]
    goodsReceipts   GoodsReceipt[]
    purchaseInvoices PurchaseInvoice[]

    @@unique([clinicId, code])
    @@index([clinicId])
    @@index([supplierId])
    @@map("purchase_orders")
  }

  model PurchaseOrderLine {
    id                String   @id @default(uuid())
    purchaseOrderId   String
    productId         String
    uomId             String?  // Alt UoM if ordered in alternate units
    quantityOrdered   Decimal  @db.Decimal(10, 3)
    quantityReceived  Decimal  @default(0) @db.Decimal(10, 3)
    quantityInvoiced  Decimal  @default(0) @db.Decimal(10, 3)
    unitPriceMinor    Int
    subtotalMinor     Int
    taxRateBps        Int      @default(0) // e.g. 700 = 7%
    taxTotalMinor     Int      @default(0)
    totalMinor        Int      @default(0)
    createdAt         DateTime @default(now())
    updatedAt         DateTime @updatedAt

    purchaseOrder     PurchaseOrder      @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
    product           Product            @relation(fields: [productId], references: [id])
    uom               UnitOfMeasure?     @relation(fields: [uomId], references: [id])
    receiptLines      GoodsReceiptLine[]
    invoiceLines      PurchaseInvoiceLine[]

    @@index([purchaseOrderId])
    @@index([productId])
    @@map("purchase_order_lines")
  }

  model GoodsReceipt {
    id              String             @id @default(uuid())
    clinicId        String
    purchaseOrderId String?            // Optional for ad-hoc receipt
    code            String             // e.g., "GR-2026-0001"
    status          GoodsReceiptStatus @default(DRAFT)
    receivedDate    DateTime           @default(now())
    receivedById    String
    overrideReason  String?            // If over-received
    createdAt       DateTime           @default(now())
    updatedAt       DateTime           @updatedAt

    clinic          Clinic             @relation(fields: [clinicId], references: [id])
    purchaseOrder   PurchaseOrder?     @relation(fields: [purchaseOrderId], references: [id])
    receivedBy      User               @relation(fields: [receivedById], references: [id])
    lines           GoodsReceiptLine[]
    invoiceLines    PurchaseInvoiceLine[]

    @@unique([clinicId, code])
    @@index([clinicId])
    @@index([purchaseOrderId])
    @@map("goods_receipts")
  }

  model GoodsReceiptLine {
    id              String   @id @default(uuid())
    goodsReceiptId  String
    poLineId        String?
    branchId        String   // Branch-specific delivery location
    productId       String
    uomId           String?
    quantityReceived Decimal  @db.Decimal(10, 3)
    lotNumber       String?
    expiryDate      DateTime?
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    goodsReceipt    GoodsReceipt       @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)
    poLine          PurchaseOrderLine? @relation(fields: [poLineId], references: [id])
    branch          Branch             @relation(fields: [branchId], references: [id])
    product         Product            @relation(fields: [productId], references: [id])
    uom             UnitOfMeasure?     @relation(fields: [uomId], references: [id])
    invoiceLines    PurchaseInvoiceLine[]

    @@index([goodsReceiptId])
    @@index([branchId])
    @@index([productId])
    @@map("goods_receipt_lines")
  }

  model PurchaseInvoice {
    id              String                @id @default(uuid())
    clinicId        String
    supplierId      String
    purchaseOrderId String?
    invoiceNumber   String                // Vendor's invoice number
    code            String                // e.g., "PI-2026-0001"
    status          PurchaseInvoiceStatus @default(DRAFT)
    invoiceDate     DateTime
    dueDate         DateTime
    subtotalMinor   Int                   @default(0)
    taxTotalMinor   Int                   @default(0)
    totalMinor      Int                   @default(0)
    amountPaidMinor Int                   @default(0)
    createdById     String
    createdAt       DateTime              @default(now())
    updatedAt       DateTime              @updatedAt

    clinic          Clinic                @relation(fields: [clinicId], references: [id])
    supplier        BusinessPartner       @relation(fields: [supplierId], references: [id])
    purchaseOrder   PurchaseOrder?        @relation(fields: [purchaseOrderId], references: [id])
    createdBy       User                  @relation(fields: [createdById], references: [id])
    lines           PurchaseInvoiceLine[]
    allocations     SupplierPaymentAllocation[]

    @@unique([clinicId, code])
    @@index([clinicId])
    @@index([supplierId])
    @@map("purchase_invoices")
  }

  model PurchaseInvoiceLine {
    id                String   @id @default(uuid())
    purchaseInvoiceId String
    poLineId          String?
    grLineId          String?
    productId         String
    quantity          Decimal  @db.Decimal(10, 3)
    unitPriceMinor    Int
    subtotalMinor     Int
    taxRateBps        Int      @default(0)
    taxTotalMinor     Int      @default(0)
    totalMinor        Int      @default(0)
    createdAt         DateTime @default(now())
    updatedAt         DateTime @updatedAt

    purchaseInvoice   PurchaseInvoice    @relation(fields: [purchaseInvoiceId], references: [id], onDelete: Cascade)
    poLine            PurchaseOrderLine? @relation(fields: [poLineId], references: [id])
    grLine            GoodsReceiptLine?  @relation(fields: [grLineId], references: [id])
    product           Product            @relation(fields: [productId], references: [id])

    @@index([purchaseInvoiceId])
    @@map("purchase_invoice_lines")
  }

  model SupplierPayment {
    id              String   @id @default(uuid())
    clinicId        String
    supplierId      String
    code            String   // e.g., "SP-2026-0001"
    paymentDate     DateTime @default(now())
    paymentMethod   String   // e.g., "BANK_TRANSFER", "CASH"
    referenceNumber String?
    amountMinor     Int
    createdById     String
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    clinic          Clinic   @relation(fields: [clinicId], references: [id])
    supplier        BusinessPartner @relation(fields: [supplierId], references: [id])
    createdBy       User     @relation(fields: [createdById], references: [id])
    allocations     SupplierPaymentAllocation[]

    @@unique([clinicId, code])
    @@index([clinicId])
    @@index([supplierId])
    @@map("supplier_payments")
  }

  model SupplierPaymentAllocation {
    id                  String   @id @default(uuid())
    paymentId           String
    purchaseInvoiceId   String
    amountAllocatedMinor Int
    createdAt           DateTime @default(now())

    payment             SupplierPayment @relation(fields: [paymentId], references: [id], onDelete: Cascade)
    invoice             PurchaseInvoice @relation(fields: [purchaseInvoiceId], references: [id], onDelete: Cascade)

    @@index([paymentId])
    @@index([purchaseInvoiceId])
    @@map("supplier_payment_allocations")
  }
  ```
  Also, update the `Clinic` model relations to link with the new models:
  ```prisma
  model Clinic {
    // ... existing fields ...
    purchaseOrders   PurchaseOrder[]
    goodsReceipts    GoodsReceipt[]
    purchaseInvoices PurchaseInvoice[]
    supplierPayments SupplierPayment[]
  }
  ```
  And updates to the `User` model relations:
  ```prisma
  model User {
    // ... existing fields ...
    createdPOs       PurchaseOrder[] @relation("POCreatedBy")
    approvedPOs      PurchaseOrder[] @relation("POApprovedBy")
    goodsReceipts    GoodsReceipt[]
    purchaseInvoices PurchaseInvoice[]
    supplierPayments SupplierPayment[]
  }
  ```

- [ ] **Step 2: Generate Prisma Client and DB Migration**
  Run: `npx prisma migrate dev --name add_procurement_models` inside `packages/database`.
  Expected: Successful migration and updated Prisma client.

- [ ] **Step 3: Commit migration**
  Run: `git add packages/database` and `git commit -m "db: add procurement tables schema"`

---

### Task 2: Backend - Purchase Order DTOs & Services
**Files:**
*   Create: `apps/api/src/modules/procurement/dtos/create-purchase-order.dto.ts`
*   Create: `apps/api/src/modules/procurement/services/purchase-order.service.ts`

- [ ] **Step 1: Write DTOs for PO creation**
  Create the file `apps/api/src/modules/procurement/dtos/create-purchase-order.dto.ts`:
  ```typescript
  import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsNumber, IsPositive } from 'class-validator';
  import { Type } from 'class-transformer';

  export class PurchaseOrderLineDto {
    @IsString()
    @IsNotEmpty()
    productId: string;

    @IsString()
    @IsOptional()
    uomId?: string;

    @IsNumber()
    @IsPositive()
    quantityOrdered: number;

    @IsNumber()
    @IsPositive()
    unitPriceMinor: number;

    @IsNumber()
    @IsOptional()
    taxRateBps?: number;
  }

  export class CreatePurchaseOrderDto {
    @IsString()
    @IsNotEmpty()
    supplierId: string;

    @IsNumber()
    @IsOptional()
    creditTermDays?: number;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PurchaseOrderLineDto)
    lines: PurchaseOrderLineDto[];
  }
  ```

- [ ] **Step 2: Implement PurchaseOrderService**
  Create `apps/api/src/modules/procurement/services/purchase-order.service.ts` implementing draft creation, status changes, role approvals, and code sequencing. Include auto-increment logic for codes within a clinic:
  ```typescript
  import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
  import { PrismaService } from '../../prisma/prisma.service'; // Adjust path
  import { CreatePurchaseOrderDto } from '../dtos/create-purchase-order.dto';
  import { PurchaseOrderStatus, Role } from '@prisma/client';

  @Injectable()
  export class PurchaseOrderService {
    constructor(private prisma: PrismaService) {}

    async create(clinicId: string, userId: string, userRole: Role, dto: CreatePurchaseOrderDto) {
      // Sequence code generator
      const dateStr = new Date().getFullYear().toString();
      const count = await this.prisma.purchaseOrder.count({ where: { clinicId } });
      const code = `PO-${dateStr}-${String(count + 1).padStart(4, '0')}`;

      let subtotal = 0;
      let taxTotal = 0;

      const linesToCreate = dto.lines.map(line => {
        const lineSubtotal = Math.round(line.quantityOrdered * line.unitPriceMinor);
        const lineTax = Math.round(lineSubtotal * ((line.taxRateBps || 0) / 10000));
        subtotal += lineSubtotal;
        taxTotal += lineTax;

        return {
          productId: line.productId,
          uomId: line.uomId,
          quantityOrdered: line.quantityOrdered,
          unitPriceMinor: line.unitPriceMinor,
          subtotalMinor: lineSubtotal,
          taxRateBps: line.taxRateBps || 0,
          taxTotalMinor: lineTax,
          totalMinor: lineSubtotal + lineTax,
        };
      });

      // Role check: Admin/Owner/Vet can self-approve, Staff starts as DRAFT
      const autoApprove = [Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.VET].includes(userRole);
      const status = autoApprove ? PurchaseOrderStatus.APPROVED : PurchaseOrderStatus.DRAFT;

      return this.prisma.purchaseOrder.create({
        data: {
          clinicId,
          supplierId: dto.supplierId,
          code,
          status,
          creditTermDays: dto.creditTermDays || 0,
          notes: dto.notes,
          subtotalMinor: subtotal,
          taxTotalMinor: taxTotal,
          totalMinor: subtotal + taxTotal,
          createdById: userId,
          approvedById: autoApprove ? userId : null,
          approvedAt: autoApprove ? new Date() : null,
          lines: {
            create: linesToCreate,
          },
        },
        include: { lines: true },
      });
    }

    async approve(clinicId: string, userId: string, userRole: Role, poId: string) {
      if (![Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.VET].includes(userRole)) {
        throw new ForbiddenException('Only managers, owners or vets can approve POs');
      }

      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: poId, clinicId },
      });

      if (!po) throw new NotFoundException('Purchase order not found');

      return this.prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: PurchaseOrderStatus.APPROVED,
          approvedById: userId,
          approvedAt: new Date(),
        },
      });
    }
  }
  ```

- [ ] **Step 3: Commit files**
  Run: `git add apps/api/src/modules/procurement` and commit.

---

### Task 3: Backend - Goods Receipt Implementation
**Files:**
*   Create: `apps/api/src/modules/procurement/dtos/create-goods-receipt.dto.ts`
*   Create: `apps/api/src/modules/procurement/services/goods-receipt.service.ts`

- [ ] **Step 1: Write DTOs for Goods Receipt**
  Create `apps/api/src/modules/procurement/dtos/create-goods-receipt.dto.ts`:
  ```typescript
  import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber, IsPositive, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';

  export class GoodsReceiptLineDto {
    @IsString()
    @IsOptional()
    poLineId?: string;

    @IsString()
    @IsNotEmpty()
    branchId: string;

    @IsString()
    @IsNotEmpty()
    productId: string;

    @IsNumber()
    @IsPositive()
    quantityReceived: number;

    @IsString()
    @IsOptional()
    lotNumber?: string;

    @IsOptional()
    expiryDate?: Date;
  }

  export class CreateGoodsReceiptDto {
    @IsString()
    @IsOptional()
    purchaseOrderId?: string;

    @IsString()
    @IsOptional()
    overrideReason?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GoodsReceiptLineDto)
    lines: GoodsReceiptLineDto[];
  }
  ```

- [ ] **Step 2: Implement GoodsReceiptService with Over-Receiving and Medical Compliance checks**
  Create `apps/api/src/modules/procurement/services/goods-receipt.service.ts`.
  Ensure that:
  - If a product requires batch tracking, checking lot number/expiry is validated.
  - Increment the `BranchStockBalance` (create if doesn't exist, update otherwise).
  - Create the `StockMovement` records.
  - Track PO received quantities and update PO status to `PARTIALLY_RECEIVED` or `FULLY_RECEIVED`.
  ```typescript
  import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
  import { PrismaService } from '../../prisma/prisma.service';
  import { CreateGoodsReceiptDto } from '../dtos/create-goods-receipt.dto';
  import { GoodsReceiptStatus, PurchaseOrderStatus, StockMovementReason, StockMovementRefType, StockMovementStatus } from '@prisma/client';

  @Injectable()
  export class GoodsReceiptService {
    constructor(private prisma: PrismaService) {}

    async createAndCommit(clinicId: string, userId: string, dto: CreateGoodsReceiptDto) {
      // Sequence code generator
      const dateStr = new Date().getFullYear().toString();
      const count = await this.prisma.goodsReceipt.count({ where: { clinicId } });
      const code = `GR-${dateStr}-${String(count + 1).padStart(4, '0')}`;

      return this.prisma.$transaction(async (tx) => {
        // Validation loop
        for (const line of dto.lines) {
          const product = await tx.product.findFirst({
            where: { id: line.productId, clinicId },
          });
          if (!product) throw new NotFoundException(`Product ${line.productId} not found`);

          // Medical compliance validation
          if (product.requiresBatchAndExpiryTracking) {
            if (!line.lotNumber || !line.expiryDate) {
              throw new BadRequestException(`Product ${product.name} requires lot number and expiry date`);
            }
            if (new Date(line.expiryDate) <= new Date()) {
              throw new BadRequestException(`Expiry date for ${product.name} must be in the future`);
            }
          }

          // Over-receiving validation
          if (line.poLineId) {
            const poLine = await tx.purchaseOrderLine.findFirst({
              where: { id: line.poLineId },
            });
            if (poLine) {
              const remaining = Number(poLine.quantityOrdered) - Number(poLine.quantityReceived);
              if (line.quantityReceived > remaining && !dto.overrideReason) {
                throw new BadRequestException(`Over-receiving detected for ${product.name}. Override reason is required.`);
              }
            }
          }
        }

        // Create Goods Receipt
        const gr = await tx.goodsReceipt.create({
          data: {
            clinicId,
            purchaseOrderId: dto.purchaseOrderId,
            code,
            status: GoodsReceiptStatus.COMMITTED,
            receivedById: userId,
            overrideReason: dto.overrideReason,
            lines: {
              create: dto.lines.map(line => ({
                poLineId: line.poLineId,
                branchId: line.branchId,
                productId: line.productId,
                quantityReceived: line.quantityReceived,
                lotNumber: line.lotNumber,
                expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
              })),
            },
          },
          include: { lines: true },
        });

        // Perform inventory transactions
        for (const line of gr.lines) {
          // UoM conversion check
          let finalQty = line.quantityReceived;
          if (line.poLineId) {
            const poLine = await tx.purchaseOrderLine.findFirst({
              where: { id: line.poLineId },
              include: { uom: true },
            });
            if (poLine && poLine.uomId) {
              const conversion = await tx.itemUnitConversion.findFirst({
                where: { productId: line.productId, unitId: poLine.uomId },
              });
              if (conversion) {
                finalQty = Number(line.quantityReceived) * Number(conversion.ratioToBase);
              }
            }
          }

          // Update branch stock balance
          const balance = await tx.branchStockBalance.findFirst({
            where: {
              clinicId,
              branchId: line.branchId,
              productId: line.productId,
              lotNumber: line.lotNumber,
            },
          });

          if (balance) {
            await tx.branchStockBalance.update({
              where: { id: balance.id },
              data: {
                quantity: { increment: finalQty },
                version: { increment: 1 },
              },
            });
          } else {
            await tx.branchStockBalance.create({
              data: {
                clinicId,
                branchId: line.branchId,
                productId: line.productId,
                lotNumber: line.lotNumber,
                expiryDate: line.expiryDate,
                quantity: finalQty,
              },
            });
          }

          // Create stock movement ledger entry
          await tx.stockMovement.create({
            data: {
              clinicId,
              branchId: line.branchId,
              productId: line.productId,
              delta: finalQty,
              quantityBefore: balance ? balance.quantity : 0,
              quantityAfter: (balance ? Number(balance.quantity) : 0) + Number(finalQty),
              reason: StockMovementReason.GOODS_RECEIPT,
              referenceType: StockMovementRefType.REPLENISHMENT,
              referenceId: gr.id,
              actorId: userId,
              lotNumber: line.lotNumber,
              expiryDate: line.expiryDate,
              status: StockMovementStatus.COMMITTED,
            },
          });

          // Update PO quantities
          if (line.poLineId) {
            await tx.purchaseOrderLine.update({
              where: { id: line.poLineId },
              data: {
                quantityReceived: { increment: line.quantityReceived },
              },
            });
          }
        }

        // Auto update PO status
        if (dto.purchaseOrderId) {
          const poLines = await tx.purchaseOrderLine.findMany({
            where: { purchaseOrderId: dto.purchaseOrderId },
          });
          const allReceived = poLines.every(pl => Number(pl.quantityReceived) >= Number(pl.quantityOrdered));
          const someReceived = poLines.some(pl => Number(pl.quantityReceived) > 0);

          await tx.purchaseOrder.update({
            where: { id: dto.purchaseOrderId },
            data: {
              status: allReceived 
                ? PurchaseOrderStatus.FULLY_RECEIVED 
                : someReceived ? PurchaseOrderStatus.PARTIALLY_RECEIVED : PurchaseOrderStatus.APPROVED,
            },
          });
        }

        return gr;
      });
    }
  }
  ```

- [ ] **Step 3: Commit**
  Run: `git add apps/api/src/modules/procurement` and commit.

---

### Task 4: Backend - Controller & Module Integration
**Files:**
*   Create: `apps/api/src/modules/procurement/controllers/purchase-order.controller.ts`
*   Create: `apps/api/src/modules/procurement/controllers/goods-receipt.controller.ts`
*   Create: `apps/api/src/modules/procurement/procurement.module.ts`
*   Modify: `apps/api/src/app.module.ts` (Include `ProcurementModule`)

- [ ] **Step 1: Write Controllers**
  Implement controllers for purchase order and goods receipt. Inject the corresponding services and restrict endpoints using `TenantGuard` and `RolesGuard`.
- [ ] **Step 2: Wire up AppModule**
  Import the new `ProcurementModule` in the root `AppModule` of the NestJS API.
- [ ] **Step 3: Verify build**
  Run local build check: `npm run build --workspace=apps/api`
  Expected: Successful TypeScript compilation.
- [ ] **Step 4: Commit**
  Run: `git add apps/api` and commit.

---

### Task 5: Frontend UI - Procurement Hub & Forms
**Files:**
*   Create: `apps/web/app/(clinic)/procurement/page.tsx`
*   Create: `apps/web/app/(clinic)/procurement/components/purchase-orders-tab.tsx`
*   Create: `apps/web/app/(clinic)/procurement/components/goods-receipts-tab.tsx`

- [ ] **Step 1: Write page shell with tab router**
  Create the multi-tab layout using Tailwind and Radix Tabs, supporting Purchase Orders and Goods Receipts grids.
- [ ] **Step 2: Create Purchase Order Creation slide-over panel**
  Implement form logic to choose a Supplier, add products dynamically, input order quantites, prices, select alternate UoMs, and submit.
- [ ] **Step 3: Create Goods Receipt creation modal**
  Add input validation requiring Lot Number and Expiry Date if the received product demands medical compliance tracking.
- [ ] **Step 4: Verify frontend build**
  Run local build check: `npm run build --workspace=apps/web`
  Expected: Successful Next.js build.
- [ ] **Step 5: Commit**
  Run: `git commit -m "feat: add procurement frontend hub and components"`

---

## Verification Plan

### Automated Tests
- Run backend unit tests for lot compliance and conversion math:
  `npm run test --workspace=apps/api`

### Manual Verification
1. Login to the clinic dashboard (`http://localhost:3000/login`).
2. Navigate to `/procurement`.
3. Create a PO as a Cashier (should save as Draft).
4. Login as Owner/Manager and Approve the PO.
5. Record a Goods Receipt against the PO, setting the delivery branch. Verify stock balance matches base unit quantities.
