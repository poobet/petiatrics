# Period Closing & Forward-Only Adjustments — Design Spec

## Background & Problem

คลินิกไม่มีกลไกในการ "ปิดงบ" รายเดือน ทำให้พนักงานสามารถแก้ไขข้อมูลทางบัญชีย้อนหลังได้โดยไม่มีการควบคุม ซึ่งผิดหลักเกณฑ์ของสรรพากร นอกจากนี้ เมื่อต้องการปรับปรุงยอดข้ามเดือน (เช่น ใบลดหนี้, ปรับค่ามือแพทย์) ยังไม่มีกระบวนการ Forward-Only ที่ถูกต้อง

## Phasing Strategy

เนื่องจากขอบเขตใหญ่ จึงแบ่งเป็น 2 Phases:

| Phase | Scope | Dependencies |
|-------|-------|-------------|
| **Phase 1** | AccountingPeriod model + PeriodClosingGuard + Inventory Guard integration + Settings UI | None (foundation) |
| **Phase 2** | Credit Note/Debit Note + DF Adjustment | Phase 1 (requires period system) |

**This spec covers both phases. The implementation plan will be created per-phase.**

---

## Phase 1: Accounting Period Management

### 1.1 Data Model

**New enum: `AccountingPeriodStatus`**

```
OPEN      — period is active, transactions allowed
CLOSING   — transitional state for admin review
CLOSED    — period is locked, no mutations allowed
```

**New model: `AccountingPeriod`**

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `clinicId` | String | FK → Clinic |
| `branchId` | String? | Nullable — if null, applies clinic-wide. Future-proof for branch-level closing |
| `year` | Int | e.g. 2026 |
| `month` | Int | 1–12 |
| `startDate` | DateTime | First day of month |
| `endDate` | DateTime | Last day of month |
| `status` | AccountingPeriodStatus | Default: OPEN |
| `closedById` | String? | FK → User who closed |
| `closedAt` | DateTime? | Timestamp of closure |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Unique constraint:** `@@unique([clinicId, year, month])` (one period per clinic per month; branchId deferred)

**Table name:** `accounting_periods`

### 1.2 PeriodClosingGuard (Hybrid Pattern)

**Custom decorator:** `@CheckPeriodField('transactionDate')`

```typescript
// Usage example:
@Post()
@UseGuards(PeriodClosingGuard)
@CheckPeriodField('adjustmentDate')
create(@Body() dto) { ... }
```

**How it works:**
1. Decorator `@CheckPeriodField('fieldName')` stores metadata via `Reflector`
2. `PeriodClosingGuard` reads the metadata to know which body field contains the transaction date
3. Guard extracts `clinicId` from request (via `TenantId` pattern already established)
4. Guard queries `AccountingPeriod` to check if the date falls within a CLOSED period
5. If period is CLOSED → throw `403 Forbidden` with clear message: `"Transaction date falls within closed accounting period (YYYY-MM). Period was closed on YYYY-MM-DD."`

**Edge cases:**
- If no AccountingPeriod record exists for that month → **ALLOW** (only explicit CLOSED blocks transactions)
- If date field is missing from body → Guard is no-op (let validation handle it)
- Multiple date fields: decorator accepts string or string[] for checking multiple fields

**File location:** `apps/api/src/common/guards/period-closing.guard.ts`
**Decorator location:** `apps/api/src/common/decorators/check-period-field.decorator.ts`

### 1.3 AccountingPeriod Module (Backend)

**Module path:** `apps/api/src/modules/accounting-period/`

**Endpoints:**

| Method | Path | Description | Role |
|--------|------|-------------|------|
| `GET` | `/accounting-periods` | List periods for clinic | CLINIC_OWNER |
| `POST` | `/accounting-periods` | Create/Initialize period | CLINIC_OWNER |
| `PATCH` | `/accounting-periods/:id/close` | Close a period (OPEN→CLOSING→CLOSED) | CLINIC_OWNER |
| `PATCH` | `/accounting-periods/:id/reopen` | Reopen a period (CLOSED→OPEN) with reason | CLINIC_OWNER |

**Business rules:**
- Can only close the most recent OPEN period (no skipping months)
- Closing validates no DRAFT invoices or DRAFT payment runs exist in that period
- Reopen requires a `reason` field (audit trail)
- Auto-initialize: if a period doesn't exist when queried, the service can auto-create it as OPEN

### 1.4 Inventory Guard Integration

Apply `PeriodClosingGuard` + `@CheckPeriodField` to:
- `StockAdjustmentController.submit()` → check `adjustmentDate` from DTO
- The DTO `SubmitAdjustmentDto` needs a new optional `adjustmentDate` field (defaults to `now()`)

### 1.5 Settings UI

**Page:** `apps/web/app/(clinic)/clinic/settings/accounting-periods/page.tsx`

**Features:**
- Table showing all periods (year, month, status, closed by, closed at)
- "Close Period" button — opens confirmation dialog
- "Reopen" button — opens dialog requiring reason
- Status badges: OPEN (green), CLOSING (yellow), CLOSED (red/locked)
- Filter by year

---

## Phase 2: Forward-Only Business Features

### 2.1 Credit Note / Debit Note

#### 2.1.1 Schema Changes (Invoice model)

**New enum:** `DocumentType` — `INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE`

**New fields on Invoice:**

| Field | Type | Notes |
|-------|------|-------|
| `documentType` | DocumentType | Default: INVOICE |
| `referenceInvoiceId` | String? | FK → Invoice (self-relation). Links CN/DN back to original invoice |
| `reasonCode` | String? | Reason for CN/DN issuance (e.g. "DEFECTIVE", "WRONG_PRICE", "CUSTOMER_RETURN") |

**Self-relation:**
```
referenceInvoice  Invoice?  @relation("CreditNoteReference", fields: [referenceInvoiceId], references: [id])
creditNotes       Invoice[] @relation("CreditNoteReference")
```

**Invoice totals for CN:** `subtotalMinor`, `taxTotalMinor`, `totalMinor` will be **negative** (convention: CN has negative amounts, DN has positive amounts for additional charges).

#### 2.1.2 Backend: Credit Note Endpoint

**New endpoint:** `POST /billing/invoices/:id/credit-note`

**Logic:**
1. Fetch original invoice (must be PAID status)
2. Validate: original invoice's period MUST be CLOSED (CN is only needed when original period is locked; if period is still OPEN, void+re-issue is preferred)
3. Create new Invoice record with:
   - `documentType: CREDIT_NOTE`
   - `referenceInvoiceId: originalInvoice.id`
   - `reasonCode: dto.reasonCode`
   - Line items copied from original (or subset), with **negative amounts**
   - Transaction date = current date (forward-only, always in current OPEN period)
4. Auto-generate document sequence code (new doc type: `CREDIT_NOTE`)
5. Post reverse journal entry via `GLPostingService`
6. Emit `CreditNoteCreatedEvent` for event listeners

**DTO:**
```typescript
interface CreateCreditNoteDto {
  reasonCode: string;
  reason: string;
  lineItems?: CreditNoteLineItemDto[]; // Optional partial CN
  // If absent, full CN for all line items
}
```

#### 2.1.3 GL Reverse Journal Entry

When CN is created, `GLPostingService` posts a **reverse entry**:
- Original SALES entry: DR Cash/AR, CR Revenue
- Reverse for CN: DR Revenue, CR Cash/AR (refund liability)

New method: `GLPostingService.postReverseJournal(clinicId, originalJournalId, description)`

#### 2.1.4 Frontend: Invoice Detail

**File:** `apps/web/app/(clinic)/clinic/billing/[id]/invoice-detail-client.tsx`

**Changes:**
- Add "Issue Credit Note / Refund" button — visible when:
  - Invoice status = PAID
  - Invoice `documentType` = INVOICE (not CN/DN)
  - Invoice's period is CLOSED
- Button opens modal with:
  - Reason code selector
  - Reason text input
  - Line items with checkboxes (partial CN support)
  - Amount preview
  - Confirm button
- Display linked CN/DN documents on invoice detail page (if any exist)

### 2.2 Doctor Fee (DF) Adjustment

#### 2.2.1 Schema Changes

**New enum:** `DfTransactionType` — `NORMAL`, `ADJUSTMENT_ADD`, `ADJUSTMENT_DEDUCT`

**New fields on DfTransaction:**

| Field | Type | Notes |
|-------|------|-------|
| `transactionType` | DfTransactionType | Default: NORMAL |
| `adjustmentReason` | String? | Required when type is ADJUSTMENT_* |
| `referenceTransactionId` | String? | Optional link to original DF tx being adjusted |

#### 2.2.2 Backend: Manual Adjustment Endpoint

**New endpoint:** `POST /commission/transactions/adjustment`

**Logic:**
1. Validate business partner exists
2. Create DfTransaction with:
   - `transactionType: ADJUSTMENT_ADD` or `ADJUSTMENT_DEDUCT`
   - `adjustmentReason: dto.reason`
   - For ADJUSTMENT_DEDUCT: `dfAmountMinor` is negative
   - `status: CONFIRMED` (manual adjustments skip ACCRUED, go straight to CONFIRMED)
   - `accruedAt: now()` (forward-only — always in current period)
3. WHT calculation: applied to adjustment amount the same way as normal DF (3% for freelance)

#### 2.2.3 Payment Run Integration

**File:** `apps/api/src/modules/commission/services/df-payment-run.service.ts`

**Changes to `createDraftRun()`:**
- Query includes both `NORMAL` and `ADJUSTMENT_*` type transactions
- Net total = sum of all DF amounts (normal + adjustments, where adjustments can be negative)
- WHT recalculated on net total (not per-transaction)
- If net total < 0 → throw error (cannot create negative payment run)

#### 2.2.4 Frontend: Payment Run Detail

**File:** `apps/web/app/(clinic)/clinic/commission/payment-runs/[id]/page.tsx` (create detail page)

**Features:**
- "Add Adjustment" button (only when payment run is DRAFT status)
- Adjustment form: type (add/deduct), amount, reason
- Table shows transactions grouped by type: Normal | Adjustments
- Summary section recalculates totals including adjustments
- Clearly distinguish adjustment rows (different color/icon)

---

## Cross-Cutting Concerns

### Audit Trail
All period close/reopen actions logged via existing `@Audit()` interceptor pattern.

### Document Sequence
New document types to register:
- `CREDIT_NOTE` (prefix: CN)
- `DEBIT_NOTE` (prefix: DN)
- `DF_ADJUSTMENT` (if needed)

### Permissions (PageMaster / ActionMaster)
New actions to seed:
- `ACCOUNTING_PERIOD:VIEW`, `ACCOUNTING_PERIOD:CLOSE`, `ACCOUNTING_PERIOD:REOPEN`
- `BILLING:ISSUE_CREDIT_NOTE`
- `COMMISSION:ADD_ADJUSTMENT`

### Error Messages
All Thai-locale error messages returned alongside English for frontend i18n.

---

## What This Spec Does NOT Cover
- AP (Accounts Payable) period closing — separate spec needed
- Multi-year accounting period management
- Automated month-end close procedures
- Financial reporting affected by CN/DN
