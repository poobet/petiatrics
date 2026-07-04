# Feature Specification: Procurement Module (Purchase to Pay)

**Feature Branch**: `009-procurement-system`  
**Status**: Draft  
**Context**: Building upon the existing Multi-Tenant Identity, Item Master, and Inventory Management foundations, this module introduces the full procurement lifecycle: Purchase Orders (PO), Goods Receipts, Purchase Invoices (Supplier Bills), and Supplier Payments.

---

## 1. Overview & Objectives

The primary goal of the Procurement module is to manage commercial agreements with suppliers, track physical delivery of goods into clinic branches, match invoices, and record accounts payable allocations. 

This module enforces strict transaction-level matching (Approach A) to ensure that what is ordered matches what is received and what is paid for, maintaining absolute data consistency across inventory and future accounting systems.

---

## 2. Key Modules & Functional Requirements (FR)

### 2.1 Clinic-Wide Purchase Orders (PO)
*   **FR-101**: The system MUST support creating, updating, and viewing Purchase Orders at the **Clinic (Tenant) level**.
*   **FR-102**: Every PO MUST reference a valid Supplier (`BusinessPartner` with type `SUPPLIER` or role `AP_BUY_FROM`).
*   **FR-103**: Every PO MUST generate a unique, human-readable document code (e.g., `PO-YYYY-XXXX`) scoped to the clinic.
*   **FR-104**: Every PO Line item MUST reference a `Product` and specify `quantityOrdered`, purchase `unitPriceMinor` (integer cents), and optional alternate `UnitOfMeasure`.
*   **FR-105**: PO status transitions MUST follow: `DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `PARTIALLY_RECEIVED` $\rightarrow$ `FULLY_RECEIVED` $\rightarrow$ `CLOSED` or `CANCELLED`.

### 2.2 Role-Based PO Approval Flow
*   **FR-106**: If a PO is created by a user with the `STAFF` or `ASSISTANT` role, it MUST start in `DRAFT` status and require submission to `PENDING_APPROVAL`.
*   **FR-107**: Users with the `CLINIC_OWNER`, `VET`, or `SUPER_ADMIN` roles can self-approve their POs immediately during creation, moving them directly to `APPROVED`.
*   **FR-108**: Only users with the `CLINIC_OWNER`, `VET`, or `SUPER_ADMIN` roles are permitted to approve POs in the `PENDING_APPROVAL` status.

### 2.3 Branch-Specific Goods Receipts (GR)
*   **FR-109**: Physical delivery of stock is branch-specific. Every `GoodsReceiptLine` MUST specify the target `branchId` where the items are delivered and received.
*   **FR-110**: When receiving items against an approved PO, the system MUST auto-populate the receipt lines with the outstanding quantities (`quantityOrdered - quantityReceived`).
*   **FR-111**: The system MUST support **Over-Receiving Validation**: If the received quantity on a line exceeds the remaining ordered quantity, the system MUST hard-block the receipt unless the user provides a mandatory `overrideReason` (logged for audit trails).
*   **FR-112**: Committing a Goods Receipt MUST automatically:
    1. Increment the `BranchStockBalance` for the target product, branch, and lot number.
    2. Write an immutable `StockMovement` ledger entry with `reason = GOODS_RECEIPT`.
    3. Update `quantityReceived` on the corresponding `PurchaseOrderLine`.
    4. Emit the event `goods_receipt.committed`.

### 2.4 Medical Compliance (Lot & Expiry Tracking)
*   **FR-113**: During Goods Receipt, if the `Product.requiresBatchAndExpiryTracking` flag is `true`, the system MUST strictly require the user to input a non-empty `lotNumber` and a future `expiryDate` for that line. If missing or invalid, the receipt transaction MUST be rejected.

### 2.5 UoM Conversion Logic
*   **FR-114**: If a PO/GR line specifies an alternate UoM (e.g. "Box of 12" instead of the base "Piece"), the system MUST fetch the conversion ratio from `ItemUnitConversion` and calculate:
    $$\text{Quantity (Base Unit)} = \text{Received Quantity (Purchase Unit)} \times \text{conversionRatio}$$
*   **FR-115**: Stock balances and movements MUST be recorded strictly using the converted Base Unit quantity and standard pricing.

### 2.6 Purchase Invoices (Supplier Bills) & Matching
*   **FR-116**: The system MUST allow entering a Purchase Invoice (PI) by referencing the supplier's external `invoiceNumber` and generating an internal `code` (e.g. `PI-YYYY-XXXX`).
*   **FR-117**: Users MUST be able to create a PI from two sources:
    1. **Order-Based**: Select an approved PO directly.
    2. **Receipt-Based**: Select one or more committed Goods Receipts for a supplier.
*   **FR-118**: The system MUST support **Over-Invoicing Validation**: The invoiced quantity cannot exceed the remaining uninvoiced quantity:
    *   *Receipt-Based*: `quantityReceived - quantityInvoiced`.
    *   *Order-Based*: `quantityOrdered - quantityInvoiced`.
*   **FR-119**: Posting an invoice (`status = POSTED`) locks the document from edits and emits `purchase_invoice.posted`.

### 2.7 Centralized Supplier Payments
*   **FR-120**: A `SupplierPayment` entity tracks cash/bank outflows paid to a specific supplier.
*   **FR-121**: A single `SupplierPayment` MUST support distributing its total amount across multiple outstanding `PurchaseInvoices` via `SupplierPaymentAllocation` records.
*   **FR-122**: Allocations MUST automatically update the corresponding invoice's `amountPaidMinor` and status (`UNPAID` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `PAID`), and emit `supplier_payment.allocated`.

---

## 3. Proposed Data Model Additions

We will add the following enums and models to `schema.prisma`.

```prisma
// ─── Enums ───────────────────────────────────────────────────────────────────

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

// ─── Models ──────────────────────────────────────────────────────────────────

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

---

## 4. UI/UX Requirements & Workspaces

The procurement portal will be accessible at `/procurement` within the clinic route group, styled as a high-density ERP interface:

1.  **Dashboard/Tabbed Workspace**:
    *   **Purchase Orders Tab**: A table tracking codes, vendors, order dates, totals, and statuses. Action buttons to Approve (conditional on role), cancel, or edit.
    *   **Goods Receipts Tab**: A table tracking physical receipts. Includes a "Receive Goods" modal that allows selecting a supplier and PO, mapping outstanding quantities, choosing target branches, and inputting mandatory Lot/Expiry info.
    *   **Supplier Invoices Tab**: A table matching supplier bills to active POs or committed receipts. Shows variance checks if invoice totals differ.
    *   **Payments Tab**: A utility screen allowing users to record bank transaction references and allocate funds across outstanding bills.

2.  **Interactive Elements**:
    *   Red asterisks next to Lot/Expiry fields for regulated products during Goods Receipt.
    *   Multi-select list for Goods Receipts when creating a Purchase Invoice.
    *   An "Auto-Allocate" button in the payment screen that allocates cash starting from the oldest invoice.

---

## 5. Out of Scope for this Phase
*   **Supplier Email Integration**: Automatically emailing PDF Purchase Orders to vendors (deferred to a communication module).
*   **Automated PO Generation**: Creating PO suggestions automatically based on Low Stock Alerts (must be done manually by checking inventory replenishment lists).
*   **Direct Ledger Entries**: Creating journal debit/credit records (delegated to a separate ledger module reacting to events).
