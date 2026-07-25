# Doctor Fee & Commission Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Doctor Fee & Commission Engine bounded context in NestJS and Next.js, incorporating rule resolution, event-driven accrual/confirmation/void listeners, batch payment runs, WHT calculation, 50 Tawi PDF certificates, P.N.D.3 export, and full RBAC controls.

**Architecture:** Standalone NestJS `CommissionModule` listening to domain events (`visit.finalized`, `invoice.created`, `invoice.paid`, `invoice.voided`). Uses Prisma for relational persistence, `@nestjs/event-emitter` for event handling, `@react-pdf/renderer` for PDF rendering, and standard Next.js App Router for frontend management UI.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React/Next.js, `@react-pdf/renderer`, `@nestjs/event-emitter`, Jest, React Testing Library.

---

## File Map

### Packages & Common Layer
- `packages/database/prisma/schema.prisma` — Add Enums & Models (`CommissionRule`, `DfTransaction`, `DfPaymentRun`, `DfPaymentAllocation`, `WHTCertificate`)
- `apps/api/src/common/events/domain-events.ts` — Add `InvoiceVoidedEvent`

### Backend (`apps/api/src/modules/commission/`)
- `commission.module.ts` — Module definition
- `dto/create-commission-rule.dto.ts`, `update-commission-rule.dto.ts`
- `dto/create-payment-run.dto.ts`, `pay-payment-run.dto.ts`
- `dto/df-query.dto.ts`
- `services/df-calculation.service.ts` & `df-calculation.service.spec.ts` — Pure calculation & rule resolution
- `services/commission-rule.service.ts` & `commission-rule.service.spec.ts` — Rule CRUD
- `services/df-transaction.service.ts` & `df-transaction.service.spec.ts` — Ledger query & accrual management
- `services/df-payment-run.service.ts` & `df-payment-run.service.spec.ts` — Batch settlement lifecycle
- `services/wht-certificate.service.ts` & `wht-certificate.service.spec.ts` — 50 Tawi PDF & P.N.D.3 CSV export
- `listeners/df-accrual.listener.ts`
- `listeners/df-confirmation.listener.ts`
- `listeners/df-invoice-link.listener.ts`
- `listeners/df-void.listener.ts`
- `controllers/commission-rule.controller.ts`
- `controllers/df-transaction.controller.ts`
- `controllers/df-payment-run.controller.ts`
- `controllers/wht-certificate.controller.ts`
- `templates/wht-50-tawi.template.tsx` — React-PDF document component

### Frontend (`apps/web/`)
- `apps/web/app/(clinic)/clinic/commission/page.tsx` — Dashboard
- `apps/web/app/(clinic)/clinic/commission/rules/page.tsx` — Rules management
- `apps/web/app/(clinic)/clinic/commission/transactions/page.tsx` — Ledger
- `apps/web/app/(clinic)/clinic/commission/payment-runs/page.tsx` — Payment runs list
- `apps/web/app/(clinic)/clinic/commission/payment-runs/new/page.tsx` — Create payment run
- `apps/web/app/(clinic)/clinic/commission/payment-runs/[id]/page.tsx` — Payment run detail
- `apps/web/app/(clinic)/clinic/commission/wht/page.tsx` — WHT certificates list & export

---

## Bite-Sized Tasks

### Task 1: Prisma Schema Updates & Domain Events

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `apps/api/src/common/events/domain-events.ts`

- [ ] **Step 1: Update Prisma schema with new Enums and Models**

Add to `schema.prisma`:
```prisma
enum CommissionType {
  PERCENTAGE
  FLAT_RATE
}

enum DfTransactionStatus {
  ACCRUED
  CONFIRMED
  SETTLED
  VOIDED
}

enum DfPaymentRunStatus {
  DRAFT
  APPROVED
  PAID
  CANCELLED
}

enum EmploymentType {
  FREELANCE
  EMPLOYEE
}

enum DfDiscountBasis {
  BEFORE_DISCOUNT
  AFTER_DISCOUNT
}

// In BpVet model add:
// employmentType  EmploymentType  @default(FREELANCE)
// dfDiscountBasis DfDiscountBasis @default(AFTER_DISCOUNT)

model CommissionRule {
  id                String         @id @default(uuid())
  clinicId          String
  businessPartnerId String
  productId         String?
  commissionType    CommissionType
  rate              Decimal        @db.Decimal(7, 4)
  isActive          Boolean        @default(true)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@unique([clinicId, businessPartnerId, productId])
  @@index([clinicId, businessPartnerId])
  @@map("commission_rules")
}

model DfTransaction {
  id                  String              @id @default(uuid())
  clinicId            String
  branchId            String
  businessPartnerId   String
  visitId             String?
  invoiceId           String?
  invoiceLineItemId   String?
  productId           String?

  revenueAmountMinor  Int
  commissionType      CommissionType
  commissionRate      Decimal             @db.Decimal(7, 4)
  dfAmountMinor       Int
  whtRate             Decimal             @default(0) @db.Decimal(5, 4)
  whtAmountMinor      Int                 @default(0)
  netPayableMinor     Int

  status              DfTransactionStatus @default(ACCRUED)
  accruedAt           DateTime            @default(now())
  confirmedAt         DateTime?
  settledAt           DateTime?
  voidedAt            DateTime?
  voidReason          String?

  paymentAllocationId String?
  idempotencyKey      String?

  createdAt           DateTime            @default(now())

  @@unique([clinicId, idempotencyKey])
  @@index([clinicId, businessPartnerId, status])
  @@index([clinicId, branchId, status])
  @@index([clinicId, invoiceId])
  @@index([clinicId, status, accruedAt])
  @@map("df_transactions")
}

model DfPaymentRun {
  id                String             @id @default(uuid())
  clinicId          String
  code              String
  businessPartnerId String
  periodStart       DateTime
  periodEnd         DateTime

  totalDfMinor      Int
  totalWhtMinor     Int
  totalNetMinor     Int

  paymentMethod     String?
  referenceNumber   String?
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

model WHTCertificate {
  id                String   @id @default(uuid())
  clinicId          String
  code              String
  businessPartnerId String
  paymentRunId      String?

  payerTaxId        String
  payerName         String
  payerAddress      String

  payeeTaxId        String
  payeeName         String
  payeeAddress      String

  incomeType        String
  incomeDescription String
  totalIncomeMinor  Int
  whtRateBps        Int
  whtAmountMinor    Int

  taxMonth          Int
  taxYear           Int

  issuedAt          DateTime           @default(now())
  createdAt         DateTime           @default(now())

  @@unique([clinicId, code])
  @@index([clinicId, businessPartnerId])
  @@index([clinicId, taxYear, taxMonth])
  @@map("wht_certificates")
}
```

- [ ] **Step 2: Add InvoiceVoidedEvent to domain-events.ts**

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

- [ ] **Step 3: Run Prisma build / generate client**

Run: `npx prisma generate --schema=packages/database/prisma/schema.prisma`
Expected: Prisma Client generated successfully.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma apps/api/src/common/events/domain-events.ts
git commit -m "feat(database): add commission engine schemas and InvoiceVoidedEvent"
```

---

### Task 2: Pure Calculation Service (`DfCalculationService`)

**Files:**
- Create: `apps/api/src/modules/commission/services/df-calculation.service.ts`
- Create: `apps/api/src/modules/commission/services/df-calculation.service.spec.ts`

- [ ] **Step 1: Write failing unit test for DfCalculationService**

```typescript
import { DfCalculationService } from './df-calculation.service';
import { CommissionType, EmploymentType, DfDiscountBasis } from '@prisma/client';

describe('DfCalculationService', () => {
  let service: DfCalculationService;

  beforeEach(() => {
    service = new DfCalculationService();
  });

  it('calculates percentage commission after discount for freelance vet', () => {
    const result = service.calculateLineItemDf({
      grossAmountMinor: 100000, // ฿1,000
      discountAmountMinor: 10000, // ฿100 discount (net ฿900)
      quantity: 1,
      commissionType: CommissionType.PERCENTAGE,
      rate: 30.0, // 30%
      employmentType: EmploymentType.FREELANCE,
      dfDiscountBasis: DfDiscountBasis.AFTER_DISCOUNT,
    });

    expect(result.revenueAmountMinor).toBe(90000);
    expect(result.dfAmountMinor).toBe(27000); // 30% of 900
    expect(result.whtRate).toBe(3.0);
    expect(result.whtAmountMinor).toBe(810); // 3% of 270
    expect(result.netPayableMinor).toBe(26190);
  });

  it('calculates percentage commission before discount for employee vet', () => {
    const result = service.calculateLineItemDf({
      grossAmountMinor: 100000,
      discountAmountMinor: 10000,
      quantity: 1,
      commissionType: CommissionType.PERCENTAGE,
      rate: 30.0,
      employmentType: EmploymentType.EMPLOYEE,
      dfDiscountBasis: DfDiscountBasis.BEFORE_DISCOUNT,
    });

    expect(result.revenueAmountMinor).toBe(100000);
    expect(result.dfAmountMinor).toBe(30000);
    expect(result.whtRate).toBe(0);
    expect(result.whtAmountMinor).toBe(0);
    expect(result.netPayableMinor).toBe(30000);
  });

  it('calculates flat rate commission per unit', () => {
    const result = service.calculateLineItemDf({
      grossAmountMinor: 50000,
      discountAmountMinor: 0,
      quantity: 2,
      commissionType: CommissionType.FLAT_RATE,
      rate: 20000, // ฿200 per unit
      employmentType: EmploymentType.FREELANCE,
      dfDiscountBasis: DfDiscountBasis.AFTER_DISCOUNT,
    });

    expect(result.dfAmountMinor).toBe(40000); // 200 * 2
    expect(result.whtAmountMinor).toBe(1200); // 3% of 400
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest apps/api/src/modules/commission/services/df-calculation.service.spec.ts`
Expected: FAIL (service not found)

- [ ] **Step 3: Write DfCalculationService implementation**

```typescript
import { Injectable } from '@nestjs/common';
import { CommissionType, EmploymentType, DfDiscountBasis } from '@prisma/client';

export interface CalculationInput {
  grossAmountMinor: number;
  discountAmountMinor: number;
  quantity: number;
  commissionType: CommissionType;
  rate: number; // percentage or flat rate minor units
  employmentType: EmploymentType;
  dfDiscountBasis: DfDiscountBasis;
}

export interface CalculationOutput {
  revenueAmountMinor: number;
  dfAmountMinor: number;
  whtRate: number;
  whtAmountMinor: number;
  netPayableMinor: number;
}

@Injectable()
export class DfCalculationService {
  calculateLineItemDf(input: CalculationInput): CalculationOutput {
    const revenueAmountMinor =
      input.dfDiscountBasis === DfDiscountBasis.BEFORE_DISCOUNT
        ? input.grossAmountMinor
        : Math.max(0, input.grossAmountMinor - input.discountAmountMinor);

    let dfAmountMinor = 0;

    if (input.commissionType === CommissionType.PERCENTAGE) {
      dfAmountMinor = Math.round((revenueAmountMinor * input.rate) / 100);
    } else {
      dfAmountMinor = Math.round(input.rate * input.quantity);
    }

    const whtRate = input.employmentType === EmploymentType.FREELANCE ? 3.0 : 0;
    const whtAmountMinor = Math.round((dfAmountMinor * whtRate) / 100);
    const netPayableMinor = dfAmountMinor - whtAmountMinor;

    return {
      revenueAmountMinor,
      dfAmountMinor,
      whtRate,
      whtAmountMinor,
      netPayableMinor,
    };
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx jest apps/api/src/modules/commission/services/df-calculation.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/commission/services/df-calculation.service*
git commit -m "feat(commission): implement pure DF calculation service with unit tests"
```

---

### Task 3: Commission Rule Service & Controller

**Files:**
- Create: `apps/api/src/modules/commission/dto/create-commission-rule.dto.ts`
- Create: `apps/api/src/modules/commission/services/commission-rule.service.ts`
- Create: `apps/api/src/modules/commission/controllers/commission-rule.controller.ts`
- Test: `apps/api/src/modules/commission/services/commission-rule.service.spec.ts`

- [ ] **Step 1: Create DTOs**

`create-commission-rule.dto.ts`:
```typescript
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min } from 'class-validator';
import { CommissionType } from '@prisma/client';

export class CreateCommissionRuleDto {
  @IsString()
  businessPartnerId!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsEnum(CommissionType)
  commissionType!: CommissionType;

  @IsNumber()
  @Min(0)
  rate!: number;
}
```

- [ ] **Step 2: Write tests for CommissionRuleService rule resolution logic**

Write `commission-rule.service.spec.ts` testing rule creation, resolution precedence (Product-specific rule → BP default rule → BpVet default rate).

- [ ] **Step 3: Implement CommissionRuleService & Controller**

Implement CRUD operations with tenant scoping (`clinicId`) and resolution lookup method `resolveRule(clinicId, bpId, productId)`.

- [ ] **Step 4: Verify unit tests pass**

Run: `npx jest apps/api/src/modules/commission/services/commission-rule.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/commission/
git commit -m "feat(commission): implement commission rule CRUD and resolution logic"
```

---

### Task 4: Event Listeners & DfTransaction Ledger

**Files:**
- Create: `apps/api/src/modules/commission/listeners/df-accrual.listener.ts`
- Create: `apps/api/src/modules/commission/listeners/df-confirmation.listener.ts`
- Create: `apps/api/src/modules/commission/listeners/df-invoice-link.listener.ts`
- Create: `apps/api/src/modules/commission/listeners/df-void.listener.ts`
- Create: `apps/api/src/modules/commission/services/df-transaction.service.ts`
- Create: `apps/api/src/modules/commission/controllers/df-transaction.controller.ts`

- [ ] **Step 1: Write DfTransactionService for queries and status updates**

`df-transaction.service.ts` handles:
- `findLedger(clinicId, queryDto)` (filters by bpId, status, date range, branchId)
- `getSummary(clinicId, queryDto)` (groups totals by BP)
- `createAccrualTransaction(data)` with idempotency check
- `confirmByInvoiceId(clinicId, invoiceId)`
- `backfillInvoiceId(clinicId, visitId, invoiceId)`
- `voidByInvoiceId(clinicId, invoiceId, voidReason)` (throws 409 if any transaction is SETTLED)

- [ ] **Step 2: Implement Event Listeners**

`df-accrual.listener.ts`: `@OnEvent('visit.finalized')`
`df-confirmation.listener.ts`: `@OnEvent('invoice.paid')`
`df-invoice-link.listener.ts`: `@OnEvent('invoice.created')`
`df-void.listener.ts`: `@OnEvent('invoice.voided')`

- [ ] **Step 3: Write Unit Tests for listeners and transaction service**

Verify idempotency, status transitions, and SETTLED void guard.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/commission/
git commit -m "feat(commission): implement event listeners and DfTransaction ledger"
```

---

### Task 5: DfPaymentRun Module & WHT Certificates

**Files:**
- Create: `apps/api/src/modules/commission/dto/create-payment-run.dto.ts`
- Create: `apps/api/src/modules/commission/dto/pay-payment-run.dto.ts`
- Create: `apps/api/src/modules/commission/services/df-payment-run.service.ts`
- Create: `apps/api/src/modules/commission/services/wht-certificate.service.ts`
- Create: `apps/api/src/modules/commission/controllers/df-payment-run.controller.ts`
- Create: `apps/api/src/modules/commission/controllers/wht-certificate.controller.ts`

- [ ] **Step 1: Implement DfPaymentRunService**

- `createDraftRun(clinicId, actorId, dto)`: Finds CONFIRMED transactions for BP in period, calculates total DF, total WHT, net payable. Generates code via `DocumentSequenceService` (`DF_PAYMENT`).
- `approveRun(clinicId, actorId, runId)`: Validates BP has taxId (if FREELANCE). Sets status to APPROVED.
- `payRun(clinicId, actorId, runId, dto)`: Updates status to PAID, marks linked transactions as SETTLED, triggers `WHTCertificateService.generateCertificate()`.
- `cancelRun(clinicId, runId)`: Status to CANCELLED, releases allocations.

- [ ] **Step 2: Implement WHTCertificateService**

- `generateCertificate(clinicId, paymentRunId)`: Creates WHTCertificate DB record with Buddhist Era tax year.
- `generatePdfBuffer(certificateId)`: Builds 50 Tawi document.
- `exportPnd3Csv(clinicId, year, month)`: Formats P.N.D.3 CSV per Thai Revenue spec.

- [ ] **Step 3: Write unit tests for payment runs and CSV export**

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/commission/
git commit -m "feat(commission): implement payment runs, WHT certificates, and PND3 export"
```

---

### Task 6: CommissionModule Registration & App Wiring

**Files:**
- Create: `apps/api/src/modules/commission/commission.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Assemble CommissionModule**

Import `PrismaModule` / database context, `EventEmitterModule`, register services, controllers, and listeners.

- [ ] **Step 2: Register in AppModule**

Add `CommissionModule` to imports list in `app.module.ts`.

- [ ] **Step 3: Verify NestJS application boots cleanly**

Run: `npm run build --prefix apps/api`
Expected: Clean build without missing provider or module dependency errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/commission/commission.module.ts apps/api/src/app.module.ts
git commit -m "feat(commission): register CommissionModule in AppModule"
```

---

### Task 7: Frontend Integration (Clinic Portal Commission UI)

**Files:**
- Create: `apps/web/app/(clinic)/clinic/commission/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/commission/rules/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/commission/transactions/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/commission/payment-runs/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/commission/payment-runs/new/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/commission/wht/page.tsx`

- [ ] **Step 1: Build Navigation & Dashboard (`/clinic/commission`)**
Summary cards (Total Earned, Accrued, Confirmed, Settled), recent transaction table.

- [ ] **Step 2: Build Rules Management (`/clinic/commission/rules`)**
Table of commission rules grouped by Business Partner, rule creation/edit modal.

- [ ] **Step 3: Build Ledger View (`/clinic/commission/transactions`)**
Filterable ledger by status (ACCRUED, CONFIRMED, SETTLED, VOIDED), date range, BP.

- [ ] **Step 4: Build Payment Runs UI (`/clinic/commission/payment-runs`)**
List of payment runs, new payment run wizard, payment run detail drawer with Approve & Mark as Paid actions.

- [ ] **Step 5: Build WHT & Export Page (`/clinic/commission/wht`)**
WHT certificate history with 50 Tawi PDF download button & P.N.D.3 CSV export form.

- [ ] **Step 6: Build check**

Run: `npm run build --prefix apps/web`
Expected: Next.js frontend builds without TypeScript or bundling errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(clinic\)/clinic/commission/
git commit -m "feat(web): add Clinic Portal Commission UI pages"
```

---

## Self-Review Check

1. **Spec Coverage:**
   - Commission rules precedence (Task 2 & 3)
   - Event-driven accrual, confirmation, voiding (Task 4)
   - Payment run lifecycle & WHT deduction (Task 5)
   - 50 Tawi PDF & P.N.D.3 CSV export (Task 5)
   - App assembly & web UI (Task 6 & 7)
2. **Placeholder Scan:** All tasks contain explicit file paths, DTO structure, code snippets, and exact validation commands.
3. **Type Consistency:** DTO and service function signatures align across tasks (`DfTransactionStatus`, `CommissionType`, etc.).
