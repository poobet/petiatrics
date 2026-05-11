# Master Specification: Petiatrics ERP Core Architecture

## 1. Executive Summary
This document defines the complete Enterprise Resource Planning (ERP) architecture for the **Petiatrics** platform. It outlines the data models, domain boundaries, and business logic required to support a scalable, multi-branch veterinary clinic management system. 

The architecture strictly adheres to standard accounting principles (e.g., 3-Way Matching, Immutable Documents, Tax Distributions) and employs a Zero-Trust security model using Redis-backed sessions.

---

## 2. Global Architecture & Security

### 2.1 Session-Based Authentication (Zero-Trust)
* **No JWTs:** The system uses secure, stateful sessions backed by Redis to allow immediate revocation.
* **Context Injection:** The backend extracts the `sessionId` from an `HttpOnly` cookie.
* **Active Branch Header:** The frontend must send the `x-active-branch` HTTP header. The backend validates this against the `authorizedBranches` array stored in the Redis session.
* **Strict Tenant Isolation:** `clinicId` is derived **only** from the Redis session. It is never accepted from client payloads.

---

## 3. Master Data & Business Partners (BP)

### 3.1 Universal Business Partner (BP)
All human and corporate actors (Vets, Staff, Customers, Suppliers) are stored in a single unified `BusinessPartner` table.
* **Role Extensions:** Specific attributes are stored in 1-to-1 extension tables (`BpVet`, `BpSupplier`).
* **Identity Separation:** The `User` table holds login credentials and is strictly linked to a `BusinessPartner` record. A BP without a `User` record cannot log in (e.g., standard customers).

### 3.2 Product Catalog & Inventory Master
* **ItemMaster:** Stores all billable items and services (Medicines, Retail, Medical Services).
* **Warehouse:** Inventory is strictly tied to a `Branch`. Global clinic inventory is derived by summing branch warehouses.

---

## 4. Procurement & Accounts Payable (AP)

Procurement strictly follows the **3-Way Matching** principle to ensure accurate inventory valuation and liability recognition.

1. **Purchase Order (PO):** Intent to buy. Does *not* affect inventory or accounting.
2. **Goods Receipt (GR):** Physical receipt of items. Updates Inventory (Stock +). Links to PO lines to calculate backorders. Does *not* create AP liability.
3. **Vendor Bill (AP Invoice):** Financial document received from the supplier. Must be generated from a `GoodsReceipt`. Creates AP liability and records Input Tax (VAT).

---

## 5. Sales, Billing & Tax (Accounts Receivable - AR)

### 5.1 Document Partners (SAP-Style)
Invoices do not have hardcoded `customerId` or `doctorId` columns. Instead, they use a junction table `DocumentPartner`.
* Example: Invoice #001 is linked to `BP: Customer A` with `Role: PAYER`, and `BP: Dr. B` with `Role: DF_RECEIVER` (Doctor Fee).

### 5.2 Tax Distribution
Taxes are decoupled from the line item base amount to support complex Thai Tax laws (e.g., overlapping taxes).
* `InvoiceLineTax` table records distinct tax entries (e.g., `VAT 7%`, `WHT 3%`) pointing to the base `InvoiceLine`.

### 5.3 Document Immutability & Corrections
When an Invoice is `POSTED`, it becomes immutable. Corrections depend on the clinic's `tax_mode` setting:
* **SIMPLE Mode:** Users Void the document. The system changes status to `CANCELLED` and automatically clones it into a new `DRAFT` invoice.
* **ADVANCED Mode:** Users cannot void. The system forces the creation of a `Credit Note (CN)` or `Debit Note (DN)` referencing the original invoice.

---

## 6. Payments & Allocations

Money movement is decoupled from debt recognition.
* **Payment:** Represents the physical transfer of funds (e.g., Cash, Bank Transfer of 50,000 THB).
* **Payment Allocation:** A junction table that distributes the lump-sum `Payment` across multiple `Invoices` or `VendorBills`, updating their status to `PAID` or `PARTIAL`.

---

## 7. Consolidated Database Schema (Prisma Blueprint)

The following represents the target state of the database architecture.

```prisma
// --- ENUMS ---
enum Role { SUPER_ADMIN, CLINIC_OWNER, VET, STAFF, CASHIER }
enum BpType { INDIVIDUAL, COMPANY }
enum DocumentRole { PAYER, PAYEE, DF_RECEIVER, SALESPERSON }
enum DocStatus { DRAFT, POSTED, CANCELLED, PAID, PARTIAL }
enum ItemCategory { MEDICINE, RETAIL, SERVICE }

// --- 1. ORG & AUTH ---
model Clinic {
  id        String   @id @default(uuid())
  name      String
  taxMode   String   @default("SIMPLE") // SIMPLE or ADVANCED
  branches  Branch[]
  bps       BusinessPartner[]
}

model Branch {
  id        String   @id @default(uuid())
  clinicId  String
  name      String
  clinic    Clinic   @relation(fields: [clinicId], references: [id])
  users     UserBranch[]
  warehouses Warehouse[]
}

model User {
  id           String   @id @default(uuid())
  bpId         String   @unique
  loginEmail   String   @unique
  passwordHash String
  role         Role
  bp           BusinessPartner @relation(fields: [bpId], references: [id])
  branches     UserBranch[]
}

model UserBranch {
  userId   String
  branchId String
  @@id([userId, branchId])
}

// --- 2. BUSINESS PARTNERS (BP) ---
model BusinessPartner {
  id        String   @id @default(uuid())
  clinicId  String
  type      BpType
  name      String
  clinic    Clinic   @relation(fields: [clinicId], references: [id])
  
  user      User?
  vetExt    BpVet?
  suppExt   BpSupplier?
  docRoles  DocumentPartner[]
}

model BpVet {
  bpId          String   @id
  licenseNumber String   @unique
  whtRate       Decimal  @default(3.00)
  bp            BusinessPartner @relation(fields: [bpId], references: [id])
}

model BpSupplier {
  bpId           String   @id
  taxId          String
  creditTermDays Int
  bp             BusinessPartner @relation(fields: [bpId], references: [id])
}

// --- 3. MASTER DATA ---
model ItemMaster {
  id        String   @id @default(uuid())
  clinicId  String
  name      String
  category  ItemCategory
  isStocked Boolean  // False for Services
}

model Warehouse {
  id        String   @id @default(uuid())
  branchId  String
  name      String
  branch    Branch   @relation(fields: [branchId], references: [id])
}

// --- 4. PROCUREMENT (AP) ---
model PurchaseOrder {
  id        String   @id @default(uuid())
  branchId  String
  supplierId String  // Ref: BusinessPartner
  status    DocStatus
  lines     POLine[]
}

model POLine {
  id        String   @id @default(uuid())
  poId      String
  itemId    String
  qty       Int
  po        PurchaseOrder @relation(fields: [poId], references: [id])
}

model GoodsReceipt {
  id        String   @id @default(uuid())
  poId      String
  branchId  String
  lines     GRLine[]
}

model GRLine {
  id        String   @id @default(uuid())
  grId      String
  poLineId  String   // To track backorders
  qtyReceived Int
  gr        GoodsReceipt @relation(fields: [grId], references: [id])
}

model VendorBill {
  id        String   @id @default(uuid())
  grId      String   // Must be billed from GR
  supplierId String
  totalAmt  Decimal
  status    DocStatus
}

// --- 5. SALES & BILLING (AR) ---
model Invoice {
  id        String   @id @default(uuid())
  branchId  String
  status    DocStatus
  lines     InvoiceLine[]
  partners  DocumentPartner[]
}

model DocumentPartner {
  id        String   @id @default(uuid())
  invoiceId String
  bpId      String
  role      DocumentRole // e.g., PAYER, DF_RECEIVER
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  bp        BusinessPartner @relation(fields: [bpId], references: [id])
}

model InvoiceLine {
  id        String   @id @default(uuid())
  invoiceId String
  itemId    String
  baseAmt   Decimal
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  taxes     InvoiceLineTax[]
}

model InvoiceLineTax {
  id        String   @id @default(uuid())
  lineId    String
  taxName   String   // e.g., "VAT 7%", "WHT 3%"
  taxAmt    Decimal  // Positive for VAT, Negative for WHT
  line      InvoiceLine @relation(fields: [lineId], references: [id])
}

// --- 6. PAYMENTS & ALLOCATIONS ---
model Payment {
  id        String   @id @default(uuid())
  branchId  String
  bpId      String   // Who paid or received
  amount    Decimal
  method    String   // CASH, TRANSFER
  allocations PaymentAllocation[]
}

model PaymentAllocation {
  id        String   @id @default(uuid())
  paymentId String
  invoiceId String?  // If AR
  billId    String?  // If AP
  allocatedAmt Decimal
  payment   Payment  @relation(fields: [paymentId], references: [id])
}