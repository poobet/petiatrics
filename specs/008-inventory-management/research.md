# Research: Inventory & Stock Management (008)

**Date**: 2026-06-01
**Branch**: `008-inventory-management`

---

## Summary of Findings

All NEEDS CLARIFICATION items from Technical Context are resolved below. Key discovery: the `InventoryModule`, `StockController`, and `StockService` already exist. This feature is an **extension** of existing infrastructure, not a greenfield build.

---

## Decision Log

### D-001: Schema Evolution — BranchStockBalance

**Context**: Existing `BranchStockBalance` model has unique key `[clinicId, branchId, productId]` with no lot/expiry support. Spec requires per-lot balance rows.

**Decision**: Add `lotNumber (String?)` and `expiryDate (DateTime?)` to `BranchStockBalance`. Change unique constraint to `[clinicId, branchId, productId, lotNumber]` and enforce the null-lot partial uniqueness at the application layer (Prisma does not natively support partial unique indexes; enforce with a DB migration raw SQL index). Add `version Int @default(0)` for optimistic locking. Add `updatedAt DateTime @updatedAt`.

**Rationale**: Minimal schema change that preserves backward compatibility. Existing non-lot rows get `lotNumber = null`, satisfying the partial uniqueness requirement. The `version` field powers optimistic lock checks in the service layer.

**Alternatives considered**: Separate `LotBatch` table — rejected because it adds unnecessary join complexity for simple quantity tracking.

---

### D-002: Schema Evolution — StockMovement

**Context**: Existing `StockMovement` has `reason: StockMovementReason` (DISPENSE | REPLENISH | MANUAL_ADJUSTMENT) and `referenceType: StockMovementRefType`. No lot fields, no adjustment approval status, no override reason.

**Decision**: Add fields: `lotNumber (String?)`, `expiryDate (DateTime?)`, `overrideReason (String?)`, `approverId (String?)`, `status StockMovementStatus @default(COMMITTED)`. Add new enum `StockMovementStatus { COMMITTED PENDING_APPROVAL REJECTED }`. Extend `StockMovementReason` with `GOODS_RECEIPT` and `GOODS_ISSUE` (keeping existing values for backward compat with clinical module's DISPENSE/REPLENISH usage).

**Rationale**: Backward-compatible enum extension. Existing clinical workflows use DISPENSE/REPLENISH; new inventory flows use GOODS_RECEIPT/GOODS_ISSUE/MANUAL_ADJUSTMENT. The `status` field enables the two-step adjustment approval workflow without a separate table.

**Alternatives considered**: Separate `StockAdjustmentRequest` table — rejected per constitution Principle VII (simplicity over speculative abstraction); the `status` field on `StockMovement` is sufficient.

---

### D-003: FEFO Logic Placement

**Decision**: FEFO pre-selection is a service-layer concern (API), not a database concern. `StockService.getIssuableLots()` returns lots ordered by `expiryDate ASC, lotNumber ASC`. The first entry is the FEFO lot. Frontend receives the ordered list and highlights the first; the client sends the chosen `lotNumber`. If the chosen lot differs from the FEFO lot, the server records `overrideReason` in the audit log — it does not re-enforce FEFO server-side (this is a soft warning, per clarification Q2).

**Rationale**: Server-side FEFO ordering with client-side warning. Avoids complex server enforcement logic while preserving full audit trail.

---

### D-004: Optimistic Locking for Negative-Stock Prevention

**Decision**: Use Prisma's `update` with `where: { id, version }` pattern. If the update affects 0 rows (version mismatch), throw `ConflictException`. Service wraps `BranchStockBalance` upsert and deduct in a Prisma transaction with the version check. Quantity constraint `>= 0` enforced at service layer before the transaction, with the DB-level `@db.Decimal(10,3)` as a backup.

**Rationale**: Optimistic locking with version counter is idiomatic for low-contention stock operations. Avoids pessimistic DB row locks.

---

### D-005: Low Stock Alert Persistence

**Context**: Existing `LowStockListener` only logs a warning. Spec requires in-app dashboard banner + notification bell.

**Decision**: Add a `StockAlert` model (Postgres) with fields `id, clinicId, branchId, productId, alertType (LOW_STOCK), isActive, triggeredAt, resolvedAt?`. The `LowStockListener` upserts a `StockAlert` row on `stock.low_stock_warning`. A new `GET /inventory/alerts/low-stock` endpoint reads active alerts. When stock rises above reorder point on RECEIPT, the service calls `resolveAlerts()` to set `isActive = false`. Frontend polls or uses server-sent events — for this phase, polling every 30 seconds is sufficient.

**Rationale**: Lightweight persistence model. No separate notification service required. Defers real-time push to a later phase.

---

### D-006: Existing StockController Compatibility

**Context**: `StockController` and `StockService` already exist with `replenish()` and `deduct()`. These are used by the clinical/billing modules for dispensing.

**Decision**: Do NOT replace existing methods. Add new dedicated methods to `StockService`: `goodsReceipt()`, `goodsIssue()`, `submitAdjustment()`, `approveAdjustment()`, `rejectAdjustment()`. The existing `deduct()` and `replenish()` used by clinical remain unchanged. Add new routes under the existing `StockController` (or a new `StockMovementController`) with clear naming separation.

**Rationale**: Backward compatibility with clinical module (Constitution Principle I — domain boundaries). The clinical module's DISPENSE flow must not be disrupted.

---

### D-007: Role Enforcement

**Decision**: Use the existing `@Roles()` guard and `RolesGuard`. Map spec roles to existing system roles. Staff = `STAFF`; Manager = `MANAGER`; Admin = `ADMIN`. These already exist in the `Role` enum in Prisma schema. No new role infrastructure needed (confirmed by Assumption in spec).

---

### D-008: i18n

**Decision**: All new UI strings must be added to both `messages/en.json` and `messages/th.json` under a new `inventory.stock` namespace. Per Constitution Principle V, bilingual delivery is mandatory.

---

## Technology Stack (Confirmed)

| Concern | Technology |
|---|---|
| Language | TypeScript (strict) |
| Backend | NestJS (apps/api) |
| Frontend | Next.js 14 App Router (apps/web) |
| ORM | Prisma (packages/database) |
| DB | PostgreSQL (transactional stock data) |
| Events | NestJS EventEmitter2 |
| Auth/Session | Existing session + RolesGuard |
| Testing | Jest + ts-jest (*.spec.ts), Playwright (E2E) |
| UI | shadcn/ui components, Tailwind CSS |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Prisma unique constraint on nullable `lotNumber` | Medium | High | Use raw SQL partial unique index in migration |
| Clinical module disrupted by StockMovement schema change | Low | High | Add fields as nullable; existing code paths unaffected |
| Concurrent RECEIPT + ISSUE race on same lot | Medium | High | Optimistic lock with version counter; retry UX guidance |
| FEFO override bypass (staff submits without overrideReason) | Low | Medium | Server-side validation: if chosen lot ≠ FEFO lot, overrideReason required |
