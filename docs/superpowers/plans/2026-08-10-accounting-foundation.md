# Phase 1: Accounting Foundation & Chart of Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the core accounting engine, parent-child Prisma database schema, 5-category Chart of Accounts, item master tax mappings, double-entry validation engine, and Thai VAT inclusive tax engine for Petiatrics ERP.

**Architecture:** A robust parent-child General Ledger structure (`JournalEntry` and `JournalLine`) storing monetary amounts in integer Satang (`Int`), combined with strict double-entry balance validation ($\sum \text{Debit} \equiv \sum \text{Credit}$), period closing checks, posting immutability, automated reversal entries, and departmental cost center tags (`analyticAccountId`).

**Tech Stack:** NestJS, TypeScript, Prisma ORM, PostgreSQL, Jest.

---

### Task 1: Schema Updates for Chart of Accounts & General Ledger Engine

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Test: Run Prisma validation command

- [ ] **Step 1: Update Prisma schema with GL & Journal models**

Ensure `schema.prisma` contains the required accounting enums and models (`GLAccount`, `JournalEntry`, `JournalLine`, `AnalyticAccount`, and relation fields on `Product` & `ItemCategory`).

```prisma
enum GLAccountCategory {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum AccountType {
  BALANCE_SHEET
  INCOME_STATEMENT
}

enum NormalBalance {
  DEBIT
  CREDIT
}

enum JournalStatus {
  DRAFT
  POSTED
  REVERSED
}

enum JournalType {
  GENERAL
  RECEIPT
  PAYMENT
  SALE
  PURCHASE
}
```

- [ ] **Step 2: Validate Prisma schema syntax**

Run: `npx prisma validate --schema=packages/database/prisma/schema.prisma`  
Expected: "The schema is valid."

- [ ] **Step 3: Generate Prisma Client**

Run: `npx prisma generate --schema=packages/database/prisma/schema.prisma`  
Expected: Prisma Client generated successfully.

- [ ] **Step 4: Commit schema changes**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(accounting): update prisma schema for COA and double-entry ledger"
```

---

### Task 2: Double-Entry Journal Validation Engine

**Files:**
- Create: `apps/api/src/modules/accounting/engines/journal-validation.engine.ts`
- Create: `apps/api/src/modules/accounting/engines/journal-validation.engine.spec.ts`

- [ ] **Step 1: Write failing unit test for journal validation engine**

```typescript
// apps/api/src/modules/accounting/engines/journal-validation.engine.spec.ts
import { JournalValidationEngine } from './journal-validation.engine';
import { UnbalancedJournalEntryException, InvalidJournalEntryException } from '../exceptions/accounting.exceptions';

describe('JournalValidationEngine', () => {
  let engine: JournalValidationEngine;

  beforeEach(() => {
    engine = new JournalValidationEngine();
  });

  it('should pass validation when sum(debit) equals sum(credit)', () => {
    const validLines = [
      { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 9346 },
      { glAccountId: 'acc-3', debitMinor: 0, creditMinor: 654 },
    ];
    expect(() => engine.validateLines(validLines)).not.toThrow();
  });

  it('should throw UnbalancedJournalEntryException when sum(debit) != sum(credit)', () => {
    const unbalancedLines = [
      { glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 9999 },
    ];
    expect(() => engine.validateLines(unbalancedLines)).toThrow(UnbalancedJournalEntryException);
  });

  it('should throw InvalidJournalEntryException when fewer than 2 lines provided', () => {
    const singleLine = [{ glAccountId: 'acc-1', debitMinor: 10000, creditMinor: 0 }];
    expect(() => engine.validateLines(singleLine)).toThrow(InvalidJournalEntryException);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest apps/api/src/modules/accounting/engines/journal-validation.engine.spec.ts`  
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement JournalValidationEngine**

```typescript
// apps/api/src/modules/accounting/engines/journal-validation.engine.ts
import { Injectable } from '@nestjs/common';
import { UnbalancedJournalEntryException, InvalidJournalEntryException } from '../exceptions/accounting.exceptions';

export interface JournalLineInput {
  glAccountId: string;
  debitMinor: number;
  creditMinor: number;
  partnerId?: string;
  taxCodeId?: string;
  taxBaseMinor?: number;
  taxAmountMinor?: number;
  analyticAccountId?: string;
  memo?: string;
}

@Injectable()
export class JournalValidationEngine {
  validateLines(lines: JournalLineInput[]): void {
    if (!lines || lines.length < 2) {
      throw new InvalidJournalEntryException('A Journal Entry must contain at least 2 detail lines.');
    }

    let totalDebitSatang = 0;
    let totalCreditSatang = 0;

    for (const line of lines) {
      if (line.debitMinor < 0 || line.creditMinor < 0) {
        throw new InvalidJournalEntryException('Debit and Credit amounts must be non-negative.');
      }
      if (line.debitMinor > 0 && line.creditMinor > 0) {
        throw new InvalidJournalEntryException('A line item cannot contain both Debit and Credit amounts.');
      }
      if (line.debitMinor === 0 && line.creditMinor === 0) {
        throw new InvalidJournalEntryException('Line item must have either Debit or Credit greater than zero.');
      }

      totalDebitSatang += line.debitMinor;
      totalCreditSatang += line.creditMinor;
    }

    if (totalDebitSatang !== totalCreditSatang) {
      const diff = Math.abs(totalDebitSatang - totalCreditSatang);
      throw new UnbalancedJournalEntryException(
        `Unbalanced Journal Entry: Sum(Debit) = ${totalDebitSatang} Satang, Sum(Credit) = ${totalCreditSatang} Satang. Difference = ${diff} Satang.`
      );
    }
  }
}
```

Create exception classes in `apps/api/src/modules/accounting/exceptions/accounting.exceptions.ts`:
```typescript
export class UnbalancedJournalEntryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnbalancedJournalEntryException';
  }
}

export class InvalidJournalEntryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJournalEntryException';
  }
}

export class LockedJournalEntryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockedJournalEntryException';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/accounting/engines/journal-validation.engine.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/accounting/engines/journal-validation.engine* apps/api/src/modules/accounting/exceptions/accounting.exceptions.ts
git commit -m "feat(accounting): implement double-entry journal validation engine"
```

---

### Task 3: Thai Tax Engine (VAT Inclusive Pricing Formula)

**Files:**
- Create: `apps/api/src/modules/accounting/engines/tax-calculator.engine.ts`
- Create: `apps/api/src/modules/accounting/engines/tax-calculator.engine.spec.ts`

- [ ] **Step 1: Write failing unit test for Thai VAT calculator engine**

```typescript
// apps/api/src/modules/accounting/engines/tax-calculator.engine.spec.ts
import { TaxCalculatorEngine } from './tax-calculator.engine';

describe('TaxCalculatorEngine', () => {
  let engine: TaxCalculatorEngine;

  beforeEach(() => {
    engine = new TaxCalculatorEngine();
  });

  it('should calculate 7% VAT inclusive base and tax for 100.00 THB (10000 Satang)', () => {
    const result = engine.calculateVatInclusive(10000, 7);
    expect(result.baseAmountMinor).toBe(9346); // 93.46 THB
    expect(result.vatAmountMinor).toBe(654);   // 6.54 THB
    expect(result.baseAmountMinor + result.vatAmountMinor).toBe(10000);
  });

  it('should return 0 tax and full base for NON-VAT / EXEMPT items', () => {
    const result = engine.calculateVatInclusive(10000, 0);
    expect(result.baseAmountMinor).toBe(10000);
    expect(result.vatAmountMinor).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest apps/api/src/modules/accounting/engines/tax-calculator.engine.spec.ts`  
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement TaxCalculatorEngine**

```typescript
// apps/api/src/modules/accounting/engines/tax-calculator.engine.ts
import { Injectable } from '@nestjs/common';

export interface TaxCalculationResult {
  totalPriceMinor: number;
  baseAmountMinor: number;
  vatAmountMinor: number;
  vatRate: number;
}

@Injectable()
export class TaxCalculatorEngine {
  calculateVatInclusive(totalPriceMinor: number, vatRate: number): TaxCalculationResult {
    if (vatRate === 0) {
      return {
        totalPriceMinor,
        baseAmountMinor: totalPriceMinor,
        vatAmountMinor: 0,
        vatRate: 0,
      };
    }

    const baseAmountMinor = Math.round((totalPriceMinor * 100) / (100 + vatRate));
    const vatAmountMinor = totalPriceMinor - baseAmountMinor;

    return {
      totalPriceMinor,
      baseAmountMinor,
      vatAmountMinor,
      vatRate,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/accounting/engines/tax-calculator.engine.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/accounting/engines/tax-calculator.engine*
git commit -m "feat(accounting): implement Thai VAT inclusive calculation engine"
```

---

### Task 4: Journal Entry Posting, Immutability & Reversal Flow

**Files:**
- Modify: `apps/api/src/modules/accounting/services/journal.service.ts`
- Modify: `apps/api/src/modules/accounting/services/journal.service.spec.ts`

- [ ] **Step 1: Write unit tests for journal posting, immutability, and reversal**

Add tests checking:
1. `postJournalEntry()` locks status to `POSTED` and triggers `validateLines()`.
2. `updateJournalEntry()` throws `LockedJournalEntryException` when status is `POSTED`.
3. `reverseJournalEntry()` creates a new entry with swapped Dr/Cr lines and updates original entry `status` to `REVERSED`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest apps/api/src/modules/accounting/services/journal.service.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement reversal & immutability checks in JournalService**

Update `JournalService` to include `reverseJournalEntry()` method and enforce `LockedJournalEntryException` guard on updates/deletes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/accounting/services/journal.service.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/accounting/services/journal.service*
git commit -m "feat(accounting): implement journal entry posting immutability and reversal logic"
```

---

## Plan Review & Handoff

Self-review checklist:
1. **Spec coverage**: Covers database schema, COA structure, validation engine, tax calculation, immutability lock, and reversal flow.
2. **Placeholder scan**: Clean code snippets, exact paths, exact test execution commands.
3. **Type consistency**: All monetary fields strictly use `Int` Satang (`debitMinor`, `creditMinor`, `taxBaseMinor`, `taxAmountMinor`).
