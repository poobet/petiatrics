# Phase 2, Sub-Project 6: Unified POS & Advanced Accounting Engine

**Date:** July 26, 2026  
**Status:** Approved  
**Author:** Antigravity AI & Petiatrics Engineering Team  

---

## 1. Executive Summary

The **Unified POS & Advanced Accounting Engine** expands the core billing capabilities of Petiatrics into an enterprise-grade point-of-sale and automated double-entry financial ledger.

It bridges front-office clinic and retail sales (POS) with back-office ERP accounting, featuring:
- **Split-tender payment processing** (Cash, QR PromptPay, Credit/Debit Card, Bank Transfer, AR Credit, Wallet/Deposit).
- **Prepaid customer deposits & wallet management**.
- **Accounts Receivable (AR) open items & aging analysis**.
- **Automated double-entry general ledger (GL) journal posting**.
- **Daily cashier close-of-day reconciliation**.
- **Thai Revenue Department compliant PDF generation** (Receipts & Full Tax Invoices).

---

## 2. System Architecture & Module Boundaries

The subsystem is integrated into `apps/api/src/modules/billing` and `@petiatrics/database` following the Modular Monolith pattern.

```
                          ┌────────────────────────┐
                          │   Next.js POS Client   │
                          └───────────┬────────────┘
                                      │ REST API
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              BillingModule                                │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │ InvoiceService   │  │  PaymentService  │  │ CustomerDepositService  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬────────────┘  │
│           │                     │                         │               │
│           ▼                     ▼                         ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    NestJS EventEmitter2 Bus                         │  │
│  └──────────────────────────────┬──────────────────────────────────────┘  │
│                                 │ Event Listeners                         │
│                                 ▼                                         │
│                        ┌──────────────────┐                               │
│                        │ GLPostingService │                               │
│                        └────────┬─────────┘                               │
│                                 │                                         │
│                                 ▼                                         │
│                      ┌─────────────────────┐                              │
│                      │ JournalEntry / Line │                              │
│                      └─────────────────────┘                              │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Schema & Models

### 3.1 Enums (`packages/database/prisma/schema.prisma`)

```prisma
enum PaymentMethodType {
  CASH
  CREDIT_CARD
  DEBIT_CARD
  QR_PROMPTPAY
  BANK_TRANSFER
  AR_CREDIT
  WALLET_DEPOSIT
}

enum PaymentStatus {
  PENDING
  COMPLETED
  VOIDED
  REFUNDED
}

enum JournalType {
  SALES
  CASH_RECEIPT
  GENERAL
}

enum JournalStatus {
  POSTED
  VOIDED
}

enum DepositTxType {
  TOPUP
  CONSUMPTION
  REFUND
}

enum ArStatus {
  OPEN
  PARTIAL
  CLOSED
  OVERDUE
}

enum SessionStatus {
  OPEN
  CLOSED
}
```

### 3.2 Prisma Models

```prisma
// ─── Payment & Split Tender ──────────────────────────────────────────────────

model Payment {
  id            String        @id @default(uuid())
  clinicId      String
  invoiceId     String
  documentNo    String        // e.g. REC-202607-0001
  totalMinor    Int           // Total payment amount in satang
  status        PaymentStatus @default(COMPLETED)
  receivedAt    DateTime      @default(now())
  cashierUserId String
  note          String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  clinic  Clinic          @relation(fields: [clinicId], references: [id])
  invoice Invoice         @relation(fields: [invoiceId], references: [id])
  cashier User            @relation(fields: [cashierUserId], references: [id])
  tenders PaymentTender[]

  @@index([clinicId, status])
  @@index([invoiceId])
  @@map("payments")
}

model PaymentTender {
  id          String            @id @default(uuid())
  paymentId   String
  method      PaymentMethodType
  amountMinor Int               // Satang
  referenceNo String?           // Slip ref, approval code, check no.

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId])
  @@map("payment_tenders")
}

// ─── General Ledger & Double-Entry Accounting ────────────────────────────────

model JournalEntry {
  id            String        @id @default(uuid())
  clinicId      String
  entryNo       String        // e.g. JV-202607-0001
  type          JournalType   @default(GENERAL)
  description   String
  sourceRefType String?       // INVOICE, PAYMENT, DEPOSIT
  sourceRefId   String?       // Foreign UUID
  postedAt      DateTime      @default(now())
  status        JournalStatus @default(POSTED)
  createdAt     DateTime      @default(now())

  clinic Clinic        @relation(fields: [clinicId], references: [id])
  lines  JournalLine[]

  @@index([clinicId, postedAt])
  @@map("journal_entries")
}

model JournalLine {
  id             String @id @default(uuid())
  journalEntryId String
  glAccountId    String
  debitMinor     Int    @default(0) // Satang
  creditMinor    Int    @default(0) // Satang

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  glAccount    GLAccount    @relation(fields: [glAccountId], references: [id])

  @@index([journalEntryId])
  @@index([glAccountId])
  @@map("journal_lines")
}

// ─── Customer Deposits & Wallet ──────────────────────────────────────────────

model CustomerDeposit {
  id           String   @id @default(uuid())
  clinicId     String
  ownerUserId  String   // Customer / Pet Owner ID
  amountMinor  Int      // Initial/total deposit in satang
  balanceMinor Int      // Current available balance in satang
  note         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  clinic       Clinic               @relation(fields: [clinicId], references: [id])
  owner        User                 @relation(fields: [ownerUserId], references: [id])
  transactions DepositTransaction[]

  @@index([clinicId, ownerUserId])
  @@map("customer_deposits")
}

model DepositTransaction {
  id                String        @id @default(uuid())
  depositId         String
  type              DepositTxType
  amountMinor       Int           // Satang
  balanceAfterMinor Int           // Satang
  referenceId       String?       // Payment.id or Invoice.id
  createdAt         DateTime      @default(now())

  deposit CustomerDeposit @relation(fields: [depositId], references: [id], onDelete: Cascade)

  @@index([depositId])
  @@map("deposit_transactions")
}

// ─── Accounts Receivable (AR) ────────────────────────────────────────────────

model ArOpenItem {
  id              String   @id @default(uuid())
  clinicId        String
  ownerUserId     String   // Customer/Farm BP
  invoiceId       String   @unique
  dueDate         DateTime
  amountMinor     Int      // Total invoice amount
  paidAmountMinor Int      @default(0)
  status          ArStatus @default(OPEN)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  clinic  Clinic  @relation(fields: [clinicId], references: [id])
  owner   User    @relation(fields: [ownerUserId], references: [id])
  invoice Invoice @relation(fields: [invoiceId], references: [id])

  @@index([clinicId, ownerUserId])
  @@index([clinicId, status])
  @@map("ar_open_items")
}

// ─── Cashier Session & Close-of-Day ───────────────────────────────────────────

model CashierSession {
  id               String        @id @default(uuid())
  clinicId         String
  cashierUserId    String
  openedAt         DateTime      @default(now())
  closedAt         DateTime?
  openingCashMinor Int           // Starting float cash
  systemCashMinor  Int           @default(0) // System tracked cash
  actualCashMinor  Int?          // Cashier physical count
  differenceMinor  Int?          // Discrepancy
  status           SessionStatus @default(OPEN)
  note             String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  clinic  Clinic @relation(fields: [clinicId], references: [id])
  cashier User   @relation(fields: [cashierUserId], references: [id])

  @@index([clinicId, cashierUserId, status])
  @@map("cashier_sessions")
}
```

---

## 4. Accounting & GL Posting Rules

Whenever business events are emitted via NestJS `EventEmitter2`, `GLPostingListener` automatically writes balanced double-entry journal entries.

### 4.1 Event Map & Journal Templates

| Event | Action / Description | Debit (DR) | Credit (CR) |
|---|---|---|---|
| `payment.received` (Cash/Card/QR/Transfer) | POS/OTC Sale with immediate settlement | **Cash/Bank GL Account** (`11100`) | **Sales Revenue** (`41100`)<br/>**Output VAT 7%** (`21500`) |
| `payment.received` (`AR_CREDIT`) | Credit sale checkout | **Accounts Receivable** (`11300`) | **Sales Revenue** (`41100`)<br/>**Output VAT 7%** (`21500`) |
| `deposit.created` | Customer tops up prepaid deposit | **Cash/Bank GL Account** (`11100`) | **Customer Deposit Liability** (`21200`) |
| `payment.received` (`WALLET_DEPOSIT`) | Checkout using prepaid deposit balance | **Customer Deposit Liability** (`21200`) | **Sales Revenue** (`41100`)<br/>**Output VAT 7%** (`21500`) |
| `ar.settled` | Customer pays off AR credit invoice | **Cash/Bank GL Account** (`11100`) | **Accounts Receivable** (`11300`) |

### 4.2 Invariant Validation Gate
Every `JournalEntry` **MUST** pass strict double-entry validation prior to commit:
$$\sum \text{DebitMinor} = \sum \text{CreditMinor}$$

If unbalanced, the transaction is rejected with an `UnbalancedJournalException`.

---

## 5. End-of-Day Cashier Close & AR Aging

### 5.1 Cashier Session Flow
1. **Open Session:** Cashier inputs opening float cash (e.g. ฿2,000.00).
2. **Transactions:** All POS sales in cash increment `systemCashMinor`.
3. **Close Session:** Cashier counts physical drawer cash, submits `actualCashMinor`.
4. **Reconciliation:** System calculates `differenceMinor = actualCashMinor - (openingCashMinor + systemCashMinor)`.

### 5.2 AR Aging Analysis
Categorizes unpaid `ArOpenItem` records into 4 aging buckets:
- **Current (0–30 Days)**
- **31–60 Days**
- **61–90 Days**
- **90+ Days (Overdue)**

---

## 6. Thai Compliance PDF Generation

The `DocumentPdfService` generates printable PDFs matching Thai Revenue Department formatting:

### 6.1 Requirements
- **Header:** Clinic Legal Name, 13-digit Tax ID, Branch Code (`00000` = HQ), Address, Contact Tel.
- **Customer Info:** Name, Tax ID / Citizen ID, Address.
- **Line Items Table:** Item Name, Qty, Unit Price, Subtotal, VAT Rate (7%/Exempt), VAT Amount, Total.
- **Thai Baht Text:** Conversions (e.g., `฿1,070.00` → *"หนึ่งพันเจ็ดสิบบาทถ้วน"*).
- **Signatures:** Collector (Cashier) and Authorized Signature lines.

---

## 7. Verification & Testing Plan

### Automated Unit & Integration Tests
1. **PaymentService:** Split-tender validation (`tenders.sum == totalMinor`), status transitions.
2. **GLPostingService:** Verify balanced journal entries for all 5 business event types.
3. **CustomerDepositService:** Test topup, consumption deduction, and insufficient balance error handling.
4. **ArService:** Test credit term creation, aging calculation, and AR settlement.
5. **CashierSessionService:** Test session open/close and discrepancy math.

### E2E Browser Walkthrough
- Test full checkout in POS UI with split payment (Cash + Credit Card).
- Test AR credit checkout.
- Verify Journal Entries view in Accounting section.
- Test PDF generation endpoint.
