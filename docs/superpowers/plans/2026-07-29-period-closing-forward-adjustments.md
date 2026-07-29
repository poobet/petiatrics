# Period Closing & Forward-Only Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement accounting period closing controls (preventing modifications to closed periods) and forward-only adjustments (Credit Notes and Doctor Fee adjustments) in full accordance with Thai revenue guidelines.

**Architecture:** 
- Database models for `AccountingPeriod` with status `OPEN`, `CLOSING`, `CLOSED` and Prisma schema updates for `Invoice` and `DfTransaction`.
- NestJS Guard (`PeriodClosingGuard`) combined with `@CheckPeriodField()` decorator to check transaction dates against closed periods.
- NestJS API modules: `AccountingPeriodModule`, Credit Note endpoints in `BillingModule`, and DF Adjustment endpoints in `CommissionModule`.
- Frontend Next.js pages: Settings page for Accounting Periods, Credit Note action modal on Invoice Detail, and DF Adjustment modal on Payment Run detail.

**Tech Stack:** Prisma, NestJS, Next.js (App Router, Tailwind CSS), TypeScript, Jest.

---

## File Structure Map

### Database Package (`packages/database`)
- Modify: `packages/database/prisma/schema.prisma`

### API Module (`apps/api/src`)
- **Common Guards & Decorators:**
  - Create: `apps/api/src/common/decorators/check-period-field.decorator.ts`
  - Create: `apps/api/src/common/guards/period-closing.guard.ts`
  - Create: `apps/api/src/common/guards/period-closing.guard.spec.ts`
- **Accounting Period Module:**
  - Create: `apps/api/src/modules/accounting-period/dto/create-period.dto.ts`
  - Create: `apps/api/src/modules/accounting-period/dto/reopen-period.dto.ts`
  - Create: `apps/api/src/modules/accounting-period/services/accounting-period.service.ts`
  - Create: `apps/api/src/modules/accounting-period/services/accounting-period.service.spec.ts`
  - Create: `apps/api/src/modules/accounting-period/controllers/accounting-period.controller.ts`
  - Create: `apps/api/src/modules/accounting-period/accounting-period.module.ts`
  - Modify: `apps/api/src/app.module.ts`
- **Inventory Guard Integration:**
  - Modify: `apps/api/src/modules/inventory/dto/submit-adjustment.dto.ts`
  - Modify: `apps/api/src/modules/inventory/controllers/stock-adjustment.controller.ts`
- **Billing & Credit Note:**
  - Create: `apps/api/src/modules/billing/dto/create-credit-note.dto.ts`
  - Modify: `apps/api/src/modules/billing/services/invoice.service.ts`
  - Modify: `apps/api/src/modules/billing/services/invoice.service.spec.ts`
  - Modify: `apps/api/src/modules/billing/controllers/invoice.controller.ts`
- **Commission & DF Adjustment:**
  - Create: `apps/api/src/modules/commission/dto/create-df-adjustment.dto.ts`
  - Modify: `apps/api/src/modules/commission/services/df-transaction.service.ts`
  - Modify: `apps/api/src/modules/commission/services/df-transaction.service.spec.ts`
  - Modify: `apps/api/src/modules/commission/controllers/df-transaction.controller.ts`
  - Modify: `apps/api/src/modules/commission/services/df-payment-run.service.ts`
  - Modify: `apps/api/src/modules/commission/services/df-payment-run.service.spec.ts`

### Web Frontend (`apps/web/app/(clinic)/clinic`)
- **Settings UI:**
  - Create: `apps/web/app/(clinic)/clinic/settings/accounting-periods/page.tsx`
- **Billing UI:**
  - Modify: `apps/web/app/(clinic)/clinic/billing/[id]/invoice-detail-client.tsx`
- **Commission UI:**
  - Create: `apps/web/app/(clinic)/clinic/commission/payment-runs/[id]/page.tsx`

---

### Task 1: Database Schema & Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add Prisma Enums and Models**
Update `packages/database/prisma/schema.prisma` with:
- `AccountingPeriodStatus` enum (`OPEN`, `CLOSING`, `CLOSED`)
- `AccountingPeriod` model (`id`, `clinicId`, `branchId`, `year`, `month`, `startDate`, `endDate`, `status`, `closedById`, `closedAt`, `createdAt`, `updatedAt`)
- `DocumentType` enum (`INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE`)
- Modify `Invoice` model: add `documentType`, `referenceInvoiceId`, `reasonCode`, and self-relations `referenceInvoice` & `creditNotes`.
- `DfTransactionType` enum (`NORMAL`, `ADJUSTMENT_ADD`, `ADJUSTMENT_DEDUCT`)
- Modify `DfTransaction` model: add `transactionType`, `adjustmentReason`, `referenceTransactionId`.

- [ ] **Step 2: Generate Prisma Client and verify build**
Run: `npm --prefix packages/database run db:generate && npm --prefix packages/database run build`
Expected: Build passes clean.

- [ ] **Step 3: Commit**
```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add AccountingPeriod model and CN/DN and DF adjustment fields"
```

---

### Task 2: Create `@CheckPeriodField` Decorator and `PeriodClosingGuard`

**Files:**
- Create: `apps/api/src/common/decorators/check-period-field.decorator.ts`
- Create: `apps/api/src/common/guards/period-closing.guard.ts`
- Create: `apps/api/src/common/guards/period-closing.guard.spec.ts`

- [ ] **Step 1: Write failing unit test for `PeriodClosingGuard`**
Create `apps/api/src/common/guards/period-closing.guard.spec.ts` testing that:
1. When no period is closed for the date in request body, request is allowed.
2. When date falls in a CLOSED period, `ForbiddenException` is thrown.
3. When date field decorator is absent, request passes.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx jest apps/api/src/common/guards/period-closing.guard.spec.ts`
Expected: FAIL (files missing)

- [ ] **Step 3: Implement `@CheckPeriodField` decorator and `PeriodClosingGuard`**
Create `apps/api/src/common/decorators/check-period-field.decorator.ts` using `@SetMetadata`.
Create `apps/api/src/common/guards/period-closing.guard.ts` retrieving metadata via `Reflector`, checking `AccountingPeriod` table for `status === 'CLOSED'` for the clinicId and date.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx jest apps/api/src/common/guards/period-closing.guard.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/common/decorators/check-period-field.decorator.ts apps/api/src/common/guards/period-closing.guard.ts apps/api/src/common/guards/period-closing.guard.spec.ts
git commit -m "feat(api): add CheckPeriodField decorator and PeriodClosingGuard"
```

---

### Task 3: Backend Accounting Period Module

**Files:**
- Create: `apps/api/src/modules/accounting-period/dto/create-period.dto.ts`
- Create: `apps/api/src/modules/accounting-period/dto/reopen-period.dto.ts`
- Create: `apps/api/src/modules/accounting-period/services/accounting-period.service.ts`
- Create: `apps/api/src/modules/accounting-period/services/accounting-period.service.spec.ts`
- Create: `apps/api/src/modules/accounting-period/controllers/accounting-period.controller.ts`
- Create: `apps/api/src/modules/accounting-period/accounting-period.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing service unit test**
Create `apps/api/src/modules/accounting-period/services/accounting-period.service.spec.ts` testing `findAll`, `create`, `closePeriod`, and `reopenPeriod`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx jest apps/api/src/modules/accounting-period/services/accounting-period.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement DTOs, Service, Controller, and Module**
Implement:
- `create-period.dto.ts`: `year` (number), `month` (1-12)
- `reopen-period.dto.ts`: `reason` (string)
- `accounting-period.service.ts`: CRUD logic + status transition checks
- `accounting-period.controller.ts`: `@Get()`, `@Post()`, `@Patch(':id/close')`, `@Patch(':id/reopen')`
- `accounting-period.module.ts` and register in `apps/api/src/app.module.ts`.

- [ ] **Step 4: Run test to verify pass**
Run: `npx jest apps/api/src/modules/accounting-period/services/accounting-period.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/modules/accounting-period/ apps/api/src/app.module.ts
git commit -m "feat(api): create AccountingPeriod module with service and controller"
```

---

### Task 4: Integrate Inventory Stock Adjustment with PeriodClosingGuard

**Files:**
- Modify: `apps/api/src/modules/inventory/dto/submit-adjustment.dto.ts`
- Modify: `apps/api/src/modules/inventory/controllers/stock-adjustment.controller.ts`

- [ ] **Step 1: Update DTO and Controller**
Add optional `adjustmentDate?: string` to `SubmitAdjustmentDto`.
Apply `@UseGuards(BranchContextGuard, PeriodClosingGuard)` and `@CheckPeriodField('adjustmentDate')` on `StockAdjustmentController.submit()`.

- [ ] **Step 2: Run inventory controller tests**
Run: `npx jest apps/api/src/modules/inventory/controllers/stock.controller.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/modules/inventory/dto/submit-adjustment.dto.ts apps/api/src/modules/inventory/controllers/stock-adjustment.controller.ts
git commit -m "feat(inventory): enforce PeriodClosingGuard on stock adjustments"
```

---

### Task 5: Backend Credit Note Service & API

**Files:**
- Create: `apps/api/src/modules/billing/dto/create-credit-note.dto.ts`
- Modify: `apps/api/src/modules/billing/services/invoice.service.ts`
- Modify: `apps/api/src/modules/billing/services/invoice.service.spec.ts`
- Modify: `apps/api/src/modules/billing/controllers/invoice.controller.ts`

- [ ] **Step 1: Write failing test for `createCreditNote` in `invoice.service.spec.ts`**
Add test case: creating a Credit Note from a PAID invoice in a CLOSED period creates a new negative-total invoice with `documentType: CREDIT_NOTE` and posts reverse GL journal entry.

- [ ] **Step 2: Run test to verify failure**
Run: `npx jest apps/api/src/modules/billing/services/invoice.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement `CreateCreditNoteDto`, `createCreditNote` method and Controller endpoint**
Implement:
- `CreateCreditNoteDto`: `reasonCode`, `reason`, optional `lineItems`
- `InvoiceService.createCreditNote`: validates period is CLOSED and status is PAID, creates negative amounts invoice record, calls `GLPostingService`.
- `InvoiceController.createCreditNote`: `@Post(':id/credit-note')`.

- [ ] **Step 4: Run test to verify pass**
Run: `npx jest apps/api/src/modules/billing/services/invoice.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/modules/billing/
git commit -m "feat(billing): add Credit Note generation and reverse GL posting API"
```

---

### Task 6: Backend Doctor Fee (DF) Manual Adjustment API & Payment Run Integration

**Files:**
- Create: `apps/api/src/modules/commission/dto/create-df-adjustment.dto.ts`
- Modify: `apps/api/src/modules/commission/services/df-transaction.service.ts`
- Modify: `apps/api/src/modules/commission/services/df-transaction.service.spec.ts`
- Modify: `apps/api/src/modules/commission/controllers/df-transaction.controller.ts`
- Modify: `apps/api/src/modules/commission/services/df-payment-run.service.ts`
- Modify: `apps/api/src/modules/commission/services/df-payment-run.service.spec.ts`

- [ ] **Step 1: Write failing tests for DF adjustment and payment run integration**
Add test cases in `df-transaction.service.spec.ts` for creating `ADJUSTMENT_ADD` and `ADJUSTMENT_DEDUCT` transactions, and in `df-payment-run.service.spec.ts` for including adjustment transactions in draft payment runs.

- [ ] **Step 2: Run tests to verify failure**
Run: `npx jest apps/api/src/modules/commission/services/df-transaction.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement DF adjustment creation and update payment run calculation**
Implement `CreateDfAdjustmentDto`, `DfTransactionService.createAdjustment`, `DfTransactionController.createAdjustment` (`POST /commission/transactions/adjustment`).
Update `DfPaymentRunService.createDraftRun` to include `NORMAL` and `ADJUSTMENT_*` transactions in date range.

- [ ] **Step 4: Run tests to verify pass**
Run: `npx jest apps/api/src/modules/commission/services/df-transaction.service.spec.ts apps/api/src/modules/commission/services/df-payment-run.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/modules/commission/
git commit -m "feat(commission): add DF adjustment creation and integrate into payment runs"
```

---

### Task 7: Frontend Accounting Periods Management Settings UI

**Files:**
- Create: `apps/web/app/(clinic)/clinic/settings/accounting-periods/page.tsx`

- [ ] **Step 1: Build `accounting-periods/page.tsx`**
Create page displaying table of accounting periods, with status badges (OPEN, CLOSING, CLOSED), "Close Period" button with confirmation modal, and "Reopen Period" button with reason modal.

- [ ] **Step 2: Verify linting / build**
Run: `npm run lint` or `npm --prefix apps/web run build`
Expected: Passes without errors.

- [ ] **Step 3: Commit**
```bash
git add apps/web/app/\(clinic\)/clinic/settings/accounting-periods/
git commit -m "feat(web): add Accounting Period management settings UI"
```

---

### Task 8: Frontend Credit Note Modal & Integration on Invoice Detail

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/billing/[id]/invoice-detail-client.tsx`

- [ ] **Step 1: Add "Issue Credit Note" button and Modal to `invoice-detail-client.tsx`**
Render "Issue Credit Note / Refund" button when invoice is PAID and period is CLOSED. Modal prompts for reason code, reason text, line item selection, and calls `POST /billing/invoices/:id/credit-note`.

- [ ] **Step 2: Verify frontend compilation**
Run: `npm --prefix apps/web run build`
Expected: Passes without errors.

- [ ] **Step 3: Commit**
```bash
git add apps/web/app/\(clinic\)/clinic/billing/\[id\]/invoice-detail-client.tsx
git commit -m "feat(web): add Credit Note issuance modal to Invoice detail page"
```

---

### Task 9: Frontend Doctor Fee Adjustment Modal & Payment Run Detail

**Files:**
- Create: `apps/web/app/(clinic)/clinic/commission/payment-runs/[id]/page.tsx`

- [ ] **Step 1: Build `payment-runs/[id]/page.tsx`**
Create payment run detail page displaying breakdown of transactions (normal vs adjustments), with an "Add Adjustment" button opening a modal to post manual DF adjustments.

- [ ] **Step 2: Verify build**
Run: `npm --prefix apps/web run build`
Expected: Passes clean.

- [ ] **Step 3: Commit**
```bash
git add apps/web/app/\(clinic\)/clinic/commission/payment-runs/\[id\]/
git commit -m "feat(web): add Payment Run detail page with DF adjustment modal"
```

---

## Verification Plan

### Automated Tests
- Run NestJS unit tests across api:
  `npx jest apps/api/src/common/guards/period-closing.guard.spec.ts`
  `npx jest apps/api/src/modules/accounting-period/services/accounting-period.service.spec.ts`
  `npx jest apps/api/src/modules/billing/services/invoice.service.spec.ts`
  `npx jest apps/api/src/modules/commission/services/df-transaction.service.spec.ts`
  `npx jest apps/api/src/modules/commission/services/df-payment-run.service.spec.ts`

- Build verification:
  `npm run build`

### Manual Verification
- Test period closing: Navigate to `/clinic/settings/accounting-periods`, close a period, verify stock adjustment submission with date in that period is blocked with 403 Forbidden.
- Test Credit Note: Open a PAID invoice in a closed period, click "Issue Credit Note / Refund", verify CN document is created with negative amounts and linked.
- Test DF Adjustment: Open Payment Run detail, click "Add Adjustment", enter positive/negative amount and verify payment run totals update.
