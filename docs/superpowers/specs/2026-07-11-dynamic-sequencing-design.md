# System Specification: Dynamic Document Sequencing Engine

**Status**: Draft  
**Context**: Enhancing the multi-tenant architecture of Petiatrics to support dynamic, custom-configured document number sequencing (e.g. `PO{yyyy}-{number:4}`) with thread-safe atomic counter generation and calendar-based reset rules.

---

## 1. Objectives & Scope

The goal is to replace simple count-based serial numbering across all modules (Purchase Orders, Goods Receipts, Supplier Invoices, Supplier Payments, Customer Invoices, and Appointments) with a unified, configurable sequencing engine.

This engine will:
1. Allow each clinic (tenant) to customize its document formatting templates.
2. Automatically reset numbering counters on calendar intervals (Yearly, Monthly, Daily) without manual actions.
3. Ensure atomic concurrency safety under high volume using database-level operations (`upsert`).

---

## 2. Core Functional Requirements (FR)

### 2.1 Centralized Config Management
*   **FR-201**: The system MUST store sequencing configurations per `clinicId` and `DocumentType` in a `DocumentSequenceConfig` table.
*   **FR-202**: Each configuration defines a formatting template string and a reset rule (`YEARLY`, `MONTHLY`, `DAILY`, `NEVER`).
*   **FR-203**: System default fallback templates MUST be used if no custom config is defined for a clinic:
    *   `PURCHASE_ORDER`: `PO{yyyy}-{number:4}` (Reset: `YEARLY`)
    *   `GOODS_RECEIPT`: `GR{yyyy}-{number:4}` (Reset: `YEARLY`)
    *   `PURCHASE_INVOICE`: `PI{yyyy}-{number:4}` (Reset: `YEARLY`)
    *   `SUPPLIER_PAYMENT`: `SP{yyyy}-{number:4}` (Reset: `YEARLY`)
    *   `CUSTOMER_INVOICE`: `INV{yyyy}-{number:4}` (Reset: `YEARLY`)
    *   `APPOINTMENT`: `APT{yyyy}-{number:4}` (Reset: `YEARLY`)

### 2.2 Thread-Safe Counter Generation
*   **FR-204**: Document code generation MUST be thread-safe. Multiple requests trying to generate a code concurrently for the same clinic, type, and period MUST get sequential numbers without duplicates.
*   **FR-205**: The system MUST perform database-level atomic increments on the sequence counter using a unique constraint covering `(clinicId, documentType, period)`.

### 2.3 Calendar-Based Reset Rules
*   **FR-206**: The counter resets automatically according to the configured `ResetInterval`:
    *   `YEARLY`: Period partition is `"YYYY"` (e.g. `"2026"`). Re-starts at `1` when the calendar year increments.
    *   `MONTHLY`: Period partition is `"YYYY-MM"` (e.g. `"2026-07"`). Re-starts at `1` when the calendar month increments.
    *   `DAILY`: Period partition is `"YYYY-MM-DD"` (e.g. `"2026-07-11"`). Re-starts at `1` when the calendar day changes.
    *   `NEVER`: Period partition is `"GLOBAL"`. The counter increments indefinitely.

### 2.4 Template Placeholder Parsing
*   **FR-207**: The format engine MUST parse and substitute date placeholders:
    *   `{yyyy}`: 4-digit calendar year (e.g. `2026`).
    *   `{yy}`: 2-digit calendar year (e.g. `26`).
    *   `{mm}`: 2-digit month (e.g. `07`).
    *   `{dd}`: 2-digit day (e.g. `11`).
*   **FR-208**: The format engine MUST support `{number:X}` (where `X` is a digit) to pad the serial number to `X` digits (e.g., `{number:4}` formats `5` as `0005`). If `{number}` has no padding specified, the system defaults to a padding length of `4`.

---

## 3. Data Model Design

The following enums and models will be added to the Prisma schema:

```prisma
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

---

## 4. Logical Implementation Flow

### Concurrency Lock & Increment (Upsert)
```typescript
const sequence = await prisma.documentSequence.upsert({
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
```

### Template String Parser RegExp
1.  Match date patterns: replace `{yyyy}` with full year, `{yy}` with last two digits of year, `{mm}` with padded month, `{dd}` with padded day.
2.  Match number pattern: locate `{number:(\d+)}` or `{number}`. Extract padding width (default to 4 if none). Pad `sequence.lastNumber` with leading zeros up to width. Replace matches with the padded number.
