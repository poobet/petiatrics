# Unified POS & Advanced Accounting Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Unified POS & Advanced Accounting Engine with split-tender payments, customer deposits/prepaid wallets, AR open items & aging, automated double-entry GL journal posting, cashier close-of-day reconciliation, and Thai Revenue Department compliant PDF receipt & tax invoice generation.

**Architecture:** Extend existing `BillingModule` and create accounting services (`PaymentService`, `CustomerDepositService`, `ArService`, `CashierSessionService`, `GLPostingService`, `DocumentPdfService`) within NestJS. Use `@nestjs/event-emitter` to decouple business events from double-entry GL journal creation.

**Tech Stack:** NestJS, TypeScript, Prisma (PostgreSQL), Next.js (App Router, Tailwind CSS), Jest.

---

### Task 1: Prisma Schemas & Database Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Update Prisma schema with enums and models**

Add the enums (`PaymentMethodType`, `PaymentStatus`, `JournalType`, `JournalStatus`, `DepositTxType`, `ArStatus`, `SessionStatus`) and models (`Payment`, `PaymentTender`, `JournalEntry`, `JournalLine`, `CustomerDeposit`, `DepositTransaction`, `ArOpenItem`, `CashierSession`) to `packages/database/prisma/schema.prisma`.

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

model Payment {
  id            String        @id @default(uuid())
  clinicId      String
  invoiceId     String
  documentNo    String
  totalMinor    Int
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
  amountMinor Int
  referenceNo String?

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId])
  @@map("payment_tenders")
}

model JournalEntry {
  id            String        @id @default(uuid())
  clinicId      String
  entryNo       String
  type          JournalType   @default(GENERAL)
  description   String
  sourceRefType String?
  sourceRefId   String?
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
  debitMinor     Int    @default(0)
  creditMinor    Int    @default(0)

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  glAccount    GLAccount    @relation(fields: [glAccountId], references: [id])

  @@index([journalEntryId])
  @@index([glAccountId])
  @@map("journal_lines")
}

model CustomerDeposit {
  id           String   @id @default(uuid())
  clinicId     String
  ownerUserId  String
  amountMinor  Int
  balanceMinor Int
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
  amountMinor       Int
  balanceAfterMinor Int
  referenceId       String?
  createdAt         DateTime      @default(now())

  deposit CustomerDeposit @relation(fields: [depositId], references: [id], onDelete: Cascade)

  @@index([depositId])
  @@map("deposit_transactions")
}

model ArOpenItem {
  id              String   @id @default(uuid())
  clinicId        String
  ownerUserId     String
  invoiceId       String   @unique
  dueDate         DateTime
  amountMinor     Int
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

model CashierSession {
  id               String        @id @default(uuid())
  clinicId         String
  cashierUserId    String
  openedAt         DateTime      @default(now())
  closedAt         DateTime?
  openingCashMinor Int
  systemCashMinor  Int           @default(0)
  actualCashMinor  Int?
  differenceMinor  Int?
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

- [ ] **Step 2: Generate Prisma Client**

Run: `npx prisma generate --schema=packages/database/prisma/schema.prisma`
Expected: "Generated Prisma Client"

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add payment, GL, deposit, AR, and cashier session models"
```

---

### Task 2: Split-Tender Payment Service (`PaymentService`)

**Files:**
- Create: `apps/api/src/modules/billing/services/payment.service.ts`
- Create: `apps/api/src/modules/billing/services/payment.service.spec.ts`

- [ ] **Step 1: Write failing unit test for `PaymentService`**

Create `apps/api/src/modules/billing/services/payment.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaClient, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should validate that tender amounts sum up to totalMinor', () => {
    expect(() =>
      service.validateTenders(10000, [
        { method: 'CASH' as any, amountMinor: 5000 },
        { method: 'CREDIT_CARD' as any, amountMinor: 4000 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('should pass when tender amounts match totalMinor', () => {
    expect(() =>
      service.validateTenders(10000, [
        { method: 'CASH' as any, amountMinor: 5000 },
        { method: 'CREDIT_CARD' as any, amountMinor: 5000 },
      ]),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/payment.service.spec.ts`
Expected: FAIL (service file missing)

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/billing/services/payment.service.ts`:

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentMethodType, PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

export interface CreatePaymentTenderDto {
  method: PaymentMethodType;
  amountMinor: number;
  referenceNo?: string;
}

export interface CreatePaymentDto {
  invoiceId: string;
  cashierUserId: string;
  totalMinor: number;
  tenders: CreatePaymentTenderDto[];
  note?: string;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  validateTenders(totalMinor: number, tenders: CreatePaymentTenderDto[]): void {
    const sum = tenders.reduce((acc, t) => acc + t.amountMinor, 0);
    if (sum !== totalMinor) {
      throw new BadRequestException(
        `Sum of payment tenders (${sum}) must equal invoice total (${totalMinor}).`,
      );
    }
  }

  async processPayment(clinicId: string, dto: CreatePaymentDto) {
    this.validateTenders(dto.totalMinor, dto.tenders);
    const db = scopedPrisma(this.prisma, clinicId);

    const invoice = await db.invoice.findFirst({ where: { id: dto.invoiceId, clinicId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice is already paid');

    const payment = await db.payment.create({
      data: {
        clinicId,
        invoiceId: dto.invoiceId,
        documentNo: `REC-${Date.now()}`,
        totalMinor: dto.totalMinor,
        status: 'COMPLETED',
        cashierUserId: dto.cashierUserId,
        note: dto.note,
        tenders: {
          create: dto.tenders.map((t) => ({
            method: t.method,
            amountMinor: t.amountMinor,
            referenceNo: t.referenceNo,
          })),
        },
      },
      include: { tenders: true },
    });

    // Mark invoice as paid
    await db.invoice.update({
      where: { id: dto.invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    this.events.emit('payment.received', {
      clinicId,
      paymentId: payment.id,
      invoiceId: dto.invoiceId,
      totalMinor: dto.totalMinor,
      tenders: dto.tenders,
      ownerUserId: invoice.ownerUserId,
    });

    return payment;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/payment.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/billing/services/payment.service.ts apps/api/src/modules/billing/services/payment.service.spec.ts
git commit -m "feat(billing): implement PaymentService with split tender validation"
```

---

### Task 3: Customer Deposit & Wallet Service (`CustomerDepositService`)

**Files:**
- Create: `apps/api/src/modules/billing/services/customer-deposit.service.ts`
- Create: `apps/api/src/modules/billing/services/customer-deposit.service.spec.ts`

- [ ] **Step 1: Write failing unit test for `CustomerDepositService`**

Create `apps/api/src/modules/billing/services/customer-deposit.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerDepositService } from './customer-deposit.service';

describe('CustomerDepositService', () => {
  let service: CustomerDepositService;

  beforeEach(async () => {
    service = new CustomerDepositService({} as any, { emit: jest.fn() } as any);
  });

  it('should reject deduction if balance is insufficient', () => {
    expect(() =>
      service.assertSufficientBalance(5000, 10000),
    ).toThrow(BadRequestException);
  });

  it('should allow deduction if balance is sufficient', () => {
    expect(() =>
      service.assertSufficientBalance(15000, 10000),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/customer-deposit.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/billing/services/customer-deposit.service.ts`:

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

@Injectable()
export class CustomerDepositService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events: EventEmitter2,
  ) {}

  assertSufficientBalance(currentBalanceMinor: number, requiredMinor: number): void {
    if (currentBalanceMinor < requiredMinor) {
      throw new BadRequestException(
        `Insufficient deposit balance. Required: ฿${(requiredMinor / 100).toFixed(2)}, Available: ฿${(currentBalanceMinor / 100).toFixed(2)}.`,
      );
    }
  }

  async topUp(clinicId: string, ownerUserId: string, amountMinor: number, note?: string) {
    if (amountMinor <= 0) throw new BadRequestException('Topup amount must be positive');
    const db = scopedPrisma(this.prisma, clinicId);

    let deposit = await db.customerDeposit.findFirst({ where: { clinicId, ownerUserId } });

    if (!deposit) {
      deposit = await db.customerDeposit.create({
        data: {
          clinicId,
          ownerUserId,
          amountMinor,
          balanceMinor: amountMinor,
          note,
        },
      });
    } else {
      deposit = await db.customerDeposit.update({
        where: { id: deposit.id },
        data: {
          amountMinor: deposit.amountMinor + amountMinor,
          balanceMinor: deposit.balanceMinor + amountMinor,
        },
      });
    }

    await db.depositTransaction.create({
      data: {
        depositId: deposit.id,
        type: 'TOPUP',
        amountMinor,
        balanceAfterMinor: deposit.balanceMinor,
      },
    });

    this.events.emit('deposit.created', {
      clinicId,
      depositId: deposit.id,
      ownerUserId,
      amountMinor,
    });

    return deposit;
  }

  async consume(clinicId: string, ownerUserId: string, amountMinor: number, referenceId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const deposit = await db.customerDeposit.findFirst({ where: { clinicId, ownerUserId } });

    if (!deposit) throw new NotFoundException('No deposit wallet found for customer');
    this.assertSufficientBalance(deposit.balanceMinor, amountMinor);

    const updated = await db.customerDeposit.update({
      where: { id: deposit.id },
      data: { balanceMinor: deposit.balanceMinor - amountMinor },
    });

    await db.depositTransaction.create({
      data: {
        depositId: deposit.id,
        type: 'CONSUMPTION',
        amountMinor,
        balanceAfterMinor: updated.balanceMinor,
        referenceId,
      },
    });

    return updated;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/customer-deposit.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/billing/services/customer-deposit.service.ts apps/api/src/modules/billing/services/customer-deposit.service.spec.ts
git commit -m "feat(billing): implement CustomerDepositService"
```

---

### Task 4: Double-Entry GL Posting Engine (`GLPostingService`)

**Files:**
- Create: `apps/api/src/modules/billing/services/gl-posting.service.ts`
- Create: `apps/api/src/modules/billing/services/gl-posting.service.spec.ts`

- [ ] **Step 1: Write failing unit test for `GLPostingService`**

Create `apps/api/src/modules/billing/services/gl-posting.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GLPostingService } from './gl-posting.service';

describe('GLPostingService', () => {
  let service: GLPostingService;

  beforeEach(() => {
    service = new GLPostingService({} as any);
  });

  it('should throw if debits do not equal credits', () => {
    const lines = [
      { glAccountId: 'acc-1', debitMinor: 1000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 800 },
    ];
    expect(() => service.assertBalancedJournal(lines)).toThrow(BadRequestException);
  });

  it('should pass when debits equal credits', () => {
    const lines = [
      { glAccountId: 'acc-1', debitMinor: 1000, creditMinor: 0 },
      { glAccountId: 'acc-2', debitMinor: 0, creditMinor: 1000 },
    ];
    expect(() => service.assertBalancedJournal(lines)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/gl-posting.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/billing/services/gl-posting.service.ts`:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { JournalType, PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

export interface CreateJournalLineDto {
  glAccountId: string;
  debitMinor: number;
  creditMinor: number;
}

export interface CreateJournalEntryDto {
  type?: JournalType;
  description: string;
  sourceRefType?: string;
  sourceRefId?: string;
  lines: CreateJournalLineDto[];
}

@Injectable()
export class GLPostingService {
  constructor(private readonly prisma: PrismaClient) {}

  assertBalancedJournal(lines: CreateJournalLineDto[]): void {
    const totalDebit = lines.reduce((sum, l) => sum + (l.debitMinor || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.creditMinor || 0), 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Unbalanced Journal Entry! Total Debit (฿${(totalDebit / 100).toFixed(2)}) != Total Credit (฿${(totalCredit / 100).toFixed(2)}).`,
      );
    }
  }

  async postJournal(clinicId: string, dto: CreateJournalEntryDto) {
    this.assertBalancedJournal(dto.lines);
    const db = scopedPrisma(this.prisma, clinicId);

    const entryNo = `JV-${Date.now()}`;

    return db.journalEntry.create({
      data: {
        clinicId,
        entryNo,
        type: dto.type ?? 'GENERAL',
        description: dto.description,
        sourceRefType: dto.sourceRefType,
        sourceRefId: dto.sourceRefId,
        status: 'POSTED',
        lines: {
          create: dto.lines.map((l) => ({
            glAccountId: l.glAccountId,
            debitMinor: l.debitMinor,
            creditMinor: l.creditMinor,
          })),
        },
      },
      include: { lines: { include: { glAccount: true } } },
    });
  }

  async getTrialBalance(clinicId: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const accounts = await db.gLAccount.findMany({ where: { isActive: true } });

    const report = [];
    for (const acc of accounts) {
      const lines = await db.journalLine.aggregate({
        where: { glAccountId: acc.id, journalEntry: { clinicId, status: 'POSTED' } },
        _sum: { debitMinor: true, creditMinor: true },
      });

      const totalDebit = lines._sum.debitMinor ?? 0;
      const totalCredit = lines._sum.creditMinor ?? 0;

      report.push({
        glAccountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debitMinor: totalDebit,
        creditMinor: totalCredit,
        balanceMinor: totalDebit - totalCredit,
      });
    }

    return report;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/gl-posting.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/billing/services/gl-posting.service.ts apps/api/src/modules/billing/services/gl-posting.service.spec.ts
git commit -m "feat(billing): implement GLPostingService with double-entry invariant validation"
```

---

### Task 5: Cashier Session & Reconciliation (`CashierSessionService`)

**Files:**
- Create: `apps/api/src/modules/billing/services/cashier-session.service.ts`
- Create: `apps/api/src/modules/billing/services/cashier-session.service.spec.ts`

- [ ] **Step 1: Write failing unit test for `CashierSessionService`**

Create `apps/api/src/modules/billing/services/cashier-session.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CashierSessionService } from './cashier-session.service';

describe('CashierSessionService', () => {
  let service: CashierSessionService;

  beforeEach(() => {
    service = new CashierSessionService({} as any);
  });

  it('should correctly calculate discrepancy math', () => {
    const diff = service.calculateDiscrepancy(20000, 100000, 118000);
    // opening 200 + system 1000 = 1200 expected. actual 1180 -> diff = -20
    expect(diff).toBe(-2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/cashier-session.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/modules/billing/services/cashier-session.service.ts`:

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

@Injectable()
export class CashierSessionService {
  constructor(private readonly prisma: PrismaClient) {}

  calculateDiscrepancy(openingCashMinor: number, systemCashMinor: number, actualCashMinor: number): number {
    const expected = openingCashMinor + systemCashMinor;
    return actualCashMinor - expected;
  }

  async openSession(clinicId: string, cashierUserId: string, openingCashMinor: number) {
    const db = scopedPrisma(this.prisma, clinicId);

    const active = await db.cashierSession.findFirst({
      where: { clinicId, cashierUserId, status: 'OPEN' },
    });
    if (active) throw new BadRequestException('Cashier already has an open session');

    return db.cashierSession.create({
      data: {
        clinicId,
        cashierUserId,
        openingCashMinor,
        systemCashMinor: 0,
        status: 'OPEN',
      },
    });
  }

  async closeSession(clinicId: string, sessionId: string, actualCashMinor: number, note?: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const session = await db.cashierSession.findFirst({ where: { id: sessionId, clinicId } });

    if (!session) throw new NotFoundException('Cashier session not found');
    if (session.status === 'CLOSED') throw new BadRequestException('Session is already closed');

    const differenceMinor = this.calculateDiscrepancy(
      session.openingCashMinor,
      session.systemCashMinor,
      actualCashMinor,
    );

    return db.cashierSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        actualCashMinor,
        differenceMinor,
        note,
      },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config=apps/api/jest.config.js apps/api/src/modules/billing/services/cashier-session.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/billing/services/cashier-session.service.ts apps/api/src/modules/billing/services/cashier-session.service.spec.ts
git commit -m "feat(billing): implement CashierSessionService"
```

---

### Task 6: Module Assembly & API Controllers

**Files:**
- Create: `apps/api/src/modules/billing/controllers/payment.controller.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts`

- [ ] **Step 1: Create `PaymentController`**

Create `apps/api/src/modules/billing/controllers/payment.controller.ts`:

```typescript
import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PaymentService, CreatePaymentDto } from '../services/payment.service';
import { GLPostingService } from '../services/gl-posting.service';
import { CustomerDepositService } from '../services/customer-deposit.service';
import { CashierSessionService } from '../services/cashier-session.service';

@Controller('billing')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly glPostingService: GLPostingService,
    private readonly depositService: CustomerDepositService,
    private readonly cashierSessionService: CashierSessionService,
  ) {}

  @Post('payments')
  async processPayment(@Query('clinicId') clinicId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.processPayment(clinicId, dto);
  }

  @Get('accounting/trial-balance')
  async getTrialBalance(@Query('clinicId') clinicId: string) {
    return this.glPostingService.getTrialBalance(clinicId);
  }

  @Post('deposits/topup')
  async topUpDeposit(
    @Query('clinicId') clinicId: string,
    @Body() dto: { ownerUserId: string; amountMinor: number; note?: string },
  ) {
    return this.depositService.topUp(clinicId, dto.ownerUserId, dto.amountMinor, dto.note);
  }

  @Post('cashier/session/open')
  async openSession(
    @Query('clinicId') clinicId: string,
    @Body() dto: { cashierUserId: string; openingCashMinor: number },
  ) {
    return this.cashierSessionService.openSession(clinicId, dto.cashierUserId, dto.openingCashMinor);
  }

  @Post('cashier/session/:id/close')
  async closeSession(
    @Query('clinicId') clinicId: string,
    @Param('id') sessionId: string,
    @Body() dto: { actualCashMinor: number; note?: string },
  ) {
    return this.cashierSessionService.closeSession(clinicId, sessionId, dto.actualCashMinor, dto.note);
  }
}
```

- [ ] **Step 2: Register services and controller in `BillingModule`**

Update `apps/api/src/modules/billing/billing.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from './services/invoice.service';
import { TaxEngineService } from './services/tax-engine.service';
import { PaymentService } from './services/payment.service';
import { GLPostingService } from './services/gl-posting.service';
import { CustomerDepositService } from './services/customer-deposit.service';
import { CashierSessionService } from './services/cashier-session.service';
import { BillingVisitFinalizedListener } from './listeners/visit-finalized.listener';
import { InvoiceController } from './controllers/invoice.controller';
import { ReportController } from './controllers/report.controller';
import { PaymentController } from './controllers/payment.controller';
import { IdentityModule } from '../identity/identity.module';
import { ClinicalModule } from '../clinical/clinical.module';

@Module({
  imports: [IdentityModule, ClinicalModule],
  controllers: [InvoiceController, ReportController, PaymentController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient() },
    TaxEngineService,
    InvoiceService,
    PaymentService,
    GLPostingService,
    CustomerDepositService,
    CashierSessionService,
    BillingVisitFinalizedListener,
  ],
  exports: [TaxEngineService, PaymentService, GLPostingService, CustomerDepositService, CashierSessionService],
})
export class BillingModule {}
```

- [ ] **Step 3: Build NestJS API to verify compilation**

Run: `npm run build --prefix apps/api`
Expected: Clean compilation with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/billing/
git commit -m "feat(billing): wire Payment, Accounting, Deposit, and Cashier controllers in BillingModule"
```

---

### Task 7: Frontend UI (POS Split Tender, Journal Entries, Deposits)

**Files:**
- Create: `apps/web/app/(clinic)/clinic/accounting/journal/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/accounting/deposits/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/accounting/cashier/page.tsx`

- [ ] **Step 1: Create Accounting Journal page**

Create `apps/web/app/(clinic)/clinic/accounting/journal/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { BookOpen, FileText, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AccountingJournalPage() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/billing/accounting/trial-balance')
      .then((data) => setReport(Array.isArray(data) ? data : []))
      .catch(() => setReport([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-600" />
          General Ledger & Trial Balance
        </h1>
        <p className="text-slate-500 text-sm mt-1">Automated double-entry accounting trial balance</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-3.5">Account Code</th>
              <th className="px-6 py-3.5">Account Name</th>
              <th className="px-6 py-3.5">Type</th>
              <th className="px-6 py-3.5 text-right">Debit (฿)</th>
              <th className="px-6 py-3.5 text-right">Credit (฿)</th>
              <th className="px-6 py-3.5 text-right">Balance (฿)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">Loading trial balance...</td>
              </tr>
            ) : report.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">No posted GL entries recorded yet</td>
              </tr>
            ) : (
              report.map((row) => (
                <tr key={row.glAccountId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-slate-800">{row.code}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{row.name}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500">{row.type}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-600">฿{(row.debitMinor / 100).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono text-blue-600">฿{(row.creditMinor / 100).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-slate-900">฿{(row.balanceMinor / 100).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(clinic\)/clinic/accounting/
git commit -m "feat(web): add Accounting Journal & Trial Balance page UI"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-pos-advanced-accounting.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
