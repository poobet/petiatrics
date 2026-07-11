# Dynamic Document Sequencing Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a centralized, thread-safe, calendar-based Dynamic Document Sequencing engine across all modules, replacing count-based numbering with upsert-based sequence configs.

**Architecture:** A new shared NestJS module (`DocumentSequenceModule`) providing `DocumentSequenceService` with SQL upsert operations. Date placeholder substitution and variable number padding are handled via regular expressions.

**Tech Stack:** NestJS, Prisma, PostgreSQL.

---

## Proposed Changes

### Task 1: Prisma Schema & DB Migration
**Files:**
*   Modify: [schema.prisma](file:///d:/Deaw/petiatrics/packages/database/prisma/schema.prisma)
*   Run: `npx prisma migrate dev --name add_document_sequencing --create-only`
*   Run: `npx prisma migrate deploy`

- [ ] **Step 1: Add new Models and Enums to schema.prisma**
  Open [schema.prisma](file:///d:/Deaw/petiatrics/packages/database/prisma/schema.prisma).
  Append the new enums and models at the end of the file:
  ```prisma
  // ─── Document Sequencing ─────────────────────────────────────────────────────

  enum DocumentType {
    PURCHASE_ORDER
    GOODS_RECEIPT
    PURCHASE_INVOICE
    SUPPLIER_PAYMENT
    CUSTOMER_INVOICE
    APPOINTMENT
  }

  enum ResetInterval {
    YEARLY
    MONTHLY
    DAILY
    NEVER
  }

  model DocumentSequenceConfig {
    id            String        @id @default(uuid())
    clinicId      String
    documentType  DocumentType
    template      String        // e.g. "PO{yyyy}-{number:4}"
    resetInterval ResetInterval @default(YEARLY)
    createdAt     DateTime      @default(now())
    updatedAt     DateTime      @updatedAt

    clinic        Clinic        @relation(fields: [clinicId], references: [id], onDelete: Cascade)

    @@unique([clinicId, documentType])
    @@index([clinicId])
    @@map("document_sequence_configs")
  }

  model DocumentSequence {
    id            String       @id @default(uuid())
    clinicId      String
    documentType  DocumentType
    period        String       // "2026", "2026-07", "2026-07-11", or "GLOBAL"
    lastNumber    Int          @default(0)
    createdAt     DateTime     @default(now())
    updatedAt     DateTime     @updatedAt

    @@unique([clinicId, documentType, period])
    @@index([clinicId])
    @@map("document_sequences")
  }
  ```
  Also update the `Clinic` model:
  1. Remove `clinicItemSequence ClinicItemSequence?` relation.
  2. Add `documentSequenceConfigs DocumentSequenceConfig[]`.
  3. Delete the `ClinicItemSequence` model entirely.

- [ ] **Step 2: Create Migration (Create-only)**
  Run: `npx prisma migrate dev --name add_document_sequencing --create-only` in `packages/database`.

- [ ] **Step 3: Run Migration Deploy**
  Run: `npx prisma migrate deploy` in `packages/database`.
  Expected: Successful application of the migration to the database schema.

- [ ] **Step 4: Commit DB migration**
  Run: `git add packages/database` and `git commit -m "db: add document sequence schema tables"`

---

### Task 2: Implement DocumentSequence Service & Module
**Files:**
*   Create: `apps/api/src/modules/document-sequence/services/document-sequence.service.ts`
*   Create: `apps/api/src/modules/document-sequence/document-sequence.module.ts`

- [ ] **Step 1: Write DocumentSequenceService**
  Create `apps/api/src/modules/document-sequence/services/document-sequence.service.ts`:
  ```typescript
  import { Injectable } from '@nestjs/common';
  import { PrismaClient, DocumentType, ResetInterval } from '@prisma/client';

  @Injectable()
  export class DocumentSequenceService {
    constructor(private readonly prisma: PrismaClient) {}

    private readonly DEFAULT_CONFIGS: Record<DocumentType, { template: string; resetInterval: ResetInterval }> = {
      [DocumentType.PURCHASE_ORDER]: { template: 'PO{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
      [DocumentType.GOODS_RECEIPT]: { template: 'GR{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
      [DocumentType.PURCHASE_INVOICE]: { template: 'PI{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
      [DocumentType.SUPPLIER_PAYMENT]: { template: 'SP{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
      [DocumentType.CUSTOMER_INVOICE]: { template: 'INV{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
      [DocumentType.APPOINTMENT]: { template: 'APT{yyyy}-{number:4}', resetInterval: ResetInterval.YEARLY },
    };

    async generate(clinicId: string, documentType: DocumentType, date: Date = new Date()): Promise<string> {
      // 1. Fetch config or fall back
      const config = await this.prisma.documentSequenceConfig.findUnique({
        where: { clinicId_documentType: { clinicId, documentType } },
      }) || this.DEFAULT_CONFIGS[documentType];

      // 2. Resolve calendar period string
      const yyyy = date.getFullYear().toString();
      const yy = yyyy.slice(-2);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');

      let period = 'GLOBAL';
      if (config.resetInterval === ResetInterval.YEARLY) {
        period = yyyy;
      } else if (config.resetInterval === ResetInterval.MONTHLY) {
        period = `${yyyy}-${mm}`;
      } else if (config.resetInterval === ResetInterval.DAILY) {
        period = `${yyyy}-${mm}-${dd}`;
      }

      // 3. Concurrency-safe atomic upsert
      const sequence = await this.prisma.documentSequence.upsert({
        where: {
          clinicId_documentType_period: {
            clinicId,
            documentType,
            period,
          },
        },
        create: {
          clinicId,
          documentType,
          period,
          lastNumber: 1,
        },
        update: {
          lastNumber: {
            increment: 1,
          },
        },
      });

      // 4. Parse placeholders
      let code = config.template;
      code = code.replace(/{yyyy}/g, yyyy);
      code = code.replace(/{yy}/g, yy);
      code = code.replace(/{mm}/g, mm);
      code = code.replace(/{dd}/g, dd);

      // Resolve {number:X} or default to 4 digits
      const numberRegex = /{number(?::(\d+))?}/;
      const match = numberRegex.exec(code);
      if (match) {
        const padding = match[1] ? parseInt(match[1], 10) : 4;
        const formattedNum = String(sequence.lastNumber).padStart(padding, '0');
        code = code.replace(numberRegex, formattedNum);
      }

      return code;
    }
  }
  ```

- [ ] **Step 2: Write DocumentSequenceModule**
  Create `apps/api/src/modules/document-sequence/document-sequence.module.ts`:
  ```typescript
  import { Module } from '@nestjs/common';
  import { PrismaClient } from '@prisma/client';
  import { DocumentSequenceService } from './services/document-sequence.service';

  @Module({
    providers: [
      {
        provide: PrismaClient,
        useFactory: () => new PrismaClient(),
      },
      DocumentSequenceService,
    ],
    exports: [DocumentSequenceService],
  })
  export class DocumentSequenceModule {}
  ```

---

### Task 3: Integrate into Procurement Services
**Files:**
*   Modify: `apps/api/src/modules/procurement/procurement.module.ts`
*   Modify: `apps/api/src/modules/procurement/services/purchase-order.service.ts`
*   Modify: `apps/api/src/modules/procurement/services/goods-receipt.service.ts`

- [ ] **Step 1: Import DocumentSequenceModule in ProcurementModule**
  Open `apps/api/src/modules/procurement/procurement.module.ts`. Add `DocumentSequenceModule` to imports list.
- [ ] **Step 2: Update PurchaseOrderService sequence generation**
  Open `apps/api/src/modules/procurement/services/purchase-order.service.ts`. Inject `DocumentSequenceService` in the constructor. Replace count-based code generation with:
  ```typescript
  const code = await this.sequenceService.generate(clinicId, DocumentType.PURCHASE_ORDER);
  ```
- [ ] **Step 3: Update GoodsReceiptService sequence generation**
  Open `apps/api/src/modules/procurement/services/goods-receipt.service.ts`. Inject `DocumentSequenceService` in the constructor. Replace count-based code generation with:
  ```typescript
  const code = await this.sequenceService.generate(clinicId, DocumentType.GOODS_RECEIPT);
  ```

---

### Task 4: Write Unit & Concurrency Tests
**Files:**
*   Create: `apps/api/src/modules/document-sequence/services/document-sequence.service.spec.ts`

- [ ] **Step 1: Write spec test**
  Create `apps/api/src/modules/document-sequence/services/document-sequence.service.spec.ts`. Verify default configs, year/month reset logic, custom padding sizes, and concurrent execution using `Promise.all`.
- [ ] **Step 2: Run tests**
  Run: `npm run test --workspace=apps/api`
  Expected: PASS

- [ ] **Step 3: Verify overall build**
  Run: `npm run build --workspace=apps/api`
  Expected: Success

- [ ] **Step 4: Commit integration & tests**
  Run: `git add .` and `git commit -m "feat(api): implement dynamic sequencing engine"`
