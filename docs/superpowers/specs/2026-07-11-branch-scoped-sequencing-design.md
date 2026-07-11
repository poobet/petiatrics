# System Specification: Branch-Scoped Document Sequencing Option

**Status**: Proposal
**Context**: Enhancing the Petiatrics document sequencing engine to support both Clinic-Wide (default) and Per-Branch (branch-scoped) sequential counters.

---

## 1. Objectives & Scope
Enable clinics to choose how document sequences (like Purchase Orders and Goods Receipts) are incremented:
- **Clinic-Wide (CLINIC)**: A single sequence counter is shared across all branches in a clinic (e.g. PO-2026-0001, PO-2026-0002).
- **Per-Branch (BRANCH)**: Each branch has its own independent sequence counter (e.g., Branch A gets PO-2026-0001, Branch B also gets PO-2026-0001).
- **{branchCode} Placeholder**: Allow templates to incorporate branch codes dynamically (e.g., `PO-{branchCode}-{yyyy}-{number:4}`).

---

## 2. Database Schema Changes

### 2.1 Enum `SequenceScope`
Define a new enum:
```prisma
enum SequenceScope {
  CLINIC
  BRANCH
}
```

### 2.2 Branch Model Extension
Add a `code` string column to `Branch` to support `{branchCode}` translation:
```prisma
model Branch {
  id        String   @id @default(uuid())
  clinicId  String
  name      String
  code      String   @default("") // E.g., "BKK", "HO", "CNX"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ...
}
```

### 2.3 Document Type & Sequence Config
Add `scope` of type `SequenceScope` to allow configuring/overriding scope at both the global type definition level and clinic-specific config levels:
```prisma
model DocumentTypeDefinition {
  ...
  scope                SequenceScope @default(CLINIC)
  ...
}

model DocumentSequenceConfig {
  ...
  scope                SequenceScope @default(CLINIC)
  ...
}
```

### 2.4 Document Sequence Counter
Update `DocumentSequence` to partition counters by branch when scope is `BRANCH`:
```prisma
model DocumentSequence {
  id            String        @id @default(uuid())
  clinicId      String
  branchId      String        @default("CLINIC") // Store Branch UUID or "CLINIC" for clinic-wide
  documentType  String
  period        String
  lastNumber    Int           @default(0)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@unique([clinicId, branchId, documentType, period]) // Compound unique index
  @@index([clinicId])
  @@map("document_sequences")
}
```

---

## 3. Logical Implementation

### 3.1 Service Layer: `DocumentSequenceService`
Modify the signature of the `generate` function to accept `branchId`:
```typescript
async generate(
  clinicId: string,
  documentType: string,
  date: Date = new Date(),
  branchId?: string
): Promise<string>
```

Logic:
1. Load `DocumentSequenceConfig` or `DocumentTypeDefinition` to resolve the active `scope` (`CLINIC` or `BRANCH`), `template`, and `resetInterval`.
2. Resolve `sequenceBranchId`:
   - If `scope === 'BRANCH'` and `branchId` is passed, `sequenceBranchId = branchId`.
   - Else, `sequenceBranchId = 'CLINIC'`.
3. Perform atomic upsert:
   ```typescript
   const sequence = await this.prisma.documentSequence.upsert({
     where: {
       clinicId_branchId_documentType_period: {
         clinicId,
         branchId: sequenceBranchId,
         documentType,
         period,
       },
     },
     create: { clinicId, branchId: sequenceBranchId, documentType, period, lastNumber: 1 },
     update: { lastNumber: { increment: 1 } },
   });
   ```
4. Resolve `{branchCode}` placeholder if present in template:
   - If `branchId` is passed, retrieve `Branch.code`.
   - Replace `{branchCode}` with the branch code (or empty string/fallback if undefined).

---

## 4. API Controllers
Modify controllers creating documents to extract the active branch using the existing `@ActiveBranch()` decorator and pass it to the services:

### 4.1 `PurchaseOrderController`
- Add `@UseGuards(BranchContextGuard)` to `Post()` endpoint.
- Add `@ActiveBranch() branchId: string` to create signature.
- Pass `branchId` to `PurchaseOrderService.create` -> `DocumentSequenceService.generate`.

### 4.2 `GoodsReceiptController`
- Add `@UseGuards(BranchContextGuard)` to `Post()` endpoint.
- Add `@ActiveBranch() branchId: string` to create signature.
- Pass `branchId` to `GoodsReceiptService.createAndCommit` -> `DocumentSequenceService.generate`.

---

## 5. UI Changes (`document-sequence-client.tsx`)
- Update interfaces to support the new `scope` field.
- Add "Scope" column to the sequence config table (values: `Clinic-Wide` or `Branch-Scoped`).
- Add "Scope" dropdown selection (options: `Clinic-Wide`, `Branch-Scoped`) inside the "Add Custom Type" sheet and the "Customize Sequencing Rules" dialog.
