# Data Model: Inventory & Stock Management (008)

**Date**: 2026-06-01
**Branch**: `008-inventory-management`

---

## Schema Changes (Prisma — packages/database/prisma/schema.prisma)

### Modified: `BranchStockBalance`

Add the following fields:

```prisma
model BranchStockBalance {
  id        String   @id @default(uuid())
  clinicId  String
  branchId  String
  productId String
  lotNumber String?                         // NEW: null = non-lot-tracked item
  expiryDate DateTime?                      // NEW: expiry for FEFO sorting
  quantity  Decimal  @default(0) @db.Decimal(10, 3)
  version   Int      @default(0)            // NEW: optimistic lock counter
  updatedAt DateTime @updatedAt             // NEW

  clinic    Clinic   @relation(...)
  branch    Branch   @relation(...)
  product   Product  @relation(...)

  // CHANGED: unique now includes lotNumber (null-lot uniqueness enforced via raw DB index)
  @@unique([clinicId, branchId, productId, lotNumber])
  @@index([clinicId, branchId])
  @@index([clinicId, productId])
}
```

**Migration note**: Existing rows get `lotNumber = NULL`, `version = 0`, `updatedAt = now()`. The old unique constraint `[clinicId, branchId, productId]` is dropped and replaced. A raw SQL partial unique index is added in the migration:
```sql
CREATE UNIQUE INDEX branch_stock_balance_null_lot_unique
  ON "BranchStockBalance" ("clinicId", "branchId", "productId")
  WHERE "lotNumber" IS NULL;
```

---

### Modified: `StockMovement`

Add the following fields:

```prisma
model StockMovement {
  // ... existing fields unchanged ...
  lotNumber      String?                      // NEW
  expiryDate     DateTime?                    // NEW
  overrideReason String?                      // NEW: populated on FEFO/expiry override
  approverId     String?                      // NEW: populated when adjustment approved
  status         StockMovementStatus @default(COMMITTED)  // NEW

  approver       User?   @relation("StockMovementApprover", fields: [approverId], references: [id])
}
```

---

### New Enum: `StockMovementStatus`

```prisma
enum StockMovementStatus {
  COMMITTED
  PENDING_APPROVAL
  REJECTED
}
```

---

### Extended Enum: `StockMovementReason`

```prisma
enum StockMovementReason {
  DISPENSE           // existing — used by clinical module
  REPLENISH          // existing — used by clinical module
  MANUAL_ADJUSTMENT  // existing — retained
  GOODS_RECEIPT      // NEW: explicit goods receipt from supplier
  GOODS_ISSUE        // NEW: explicit goods issue (dispensing, retail, clinical use)
}
```

---

### New Model: `StockAlert`

```prisma
model StockAlert {
  id          String    @id @default(uuid())
  clinicId    String
  branchId    String
  productId   String
  alertType   StockAlertType @default(LOW_STOCK)
  isActive    Boolean   @default(true)
  triggeredAt DateTime  @default(now())
  resolvedAt  DateTime?

  clinic   Clinic   @relation(...)
  branch   Branch   @relation(...)
  product  Product  @relation(...)

  @@unique([clinicId, branchId, productId, alertType])
  @@index([clinicId, isActive])
}

enum StockAlertType {
  LOW_STOCK
}
```

---

## Entity Relationships

```
Clinic
  ├── Branch (1:N)
  │     └── BranchStockBalance (1:N per product/lot)
  └── Product (1:N)
        ├── BranchStockBalance (1:N)
        ├── StockMovement (1:N)
        └── StockAlert (1:N)

StockMovement
  ├── actorId   → User (who performed the action)
  └── approverId → User (who approved ADJUSTMENT, nullable)

BranchStockBalance
  ├── (clinicId, branchId, productId, lotNumber) unique
  └── version — incremented on every write (optimistic lock)
```

---

## State Machine: StockMovement.status

```
[GOODS_RECEIPT / GOODS_ISSUE]
  → created with status = COMMITTED immediately

[MANUAL_ADJUSTMENT submitted by Manager]
  → created with status = PENDING_APPROVAL

[PENDING_APPROVAL] → approve → COMMITTED (balance updated)
[PENDING_APPROVAL] → reject  → REJECTED  (balance unchanged)
```

---

## Validation Rules

| Rule | Enforced at |
|---|---|
| `quantity >= 0` on BranchStockBalance | Service layer + DB check constraint |
| `quantityChange > 0` for RECEIPT | DTO validation (class-validator) |
| `quantityChange < 0` for ISSUE | DTO validation |
| `lotNumber` required if `requiresBatchAndExpiryTracking = true` | Service layer on RECEIPT |
| `expiryDate` required if `requiresBatchAndExpiryTracking = true` | Service layer on RECEIPT |
| `overrideReason` required if issuing non-FEFO or expired lot | Service layer |
| `status = PENDING_APPROVAL` only for MANUAL_ADJUSTMENT reason | Service layer |
| Negative stock hard block | Service: check balance before deduct; optimistic lock in transaction |
