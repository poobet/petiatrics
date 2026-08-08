# System-Wide Currency Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a shared `<Money>` React component and centralize currency formatting across all frontend modules (Procurement, Accounting, Commissions, Inventory, Billing, Analytics) to ensure 100% consistent Baht.Satang decimal display, thousand comma separators, and Thai Baht text readings.

**Architecture:** Create `apps/web/components/ui/money.tsx` consuming `apps/web/lib/currency.ts`. Audit and replace all hardcoded `฿{(val / 100).toFixed(2)}` and `toFixed(2)` patterns across all web modules.

**Tech Stack:** TypeScript, Next.js / React (Client Components), Vitest.

---

### Task 1: Create Central `<Money>` Component in `apps/web/components/ui/money.tsx`

**Files:**
- Create: `apps/web/components/ui/money.tsx`
- Modify: `apps/web/lib/currency.ts`

- [ ] **Step 1: Create `apps/web/components/ui/money.tsx`**

```tsx
import React from 'react';
import { formatMinor, FormatCurrencyOptions } from '@/lib/currency';

export interface MoneyProps extends FormatCurrencyOptions {
  minor?: number | null;
  baht?: number | null;
  className?: string;
}

/**
 * Reusable Money component for consistent currency formatting across the app.
 * Usage: <Money minor={po.totalMinor} /> or <Money baht={107.50} showThaiText />
 */
export function Money({ minor, baht, className, ...options }: MoneyProps) {
  const valueMinor =
    minor !== undefined && minor !== null
      ? minor
      : baht !== undefined && baht !== null
      ? Math.round(baht * 100)
      : 0;

  return <span className={className}>{formatMinor(valueMinor, options)}</span>;
}
```

- [ ] **Step 2: Commit Task 1**

```bash
git add apps/web/components/ui/money.tsx
git commit -m "feat(ui): add central Money component for consistent currency display"
```

---

### Task 2: Refactor Procurement Module (`procurement-client.tsx` & `analytics-client.tsx`)

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/procurement/procurement-client.tsx`
- Modify: `apps/web/app/(clinic)/clinic/procurement/analytics/analytics-client.tsx`

- [ ] **Step 1: Replace all `฿{(po.totalMinor / 100).toFixed(2)}` in `procurement-client.tsx` with `formatMinor(...)` / `<Money />`**

Replace ad-hoc string concatenations in PO table, PO details modal, Supplier Invoice tables, 3-Way Matching variance view, Payment details view with `formatMinor(minor)` or `formatMinor(minor, { showSymbol: true })`.

- [ ] **Step 2: Update `analytics-client.tsx` spend cards and tables**

Replace `฿{(s.totalSpendMinor / 100).toFixed(2)}` with `formatMinor(s.totalSpendMinor)`.

- [ ] **Step 3: Run unit tests to verify**

Run: `npx vitest run lib/currency.spec.ts` in `apps/web`
Expected: PASS

- [ ] **Step 4: Commit Task 2**

```bash
git add 'apps/web/app/(clinic)/clinic/procurement/procurement-client.tsx' 'apps/web/app/(clinic)/clinic/procurement/analytics/analytics-client.tsx'
git commit -m "refactor(procurement): use central currency formatters and Money component across POs, invoices, and analytics"
```

---

### Task 3: Refactor Accounting Journal & Commission Modules

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/accounting/journal/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/commission/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/commission/transactions/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/commission/wht/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/commission/payment-runs/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/commission/payment-runs/[id]/page.tsx`

- [ ] **Step 1: Replace all ad-hoc `toFixed(2)` formatting in `accounting/journal/page.tsx`**

Replace `฿{(row.debitMinor / 100).toFixed(2)}` with `formatMinor(row.debitMinor)`.

- [ ] **Step 2: Replace all ad-hoc formatting in `commission/` pages**

Replace `{(tx.revenueAmountMinor / 100).toFixed(2)}` and `(s.totalAccruedMinor / 100).toFixed(2)` with `formatMinor(minor, { showSymbol: false })` or `formatMinor(minor)`.

- [ ] **Step 3: Verify and run tests**

Run: `npx vitest run lib/currency.spec.ts` in `apps/web`
Expected: PASS

- [ ] **Step 4: Commit Task 3**

```bash
git add 'apps/web/app/(clinic)/clinic/accounting/journal/page.tsx' 'apps/web/app/(clinic)/clinic/commission/'
git commit -m "refactor(accounting,commission): standardize currency formatting across GL journal and commission modules"
```
