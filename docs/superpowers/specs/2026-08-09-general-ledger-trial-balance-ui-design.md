# General Ledger & Trial Balance UI Module Design Spec

## 1. Overview
The **General Ledger & Trial Balance UI** module provides clinic managers and accountants with full visibility and control over financial accounting in Petiatrics. This module enforces strict business rules regarding protected System Control Accounts (`isSystem: true`), immutable posted double-entry journal entries, real-time debit/credit balance validation for manual journal entries, and automated system document sequence running numbers (`JV{yyyy}-{number:4}`).

---

## 2. Deliverables & Technical Architecture

### 2.1 Chart of Accounts Management (`COA`)
- **Route**: `/clinic/accounting/coa`
- **File**: `apps/web/app/(clinic)/clinic/accounting/coa/page.tsx`
- **Functionality**:
  - Lists all master `GLAccount` records with Code, Name, Type, System Account Status, and Active Status.
  - **System Account Protection**: System control accounts (`isSystem: true`) display a prominent `🛡️ System Control Account` badge with a lock icon. Delete/Deactivate actions are strictly hidden and locked.
  - **User-Defined Account Management**: User-created accounts (`isSystem: false`) display a "Deactivate" action with confirmation dialog, triggering `DELETE /api/v1/accounting/gl-accounts/:id` (soft-deactivation `isActive: false`).
  - **Creation Modal**: Allows adding new user-defined accounts (`code`, `name`, `type`) posting to `POST /api/v1/accounting/gl-accounts`.
  - **Category Tabs & Search**: Filter by 5 standard accounting categories (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`, `COGS`), text search, and active/inactive status filter.

### 2.2 Manual Journal Entry Form Component
- **Component**: `ManualJournalForm`
- **File**: `apps/web/components/accounting/manual-journal-form.tsx`
- **Stack**: `'use client'`, `react-hook-form`, `zod`, `@hookform/resolvers/zod`, Tailwind CSS, Lucide icons, `apiClient`.
- **System Running Number**:
  - Automatically fetches the next system document sequence number (e.g., `JV2026-0001`) from `GET /api/v1/accounting/journal-entries/next-number`.
  - Provides a manual refresh trigger to re-sync running sequence from the system generator.
- **Dynamic Multi-Line Entry (`useFieldArray`)**:
  - Minimum of 2 lines (debit side & credit side).
  - Dynamic add/remove line actions.
- **Real-Time Dr/Cr Balance Validation**:
  - Calculates real-time total debits and total credits in satang minor integers (`Math.round(val * 100)`).
  - **Hard Gate**: The "Submit" button remains **disabled** until `totalDebits === totalCredits` and `totalDebits > 0`.
  - Live status indicator banner displaying balance state and net variance.

### 2.3 General Ledger Journal Entries List (`Journal Entries`)
- **Route**: `/clinic/accounting/journal`
- **File**: `apps/web/app/(clinic)/clinic/accounting/journal/page.tsx`
- **Functionality**:
  - Lists all posted and manual journal entries from `GET /api/v1/accounting/journal-entries`.
  - Expandable row details revealing line items (GL Account Code, GL Account Name, Debit Minor/Baht, Credit Minor/Baht).
  - **Immutability Enforcement for Posted Entries**: Entries with status `POSTED` display a `🔒 Read-only` badge. Edit and Delete buttons are strictly hidden/omitted to preserve audit integrity.
  - Header button "+ Create Journal Entry" opens `ManualJournalForm` in a modal dialog.

### 2.4 Trial Balance Report View (`Trial Balance`)
- **Route**: `/clinic/accounting/trial-balance`
- **File**: `apps/web/app/(clinic)/clinic/accounting/trial-balance/page.tsx`
- **Functionality**:
  - Report view displaying Account Code, Account Name, Type, Debit Balance, Credit Balance, and Net Balance for all active accounts.
  - **KPI Summary Cards**: Total Debit, Total Credit, Trial Balance Variance, and Total Accounts.
  - **Matching Grand Totals Row (`tfoot`)**: Bottom row displaying matching grand totals of Total Debit and Total Credit, with a prominent "Balanced 100%" badge.
  - Category filter tabs, search filter, and print-ready stylesheet layout.

---

## 3. Backend & Sequence Integration

### 3.1 Document Sequence Integration
- **File**: `apps/api/src/modules/document-sequence/services/document-sequence.service.ts`
- Added `DOC_TYPE.JOURNAL_ENTRY` with default template `JV{yyyy}-{number:4}` and yearly reset interval under the `ACCOUNTING` module.

### 3.2 Journal Service & Controller Extensions
- **Files**: `apps/api/src/modules/accounting/services/journal.service.ts`, `apps/api/src/modules/accounting/controllers/journal.controller.ts`
- `JournalService` auto-generates system running `entryNo` via `DocumentSequenceService` if missing or empty.
- `JournalController` exposes `GET /api/v1/accounting/journal-entries/next-number` returning `{ nextEntryNo: string }`.

---

## 4. Verification & Testing
1. **NestJS Backend Unit Tests**: `53/53` unit tests passed (`npx jest src/modules/accounting`).
2. **TypeScript Compilation**: `npx tsc --noEmit` verified with 0 errors across `apps/web`.
