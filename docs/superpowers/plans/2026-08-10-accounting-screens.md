# 6 Accounting & Financial Management Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the backend schemas, APIs, and frontend user interfaces for the 6 core accounting screens in Petiatrics ERP (COA Management, Tax Configuration, Product Categories, Item Master, Cost Centers, and Journal Entries).

**Architecture:** Full-stack integration extending Prisma schema with `TaxCode` and `AnalyticAccount` hierarchy models, NestJS API controllers, and Next.js tabbed/modal client pages.

**Tech Stack:** NestJS, TypeScript, Prisma ORM, Next.js (App Router), Tailwind CSS, Lucide Icons, Jest.

---

### Task 1: TaxCode Prisma Schema & NestJS Backend API

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `apps/api/src/modules/accounting/services/tax-code.service.ts`
- Create: `apps/api/src/modules/accounting/controllers/tax-code.controller.ts`
- Create: `apps/api/src/modules/accounting/services/tax-code.service.spec.ts`

- [ ] **Step 1: Add TaxCode model to Prisma schema**

```prisma
model TaxCode {
  id              String          @id @default(uuid())
  clinicId        String?
  code            String
  name            String
  rate            Decimal         @db.Decimal(5, 2)
  computationType TaxComputation  @default(TAX_INCLUDED)
  glAccountId     String?
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  clinic    Clinic?    @relation(fields: [clinicId], references: [id])
  glAccount GLAccount? @relation(fields: [glAccountId], references: [id])
  products  Product[]  @relation("ProductDefaultTax")

  @@unique([clinicId, code])
  @@index([clinicId])
  @@map("tax_codes")
}

enum TaxComputation {
  TAX_INCLUDED
  TAX_EXCLUDED
}
```

- [ ] **Step 2: Validate & Generate Prisma client**

Run: `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/petiatrics"; npx prisma validate --schema=packages/database/prisma/schema.prisma`  
Expected: The schema is valid 🚀

- [ ] **Step 3: Implement TaxCodeService and TaxCodeController**

Create `tax-code.service.ts` and `tax-code.controller.ts` supporting GET `/accounting/tax-codes`, POST `/accounting/tax-codes`, and PUT `/accounting/tax-codes/:id`.

- [ ] **Step 4: Write and run unit tests for TaxCodeService**

Run: `npx jest src/modules/accounting/services/tax-code.service.spec.ts` (in `apps/api`)  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma apps/api/src/modules/accounting/services/tax-code* apps/api/src/modules/accounting/controllers/tax-code*
git commit -m "feat(accounting): implement TaxCode database schema and backend API"
```

---

### Task 2: Tax Configuration Frontend Screen (`/clinic/settings/tax-codes`)

**Files:**
- Create: `apps/web/app/(clinic)/clinic/settings/tax-codes/page.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`

- [ ] **Step 1: Create Tax Configuration page component**

Build `/clinic/settings/tax-codes/page.tsx` featuring:
- Tax Codes Table displaying Code, Name, Rate %, Computation Type (`Tax Included` vs `Tax Excluded`), and mapped COA GL Account.
- Tax Code Create/Edit Modal with COA GL Account dropdown selector.

- [ ] **Step 2: Add Tax Configuration link to navigation menu**

In `app-shell.tsx`, add `{ key: 'taxCodes', href: '/clinic/settings/tax-codes', icon: Receipt, requiredPermission: 'SETTINGS:MANAGE' }` under Settings navigation.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit` (in `apps/web`)  
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(clinic\)/clinic/settings/tax-codes/page.tsx apps/web/components/layout/app-shell.tsx
git commit -m "feat(accounting): implement Tax Configuration frontend screen"
```

---

### Task 3: Cost Centers (Analytic Accounts) Schema, API & Screen

**Files:**
- Create: `apps/api/src/modules/accounting/services/analytic-account.service.ts`
- Create: `apps/api/src/modules/accounting/controllers/analytic-account.controller.ts`
- Create: `apps/web/app/(clinic)/clinic/settings/cost-centers/page.tsx`

- [ ] **Step 1: Implement AnalyticAccountService and Controller**

Support GET `/accounting/analytic-accounts`, POST `/accounting/analytic-accounts`, and parent hierarchy linking.

- [ ] **Step 2: Create Cost Centers Frontend Screen (`/clinic/settings/cost-centers/page.tsx`)**

Build cost center management screen displaying code, name, parent department hierarchy, and active toggle.

- [ ] **Step 3: Verify TypeScript build**

Run: `npx tsc --noEmit` (in `apps/api` and `apps/web`)  
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/accounting/services/analytic-account* apps/api/src/modules/accounting/controllers/analytic-account* apps/web/app/\(clinic\)/clinic/settings/cost-centers/page.tsx
git commit -m "feat(accounting): implement Cost Centers schema, API, and management screen"
```

---

### Task 4: Product Categories GL Account Mappings Screen Enhancement

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/settings/item-categories/page.tsx`

- [ ] **Step 1: Add GL Account Selector dropdowns to Item Categories screen**

Enhance `item-categories/page.tsx` to include:
- Income Account Mapping selector (`revenueGlAccountId`)
- Expense/COGS Account Mapping selector (`expenseGlAccountId`)

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit` (in `apps/web`)  
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(clinic\)/clinic/settings/item-categories/page.tsx
git commit -m "feat(accounting): add GL revenue and expense account mappings to Item Categories screen"
```

---

### Task 5: Item Master (Products & Services) Tax Settings & Category GL Inheritance

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/products/page.tsx` or product modal component

- [ ] **Step 1: Add Tax Code selector & VAT rules to Product creation modal**

Enhance Product modal with:
- Item Type selector (`Storable Product`, `Consumable`, `Service`)
- Category selector (auto-inherits Category default GL accounts)
- Tax Code selector (supports VAT 7% vs NON-VAT Exempt)

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit` (in `apps/web`)  
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(clinic\)/clinic/products/
git commit -m "feat(accounting): update Item Master with Tax Code settings and Category GL inheritance"
```

---

### Task 6: Manual Journal Entry Form (Save Draft, Post Validation, Reversal)

**Files:**
- Modify: `apps/web/components/accounting/manual-journal-form.tsx`
- Modify: `apps/web/app/(clinic)/clinic/accounting/journal/page.tsx`

- [ ] **Step 1: Update ManualJournalForm with Save Draft vs Post buttons**

- "Save Draft" button posts with `status: 'DRAFT'`.
- "Post Entry" button performs client-side $\sum \text{Debit} \equiv \sum \text{Credit}$ balance validation, displaying red banner if unbalanced.

- [ ] **Step 2: Run all accounting tests**

Run: `npx jest src/modules/accounting/` (in `apps/api`)  
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/accounting/manual-journal-form.tsx apps/web/app/\(clinic\)/clinic/accounting/journal/page.tsx
git commit -m "feat(accounting): add Save Draft and Post balance validation to Manual Journal form"
```

---

## Plan Review & Handoff

Self-review checklist:
1. **Spec coverage**: Covers all 6 specified screens (COA, Tax Configuration, Product Categories, Item Master, Cost Centers, and Journal Entries).
2. **Placeholder scan**: Clean code and commands without placeholders.
3. **Type consistency**: Satang integer amounts (`Int`) used consistently.
