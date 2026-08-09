# General Ledger & Trial Balance UI Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the user interface deliverables for Chart of Accounts management, Journal Entries list, Manual Journal Entry form with real-time Dr/Cr validation & system running numbers, and Trial Balance report view.

**Architecture:** Next.js App Router client pages and components (`React Hook Form` + `Zod`, Tailwind CSS, Lucide icons, `Money` component), integrated with NestJS `JournalController` and `DocumentSequenceService`.

---

### Task 1: Backend System Document Sequence Integration for Journal Entries
- [x] Add `JOURNAL_ENTRY` to `DOC_TYPE`, `SYSTEM_DEFAULTS`, and `builtinDocTypes` in `apps/api/src/modules/document-sequence/services/document-sequence.service.ts`.
- [x] Import `DocumentSequenceModule` in `apps/api/src/modules/accounting/accounting.module.ts`.
- [x] Update `JournalService` in `apps/api/src/modules/accounting/services/journal.service.ts` to auto-generate `entryNo` via `DocumentSequenceService` if not supplied.
- [x] Add `@Get('journal-entries/next-number')` in `apps/api/src/modules/accounting/controllers/journal.controller.ts` returning next preview running sequence number.

---

### Task 2: Deliverable 3 - Manual Journal Entry Form Component
- [x] Create `apps/web/components/accounting/manual-journal-form.tsx` using `'use client'`, `react-hook-form`, `@hookform/resolvers/zod`, and `zod`.
- [x] Auto-fetch next system sequence entry number from `/api/v1/accounting/journal-entries/next-number`.
- [x] Support multi-line debit/credit entries with `useFieldArray`.
- [x] Implement real-time Dr/Cr balance validation check: disable Submit button until `totalDebits === totalCredits` and `totalDebits > 0`.

---

### Task 3: Deliverable 1 - Chart of Accounts Management Page (`COA`)
- [x] Create `apps/web/app/(clinic)/clinic/accounting/coa/page.tsx`.
- [x] List all `GLAccount` records (Code, Name, Type, System Account Status, Active Status).
- [x] Enforce System Account Protection: `isSystem: true` accounts display a locked `🛡️ System Control Account` badge and hide Delete/Deactivate buttons.
- [x] Non-system accounts display a Deactivate action with confirmation dialog.
- [x] Modal for creating new User-Defined accounts.

---

### Task 4: Deliverable 2 - Journal Entries List Page & Deliverable 4 - Trial Balance Report Page
- [x] Create `apps/web/app/(clinic)/clinic/accounting/journal/page.tsx` listing all Journal Entries with expandable lines and read-only guards (`🔒 Read-only`) for posted entries.
- [x] Create `apps/web/app/(clinic)/clinic/accounting/trial-balance/page.tsx` displaying trial balance report with category tabs, search, KPI summary cards, and matching grand totals row (`tfoot`).

---

## Verification
- [x] Run NestJS accounting tests: `npx jest src/modules/accounting` in `apps/api` (53/53 passed).
- [x] Run TypeScript compilation: `npx tsc --noEmit` in `apps/web` (0 errors).
