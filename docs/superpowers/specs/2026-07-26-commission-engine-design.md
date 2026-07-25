# Doctor Fee & Commission Engine — Design Specification

**Project:** Petiatrics Phase 2 — Sub-project 1  
**Date:** 2026-07-26  
**Status:** Approved  

---

## 1. Overview

The Commission Engine automates revenue splitting between the clinic and its service providers (veterinarians, groomers, assistants). It provides:

- **Flexible commission rules** with layered resolution (BP-level default → item-level override)
- **Two-step accrual accounting** — DF accrues on visit finalization, confirms on invoice payment
- **Batch settlement** via Payment Runs with WHT deduction
- **Full Thai tax compliance** — 50 Tawi PDF generation and P.N.D.3/53 CSV export

### Architecture Decision

**Event-Driven Commission Ledger (Approach A):** The `CommissionModule` is a standalone bounded context that listens to domain events (`VisitFinalizedEvent`, `InvoicePaidEvent`, `InvoiceVoidedEvent`). It has no direct dependency on Clinical or Billing module services. This follows the existing `EventEmitterModule` pattern and keeps the engine extensible to future contexts (grooming, boarding).

---

## 2. Data Model

### 2.1 New Enums

```prisma
enum CommissionType {
  PERCENTAGE    // e.g., 30% of line item revenue
  FLAT_RATE     // e.g., ฿500 per service performed
}

enum DfTransactionStatus {
  ACCRUED       // Visit finalized, DF calculated but invoice unpaid
  CONFIRMED     // Invoice paid, DF locked for settlement
  SETTLED       // Included in a payment run
  VOIDED        // Invoice voided → DF reversed
}

enum DfPaymentRunStatus {
  DRAFT         // Being assembled
  APPROVED      // Reviewed and approved
  PAID          // Money transferred
  CANCELLED     // Cancelled before payment
}

enum EmploymentType {
  FREELANCE     // WHT 3% applies
  EMPLOYEE      // No WHT from DF engine (payroll handles it)
}

enum DfDiscountBasis {
  BEFORE_DISCOUNT   // DF calculated on gross amount
  AFTER_DISCOUNT    // DF calculated on net-of-discount amount
}
```

### 2.2 Modified Models

**BpVet** — add employment and DF configuration fields:

```prisma
model BpVet {
  bpId            String          @id
  licenseNumber   String          @unique
  specialty       String?
  defaultDfRate   Decimal?        @db.Decimal(5, 2)  // existing field
  employmentType  EmploymentType  @default(FREELANCE)  // NEW
  dfDiscountBasis DfDiscountBasis @default(AFTER_DISCOUNT)  // NEW

  bp BusinessPartner @relation(fields: [bpId], references: [id])
  @@map("bp_vets")
}
```

### 2.3 New Models

**CommissionRule** — item-level overrides for any BP:

```prisma
model CommissionRule {
  id                String         @id @default(uuid())
  clinicId          String
  businessPartnerId String         // The vet/groomer/staff receiving commission
  productId         String?        // null = "default for this BP" (fallback)
  commissionType    CommissionType
  rate              Decimal        @db.Decimal(7, 4) // % or flat amount in minor units
  isActive          Boolean        @default(true)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@unique([clinicId, businessPartnerId, productId])
  @@index([clinicId, businessPartnerId])
  @@map("commission_rules")
}
```

**Rule resolution order:**

1. `CommissionRule` where `businessPartnerId = bp` AND `productId = item` → item-level override
2. `CommissionRule` where `businessPartnerId = bp` AND `productId = null` → BP-level default rule
3. `BpVet.defaultDfRate` (legacy fallback, treated as PERCENTAGE type)

**DfTransaction** — immutable ledger of per-line-item DF accruals:

```prisma
model DfTransaction {
  id                  String              @id @default(uuid())
  clinicId            String
  branchId            String
  businessPartnerId   String              // The earner (vet/groomer/staff)
  visitId             String?             // Source visit (null for non-clinical contexts)
  invoiceId           String?             // Linked sales invoice
  invoiceLineItemId   String?             // Specific line item
  productId           String?             // Product/service that generated this DF

  // Financial
  revenueAmountMinor  Int                 // The revenue base used for calculation
  commissionType      CommissionType      // Snapshot of the rule used
  commissionRate      Decimal             @db.Decimal(7, 4) // Snapshot of rate at time of calc
  dfAmountMinor       Int                 // Calculated DF amount
  whtRate             Decimal             @default(0) @db.Decimal(5, 4) // e.g., 3.0000
  whtAmountMinor      Int                 @default(0) // WHT deducted
  netPayableMinor     Int                 // dfAmount - whtAmount

  // State
  status              DfTransactionStatus @default(ACCRUED)
  accruedAt           DateTime            @default(now())
  confirmedAt         DateTime?
  settledAt           DateTime?
  voidedAt            DateTime?
  voidReason          String?

  // Settlement link
  paymentAllocationId String?

  // Idempotency
  idempotencyKey      String?

  createdAt           DateTime            @default(now())

  @@unique([clinicId, idempotencyKey])
  @@index([clinicId, businessPartnerId, status])
  @@index([clinicId, branchId, status])
  @@index([clinicId, invoiceId])
  @@index([clinicId, status, accruedAt])
  @@map("df_transactions")
}
```

**DfPaymentRun** — batch settlement:

```prisma
model DfPaymentRun {
  id                String             @id @default(uuid())
  clinicId          String
  code              String             // e.g., "DF-2026-0001"
  businessPartnerId String             // One payment run per BP
  periodStart       DateTime           // Coverage period
  periodEnd         DateTime

  totalDfMinor      Int                // Sum of all DF in this run
  totalWhtMinor     Int                // Sum of all WHT deducted
  totalNetMinor     Int                // Net payable

  paymentMethod     String?            // BANK_TRANSFER, CASH, CHEQUE
  referenceNumber   String?            // Bank ref
  status            DfPaymentRunStatus @default(DRAFT)

  approvedById      String?
  approvedAt        DateTime?
  paidAt            DateTime?
  createdById       String
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  allocations       DfPaymentAllocation[]

  @@unique([clinicId, code])
  @@index([clinicId, businessPartnerId])
  @@index([clinicId, status])
  @@map("df_payment_runs")
}

model DfPaymentAllocation {
  id              String   @id @default(uuid())
  paymentRunId    String
  dfTransactionId String
  amountMinor     Int
  createdAt       DateTime @default(now())

  paymentRun DfPaymentRun @relation(fields: [paymentRunId], references: [id], onDelete: Cascade)

  @@index([paymentRunId])
  @@index([dfTransactionId])
  @@map("df_payment_allocations")
}
```

**WHTCertificate** — 50 Tawi record:

```prisma
model WHTCertificate {
  id                String   @id @default(uuid())
  clinicId          String
  code              String             // e.g., "WHT-2026-0001"
  businessPartnerId String             // The payee
  paymentRunId      String?            // Linked payment run

  // Payer info (clinic snapshot)
  payerTaxId        String
  payerName         String
  payerAddress      String

  // Payee info (BP snapshot)
  payeeTaxId        String
  payeeName         String
  payeeAddress      String

  // Financial
  incomeType        String             // e.g., "ค่าบริการ" (Section 3, Para 40(8))
  incomeDescription String
  totalIncomeMinor  Int
  whtRateBps        Int                // 300 = 3%
  whtAmountMinor    Int

  // Period
  taxMonth          Int                // 1-12
  taxYear           Int                // Buddhist year (e.g., 2569)

  issuedAt          DateTime           @default(now())
  createdAt         DateTime           @default(now())

  @@unique([clinicId, code])
  @@index([clinicId, businessPartnerId])
  @@index([clinicId, taxYear, taxMonth])
  @@map("wht_certificates")
}
```

---

## 3. Event Flow & State Machine

### 3.1 DF Transaction Lifecycle

```
ACCRUED ──→ CONFIRMED ──→ SETTLED
   │            │
   └──→ VOIDED  └──→ VOIDED
```

| Transition | Trigger | What Happens |
|---|---|---|
| → `ACCRUED` | `VisitFinalizedEvent` | Commission Listener resolves rules, calculates DF per line item, creates `DfTransaction` entries |
| `ACCRUED` → `CONFIRMED` | `InvoicePaidEvent` | Confirmation Listener finds all `ACCRUED` transactions matching `invoiceId`, locks to `CONFIRMED` |
| `CONFIRMED` → `SETTLED` | Payment Run completed | Batch settlement marks selected transactions `SETTLED`, links to `DfPaymentAllocation` |
| `ACCRUED/CONFIRMED` → `VOIDED` | `InvoiceVoidedEvent` | Void Listener reverses all DF linked to voided invoice |

### 3.2 New Domain Events

Add to `apps/api/src/common/events/domain-events.ts`:

```typescript
/** Emitted when an invoice is voided */
export class InvoiceVoidedEvent {
  constructor(
    public readonly clinicId: string,
    public readonly invoiceId: string,
    public readonly voidedAt: Date,
    public readonly voidReason: string,
    public readonly actorId: string,
  ) {}
}
```

### 3.3 Event Listener Design

**DfAccrualListener** — listens to `visit.finalized`:

```
For each line item in the visit:
  1. Identify the performing BP (vet/groomer/staff) from the visit record
  2. Resolve commission rule:
     a. CommissionRule WHERE bpId = bp AND productId = item → item override
     b. CommissionRule WHERE bpId = bp AND productId = null → BP default
     c. BpVet.defaultDfRate → legacy fallback (PERCENTAGE type)
  3. Determine revenue base:
     - If BP.dfDiscountBasis = BEFORE_DISCOUNT → gross line amount
     - If AFTER_DISCOUNT → net-of-discount line amount
  4. Calculate DF:
     - PERCENTAGE → revenueBase × rate / 100
     - FLAT_RATE → rate × quantity
  5. Calculate WHT:
     - If BP.employmentType = FREELANCE → dfAmount × 3%
     - If EMPLOYEE → 0
  6. Create DfTransaction (status=ACCRUED)
     - idempotencyKey = "{visitId}:{lineItemId}:{bpId}"
```

**DfConfirmationListener** — listens to `invoice.paid`:

```
1. Find DfTransactions WHERE invoiceId = event.invoiceId AND status = ACCRUED
2. Batch update → CONFIRMED, confirmedAt = now()
```

**DfInvoiceLinkListener** — listens to `invoice.created`:

```
1. Find DfTransactions WHERE visitId = event.visitId AND invoiceId IS NULL
2. Backfill invoiceId from the newly created invoice
```

**DfVoidListener** — listens to `invoice.voided`:

```
1. Find DfTransactions WHERE invoiceId = event.invoiceId AND status IN (ACCRUED, CONFIRMED)
2. If any are SETTLED → throw 409 Conflict
3. Batch update → VOIDED, voidedAt = now(), voidReason = event.voidReason
```

---

## 4. Payment Run & WHT Compliance

### 4.1 Payment Run Workflow

```
DRAFT ──→ APPROVED ──→ PAID
  │          │
  └→ CANCELLED └→ CANCELLED
```

**Create (DRAFT):**
- User selects BP + date range
- System queries CONFIRMED DfTransactions in range
- Auto-calculates totals: totalDf, totalWht, totalNet
- Creates DfPaymentAllocations linking each transaction
- Document code via DocumentSequence engine (type: `DF_PAYMENT`)

**Approve (DRAFT → APPROVED):**
- Validates BP has complete profile (taxId required for freelancers)
- Sets approvedById, approvedAt

**Pay (APPROVED → PAID):**
- Records paymentMethod, referenceNumber
- All linked DfTransactions → SETTLED
- Auto-generates WHTCertificate if totalWhtMinor > 0

### 4.2 50 Tawi (WHT Certificate) Generation

On payment run completion for FREELANCE BPs:

1. Create `WHTCertificate` record with snapshot of payer/payee info
2. `incomeType` = "ค่าบริการ" (Service Fee — Section 40(8))
3. `taxYear` converted to Buddhist Era (CE + 543)
4. Generate PDF via `@react-pdf/renderer` using Revenue Department standard form layout
5. Document code via DocumentSequence engine (type: `WHT_CERTIFICATE`)

### 4.3 P.N.D.3 / P.N.D.53 Export

Monthly filing CSV export:

- **P.N.D.3** — for individual freelancers (natural persons)
- **P.N.D.53** — for juristic persons (companies, future-proofing)

Columns: sequence, payee tax ID, payee name, address, income amount, WHT amount, WHT rate, tax condition.

Endpoint: `GET /api/commission/wht-export?year=&month=&type=PND3`

---

## 5. RBAC & Permissions

### 5.1 Page & Action Seeds

| Page Code | Actions |
|---|---|
| `COMMISSION` | `COMMISSION:VIEW`, `COMMISSION:MANAGE_RULES`, `COMMISSION:CREATE_PAYMENT_RUN`, `COMMISSION:APPROVE_PAYMENT_RUN`, `COMMISSION:MARK_PAID`, `COMMISSION:EXPORT_WHT` |

### 5.2 Default Role Grants

| Role | Permitted Actions |
|---|---|
| `CLINIC_OWNER` | All COMMISSION actions |
| `VET` | `COMMISSION:VIEW` (own records only) |
| `CASHIER` | None |
| `ASSISTANT` / `STAFF` | `COMMISSION:VIEW` (own records only) |

---

## 6. API Endpoints

### 6.1 Commission Rules

```
POST   /api/commission/rules                       → Create rule
GET    /api/commission/rules?bpId=                  → List rules for a BP
PATCH  /api/commission/rules/:id                    → Update rule
DELETE /api/commission/rules/:id                    → Soft-delete (isActive=false)
```

### 6.2 DF Transactions (Read-only)

```
GET    /api/commission/transactions                 → Paginated list (filters: bpId, status, from, to, branchId)
GET    /api/commission/transactions/:id             → Single transaction detail
GET    /api/commission/summary                      → Aggregated summary per BP for period
```

### 6.3 Payment Runs

```
POST   /api/commission/payment-runs                 → Create draft run
GET    /api/commission/payment-runs                 → List runs (filters: bpId, status)
GET    /api/commission/payment-runs/:id             → Run detail with allocations
PATCH  /api/commission/payment-runs/:id/approve     → Approve
PATCH  /api/commission/payment-runs/:id/pay         → Mark as paid
PATCH  /api/commission/payment-runs/:id/cancel      → Cancel
```

### 6.4 WHT Compliance

```
GET    /api/commission/wht-certificates             → List certificates
GET    /api/commission/wht-certificates/:id/pdf     → Download 50 Tawi PDF
GET    /api/commission/wht-export                   → Download P.N.D.3/53 CSV
```

---

## 7. Module Structure

```
apps/api/src/modules/commission/
├── commission.module.ts
├── controllers/
│   ├── commission-rule.controller.ts
│   ├── df-transaction.controller.ts
│   └── df-payment-run.controller.ts
├── services/
│   ├── commission-rule.service.ts       // Rule CRUD + resolution logic
│   ├── df-calculation.service.ts        // Pure calculation (no DB)
│   ├── df-transaction.service.ts        // Ledger operations
│   ├── df-payment-run.service.ts        // Settlement workflow
│   └── wht-certificate.service.ts       // 50 Tawi + P.N.D. export
├── listeners/
│   ├── df-accrual.listener.ts           // VisitFinalizedEvent
│   ├── df-confirmation.listener.ts      // InvoicePaidEvent
│   ├── df-invoice-link.listener.ts      // InvoiceCreatedEvent → backfill
│   └── df-void.listener.ts             // InvoiceVoidedEvent
├── templates/
│   └── wht-50-tawi.template.tsx         // React-PDF template
└── dto/
    ├── create-commission-rule.dto.ts
    ├── update-commission-rule.dto.ts
    ├── create-payment-run.dto.ts
    ├── pay-payment-run.dto.ts
    └── df-query.dto.ts
```

---

## 8. Frontend Pages

```
apps/web/app/(clinic)/clinic/commission/
├── page.tsx                              → Dashboard: DF summary cards, recent transactions
├── rules/
│   ├── page.tsx                          → Commission rules list (grouped by BP)
│   └── [bpId]/
│       └── page.tsx                      → Rules for specific BP
├── transactions/
│   └── page.tsx                          → Full DF transaction ledger
├── payment-runs/
│   ├── page.tsx                          → Payment run list
│   ├── new/
│   │   └── page.tsx                      → Create payment run
│   └── [id]/
│       └── page.tsx                      → Payment run detail
└── wht/
    ├── page.tsx                          → WHT certificate list
    └── export/
        └── page.tsx                      → P.N.D.3/53 export form
```

Sidebar entry under clinic navigation:

```
💰 Commission
   ├── Dashboard
   ├── Commission Rules
   ├── Transactions
   ├── Payment Runs
   └── WHT / Tax Reports
```

---

## 9. Error Handling

| Scenario | Behavior |
|---|---|
| No commission rule found for BP + Product | Skip — no DF generated (log warning) |
| Invoice voided after DF is SETTLED | Block void — 409 Conflict |
| Duplicate VisitFinalizedEvent | Idempotency key prevents double-creation |
| BP missing taxId on payment run approval | Block — 422 with message to complete BP profile |
| Payment run with ฿0 total | Block creation |

---

## 10. Technical Constraints

1. **Multi-tenancy:** All new models include `clinicId` and utilize `branch-context.guard.ts`
2. **Event-driven:** Commission module communicates only via `@nestjs/event-emitter` events
3. **RBAC:** All endpoints protected by `PermissionsGuard` with COMMISSION page actions
4. **Document sequencing:** Payment runs and WHT certificates use the existing `DocumentSequence` engine with new document types: `DF_PAYMENT`, `WHT_CERTIFICATE`
5. **Immutable ledger:** `DfTransaction` records are never deleted or modified — only status transitions
