# Document Sequence Module-based Configuration Design Spec

## Overview
This specification details the design for introducing module-based classification to document types and sequence configurations in the Petiatrics platform. It enables:
1. Categorized sequence configuration on the central settings page (`/clinic/settings/document-sequence`) via module tabs.
2. A shared, reusable UI component (`<ModuleDocumentSequenceConfig module="..." />`) embeddable directly into individual module settings pages (Procurement, Billing & POS, Appointments, Inventory, Clinical).

## Motivation & Goals
Currently, document sequences are managed globally under `/clinic/settings/document-sequence` as an unstructured list of document type definitions and clinic overrides. Users working within specific domain modules (e.g., Procurement or Billing) have to navigate away to the central settings page to manage document prefix templates.

### Key Objectives
- Add a explicit `DocumentModule` enum and field to the database schema.
- Update system seed data to categorize default document types by module.
- Support module-based filtering in backend APIs (`GET /document-sequence/types?module=...`).
- Redesign the central document sequence settings page to support tabbed module navigation and overview metrics.
- Build a standalone reusable component (`ModuleDocumentSequenceConfig`) to embed directly into module settings pages.

---

## Architecture & Data Model

### 1. Database Schema (`packages/database/prisma/schema.prisma`)

Add the `DocumentModule` enum and add `module` field to `DocumentTypeDefinition`:

```prisma
enum DocumentModule {
  PROCUREMENT
  BILLING
  APPOINTMENT
  INVENTORY
  CLINICAL
  GENERAL
}

model DocumentTypeDefinition {
  id                   String          @id @default(cuid())
  clinicId             String?         // null = System built-in default type
  code                 String          // e.g. "PURCHASE_ORDER", "CUSTOMER_INVOICE"
  label                String          // e.g. "Purchase Order", "Customer Invoice"
  module               DocumentModule  @default(GENERAL)
  defaultTemplate      String          // e.g. "PO{yyyy}-{number:4}"
  defaultResetInterval ResetInterval   @default(YEARLY)
  scope                SequenceScope   @default(CLINIC)
  isSystem             Boolean         @default(false)
  isActive             Boolean         @default(true)
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt

  clinic               Clinic?         @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  configs              DocumentSequenceConfig[]

  @@unique([clinicId, code])
  @@index([clinicId])
  @@index([module])
}
```

### 2. Database Seeding (`packages/database/src/seed.ts`)

System built-in document types are seeded with assigned `module` values:

| Code | Label | Default Template | Assigned `DocumentModule` |
|---|---|---|---|
| `PURCHASE_ORDER` | Purchase Order | `PO{yyyy}-{number:4}` | `PROCUREMENT` |
| `GOODS_RECEIPT` | Goods Receipt | `GR{yyyy}-{number:4}` | `PROCUREMENT` |
| `PURCHASE_INVOICE` | Purchase Invoice | `PI{yyyy}-{number:4}` | `PROCUREMENT` |
| `SUPPLIER_PAYMENT` | Supplier Payment | `SP{yyyy}-{number:4}` | `PROCUREMENT` |
| `CUSTOMER_INVOICE` | Customer Invoice | `INV{yyyy}-{number:4}` | `BILLING` |
| `APPOINTMENT` | Appointment | `APT{yyyy}-{number:4}` | `APPOINTMENT` |

Custom document types created by clinics default to `GENERAL` or can select a specific module during creation.

---

## Backend API Layer (`apps/api/src/modules/document-sequence`)

### 1. DTO Updates (`CreateDocumentTypeDto` & `UpdateDocumentTypeDto`)
- `CreateDocumentTypeDto`: add optional `@IsEnum(DocumentModule) module?: DocumentModule`.
- `UpdateDocumentTypeDto`: add optional `@IsEnum(DocumentModule) module?: DocumentModule`.

### 2. Service Layer (`DocumentTypeService`)
- `findAll(clinicId: string, module?: DocumentModule)`:
  - When `module` is specified, filter `where: { OR: [{ clinicId: null }, { clinicId }], isActive: true, module }`.
  - When omitted, fetch all active types for the clinic.

### 3. Controller Layer (`DocumentTypeController`)
- `GET /document-sequence/types`:
  - Accept optional `@Query('module') module?: DocumentModule`.
  - Pass `module` parameter to `DocumentTypeService.findAll(clinicId, module)`.

---

## Frontend Architecture (`apps/web`)

### 1. Shared UI Component (`apps/web/components/document-sequence/module-sequence-config.tsx`)

A standalone client component designed to be embedded directly into module-specific settings pages.

#### Component Props:
```tsx
export interface ModuleDocumentSequenceConfigProps {
  module: 'PROCUREMENT' | 'BILLING' | 'APPOINTMENT' | 'INVENTORY' | 'CLINICAL' | 'GENERAL';
  title?: string;
  description?: string;
  className?: string;
}
```

#### Component Functionality:
- Fetches document type definitions filtered by `module` (`apiClient.get('/document-sequence/types?module=' + module)`).
- Fetches active clinic configs (`apiClient.get('/document-sequence/configs')`).
- Displays a clean card layout of all document sequence rules for the specified module.
- Provides a live preview generator showing what generated document numbers look like (e.g. `PO2026-0001`).
- Includes edit modal for modifying prefix template, reset interval (`YEARLY`, `MONTHLY`, `DAILY`, `NEVER`), and scope (`CLINIC`, `BRANCH`).

### 2. Central Settings Page Redesign (`apps/web/app/(clinic)/clinic/settings/document-sequence/document-sequence-client.tsx`)

- **Tabbed Filtering Navigation**:
  - `Tabs` bar with options: `All`, `PROCUREMENT`, `BILLING`, `APPOINTMENT`, `INVENTORY`, `CLINICAL`, `CUSTOM`.
- **Module Overview Summary**:
  - Summary stats showing total rules per module.
- **Enhanced Table Layout**:
  - Badge tag showing assigned module for each document type.
  - Quick action buttons to override config or edit custom type definitions.

---

## Integration Plan across Modules

1. **Procurement Settings Page**:
   - Embed `<ModuleDocumentSequenceConfig module="PROCUREMENT" />` in Procurement settings tab.
2. **Billing & POS Settings Page**:
   - Embed `<ModuleDocumentSequenceConfig module="BILLING" />` in Billing settings page.
3. **Appointment Settings Page**:
   - Embed `<ModuleDocumentSequenceConfig module="APPOINTMENT" />` in Appointment settings page.

---

## Testing & Verification Plan

### Automated Tests:
- Prisma migration & seed script verification (`npx prisma db push` / `npx prisma db seed`).
- API Controller E2E & unit tests verifying `GET /document-sequence/types?module=PROCUREMENT` returns only procurement document types.

### Manual Verification:
- Open central `/clinic/settings/document-sequence` page and test module tab switching.
- Verify embedded component in Procurement settings allows updating PO prefix and reflects live changes.
