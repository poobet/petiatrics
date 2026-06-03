---
description: "Task list for 008-inventory-management"
---

# Tasks: Inventory & Stock Management (008)

**Branch**: `008-inventory-management`
**Input**: `specs/008-inventory-management/`
**Generated**: 2026-06-01

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US5)
- All paths are relative to workspace root `d:\Deaw\petiatrics`

---

## Phase 1: Schema & Migration (Foundation)

**Purpose**: Extend the Prisma schema with lot-tracking fields, optimistic locking, and the new `StockAlert` model. All user story work is blocked until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add `lotNumber`, `expiryDate`, `version`, `updatedAt` fields to `BranchStockBalance` model in `packages/database/prisma/schema.prisma`
- [X] T002 Replace unique constraint on `BranchStockBalance` from `[clinicId, branchId, productId]` to `[clinicId, branchId, productId, lotNumber]` in `packages/database/prisma/schema.prisma`
- [X] T003 Add `lotNumber`, `expiryDate`, `overrideReason`, `approverId`, `status` fields to `StockMovement` model in `packages/database/prisma/schema.prisma`
- [X] T004 Add new enum `StockMovementStatus { COMMITTED PENDING_APPROVAL REJECTED }` to `packages/database/prisma/schema.prisma`
- [X] T005 Extend `StockMovementReason` enum with `GOODS_RECEIPT` and `GOODS_ISSUE` values in `packages/database/prisma/schema.prisma`
- [X] T006 Add new `StockAlert` model and `StockAlertType { LOW_STOCK }` enum to `packages/database/prisma/schema.prisma`
- [X] T007 Run `prisma migrate dev --name inventory_lot_tracking` and add raw SQL partial unique index for null-lot rows in the generated migration file under `packages/database/prisma/migrations/`
- [X] T008 Verify existing `StockService` unit tests (`apps/api/src/modules/inventory/stock.service.spec.ts`) still pass after schema migration (backward compat check)

**Checkpoint**: Schema ready — all user story phases can now begin.

---

## Phase 2: Foundational API Infrastructure (Blocking for US1–US5)

**Purpose**: Shared DTOs, base service extensions, and controller scaffolding needed before any user story endpoint can be implemented.

- [X] T009 Create `GoodsReceiptDto` with class-validator decorators in `apps/api/src/modules/inventory/dto/goods-receipt.dto.ts`
- [X] T010 [P] Create `GoodsIssueDto` with class-validator decorators in `apps/api/src/modules/inventory/dto/goods-issue.dto.ts`
- [X] T011 [P] Create `ListStockBalancesDto` (pagination + branch filter) in `apps/api/src/modules/inventory/dto/list-stock-balances.dto.ts`
- [X] T012 [P] Create `SubmitAdjustmentDto` in `apps/api/src/modules/inventory/dto/submit-adjustment.dto.ts`
- [X] T013 [P] Create `ApproveAdjustmentDto` and `RejectAdjustmentDto` in `apps/api/src/modules/inventory/dto/approve-adjustment.dto.ts` and `apps/api/src/modules/inventory/dto/reject-adjustment.dto.ts`
- [X] T014 Create `StockAlertService` skeleton with `upsertAlert()`, `resolveAlert()`, `listActive()` stubs in `apps/api/src/modules/inventory/services/stock-alert.service.ts`
- [X] T015 Register `StockAlertService` in `apps/api/src/modules/inventory/inventory.module.ts`

**Checkpoint**: Infrastructure ready — user story phases can now proceed.

---

## Phase 3: User Story 1 — Receive Stock at a Branch (Priority: P1) 🎯 MVP

**Goal**: Staff can record a Goods Receipt, incrementing the branch stock balance. Lot/Expiry fields are required when the item category mandates compliance tracking.

**Independent Test**: Staff opens the Goods Receipt form, selects an item, enters quantity (and lot/expiry if required), saves, and immediately sees the updated balance on the Stock Ledger page.

### API

- [X] T016 [US1] Implement `goodsReceipt()` method in `apps/api/src/modules/inventory/services/stock.service.ts`: validate product belongs to clinic; enforce lot/expiry fields when `requiresBatchAndExpiryTracking`; upsert `BranchStockBalance` with version increment; write immutable `StockMovement` (COMMITTED, GOODS_RECEIPT); emit `stock.low_stock_warning` if applicable
- [X] T017 [US1] Add `GET /inventory/stock-balances` endpoint (paginated, branch-filtered) to `apps/api/src/modules/inventory/controllers/stock.controller.ts`
- [X] T018 [P] [US1] Add `POST /inventory/stock-movements` endpoint (type=GOODS_RECEIPT) to `apps/api/src/modules/inventory/controllers/stock.controller.ts`
- [X] T019 [P] [US1] Write unit tests for `goodsReceipt()` covering: standard receipt, compliance field validation, lot-row creation, duplicate lot upsert in `apps/api/src/modules/inventory/stock.service.spec.ts`

### Frontend

- [X] T020 [US1] Create Stock Ledger page at `apps/web/app/(clinic)/clinic/inventory/stock-ledger/page.tsx` with server component shell and `StockLedgerTable` import
- [X] T021 [P] [US1] Create `StockLedgerTable` component with data grid (item name, lot, expiry, quantity, status badge, reorder indicator) in `apps/web/components/inventory/stock-ledger-table.tsx`
- [X] T022 [P] [US1] Create Goods Receipt page at `apps/web/app/(clinic)/clinic/inventory/receipt/page.tsx`
- [X] T023 [P] [US1] Create `GoodsReceiptForm` component with item search, quantity field, conditional lot/expiry fields (gated on `requiresBatchAndExpiryTracking`), and blocking validation in `apps/web/components/inventory/goods-receipt-form.tsx`
- [X] T024 [P] [US1] Add `inventory.stock.receipt.*` i18n keys to `apps/web/messages/en.json` and `apps/web/messages/th.json`

---

## Phase 4: User Story 2 — Issue Stock from a Branch (Priority: P1)

**Goal**: Staff can issue stock from a branch. FEFO lot is pre-selected for perishables. Overriding FEFO requires a mandatory reason. Negative stock is hard-blocked via optimistic locking.

**Independent Test**: Staff opens Goods Issue form, selects item, sees FEFO pre-selection, issues stock. System deducts balance and blocks if insufficient.

### API

- [X] T025 [US2] Implement `getIssuableLots()` method in `apps/api/src/modules/inventory/services/stock.service.ts`: query `BranchStockBalance` for product/branch ordered by `expiryDate ASC NULLS LAST, lotNumber ASC`; return `isFefo`, `isExpired`, `quantity` flags
- [X] T026 [US2] Implement `goodsIssue()` method in `apps/api/src/modules/inventory/services/stock.service.ts`: validate sufficient stock; require `overrideReason` if chosen lot ≠ FEFO lot or lot is expired; decrement balance via optimistic lock (`where: { id, version }`); throw `ConflictException` on version mismatch or negative result; write immutable ISSUE movement; emit `stock.low_stock_warning` if balance ≤ reorderPoint
- [X] T027 [P] [US2] Add `GET /inventory/stock-balances/lots/:productId` endpoint (FEFO-ordered) to `apps/api/src/modules/inventory/controllers/stock.controller.ts`
- [X] T028 [P] [US2] Add `POST /inventory/stock-movements` (type=GOODS_ISSUE) routing to `goodsIssue()` in `apps/api/src/modules/inventory/controllers/stock.controller.ts`
- [X] T029 [P] [US2] Write unit tests for `goodsIssue()` covering: standard issue, FEFO override enforcement, expired lot override, negative stock hard-block, optimistic lock conflict (409) in `apps/api/src/modules/inventory/stock.service.spec.ts`

### Frontend

- [X] T030 [US2] Create Goods Issue page at `apps/web/app/(clinic)/clinic/inventory/issue/page.tsx`
- [X] T031 [P] [US2] Create `GoodsIssueForm` component with item search, `GoodsIssueLotSelector` (populated from `GET /inventory/stock-balances/lots/:productId`, first lot badged "FEFO Recommended"), and 409 inline error handling in `apps/web/components/inventory/goods-issue-form.tsx`
- [X] T032 [P] [US2] Create `FefoOverrideDialog` modal component (triggers when non-FEFO or expired lot selected; requires override reason text; blocks save until reason entered) in `apps/web/components/inventory/fefo-override-dialog.tsx`
- [X] T033 [P] [US2] Add `inventory.stock.issue.*` and `inventory.stock.fefo.*` i18n keys to `apps/web/messages/en.json` and `apps/web/messages/th.json`

---

## Phase 5: User Story 3 — Stock Adjustment (Priority: P2)

**Goal**: Manager submits a stock adjustment (pending approval). Manager approves or rejects. Balance updates only on approval. Staff cannot access adjustments.

**Independent Test**: Manager submits adjustment → appears as pending. Manager approves → balance updates. Staff gets 403 on adjustment routes.

### API

- [X] T034 [US3] Implement `StockAdjustmentService` with `submitAdjustment()` (writes PENDING_APPROVAL movement; does not update balance), `approveAdjustment()` (transaction: update balance + write COMMITTED movement with `approverId`), `rejectAdjustment()` (set REJECTED + store rejection reason) in `apps/api/src/modules/inventory/services/stock-adjustment.service.ts`
- [X] T035 [P] [US3] Create `StockAdjustmentController` with `POST /inventory/stock-adjustments`, `PATCH /inventory/stock-adjustments/:id/approve`, `PATCH /inventory/stock-adjustments/:id/reject` — all guarded with `@Roles(MANAGER, ADMIN)` in `apps/api/src/modules/inventory/controllers/stock-adjustment.controller.ts`
- [X] T036 [P] [US3] Register `StockAdjustmentService` and `StockAdjustmentController` in `apps/api/src/modules/inventory/inventory.module.ts`
- [X] T037 [P] [US3] Write unit tests for `StockAdjustmentService` covering: submit creates pending movement, approve updates balance and sets approverId, reject leaves balance unchanged, Staff role returns 403 in `apps/api/src/modules/inventory/stock-adjustment.service.spec.ts`

### Frontend

- [X] T038 [US3] Create Pending Adjustments list page at `apps/web/app/(clinic)/clinic/inventory/adjustments/page.tsx` (Manager-only, shows pending adjustments with approve/reject buttons)
- [X] T039 [P] [US3] Create `PendingAdjustmentsTable` component with confirm dialogs for approve/reject in `apps/web/components/inventory/pending-adjustments-table.tsx`
- [X] T040 [P] [US3] Create Submit Adjustment page at `apps/web/app/(clinic)/clinic/inventory/adjustments/new/page.tsx`
- [X] T041 [P] [US3] Create `StockAdjustmentForm` component with item search, current balance display, new physical count input, variance preview in `apps/web/components/inventory/stock-adjustment-form.tsx`
- [X] T042 [P] [US3] Add `inventory.stock.adjustment.*` i18n keys to `apps/web/messages/en.json` and `apps/web/messages/th.json`

---

## Phase 6: User Story 4 — Stock Ledger View & Branch Filter (Priority: P2)

**Goal**: Staff see stock for their branch only. Managers can switch branch filter or view aggregated clinic-wide stock. Lot rows appear per lot. Low stock indicator visible on rows at/below reorderPoint.

**Independent Test**: Navigate to `/inventory/stock-ledger`, see data grid filtered by branch. Manager toggles branch filter.

### API

- [X] T043 [US4] Extend `GET /inventory/stock-balances` in `apps/api/src/modules/inventory/controllers/stock.controller.ts` to enforce branch-scoping for Staff (session branch only) vs Manager (all clinic branches + aggregate) per role
- [X] T044 [P] [US4] Add `GET /inventory/stock-movements` audit log endpoint (paginated, filtered by product/branch/date) to `apps/api/src/modules/inventory/controllers/stock.controller.ts`

### Frontend

- [X] T045 [US4] Add branch filter dropdown to `StockLedgerTable` (Staff sees own branch locked; Manager sees branch selector + "All Branches" option) in `apps/web/components/inventory/stock-ledger-table.tsx`
- [X] T046 [P] [US4] Add Low Stock row indicator (amber badge) when `quantity <= reorderPoint` to `StockLedgerTable` in `apps/web/components/inventory/stock-ledger-table.tsx`
- [X] T047 [P] [US4] Add lot-per-row rendering (each `BranchStockBalance` lot row shown separately with lot number and expiry date columns) to `StockLedgerTable` in `apps/web/components/inventory/stock-ledger-table.tsx`
- [X] T048 [P] [US4] Add slide-over panel showing paginated movement history for a selected item/lot in `apps/web/components/inventory/stock-ledger-table.tsx`
- [X] T049 [P] [US4] Add navigation links ("New Receipt", "New Issue", "Adjust Stock" buttons) to `apps/web/app/(clinic)/clinic/inventory/stock-ledger/page.tsx`
- [X] T050 [P] [US4] Add `inventory.stock.ledger.*` i18n keys to `apps/web/messages/en.json` and `apps/web/messages/th.json`

---

## Phase 7: User Story 5 — Low Stock Alerts (Priority: P3)

**Goal**: After a Goods Issue reduces balance to/below `reorderPoint`, an in-app alert appears in the dashboard banner and notification bell. Alert shows item, quantity, reorder point, and supplier name. Alert auto-resolves when stock is replenished above reorderPoint.

**Independent Test**: Configure item with low reorderPoint, issue stock past the threshold, and see alert banner appear without page refresh within 5 seconds (30s poll interval). Replenish and see alert dismissed.

### API

- [X] T051 [US5] Implement `StockAlertService.upsertAlert()` and `resolveAlert()` fully in `apps/api/src/modules/inventory/services/stock-alert.service.ts`: `upsertAlert()` creates or reactivates `StockAlert` row; `resolveAlert()` sets `isActive = false` and `resolvedAt = now()`
- [X] T052 [P] [US5] Implement `StockAlertService.listActive()`: query active `StockAlert` rows for clinicId/branchId; join product name and `defaultSupplierId` supplier name in `apps/api/src/modules/inventory/services/stock-alert.service.ts`
- [X] T053 [P] [US5] Modify `LowStockListener` to call `StockAlertService.upsertAlert()` on `stock.low_stock_warning` event in `apps/api/src/modules/inventory/listeners/low-stock.listener.ts`
- [X] T054 [P] [US5] Call `StockAlertService.resolveAlert()` from `StockService.goodsReceipt()` when replenished balance exceeds `reorderPoint` in `apps/api/src/modules/inventory/services/stock.service.ts`
- [X] T055 [P] [US5] Create `StockAlertController` with `GET /inventory/alerts/low-stock` in `apps/api/src/modules/inventory/controllers/stock-alert.controller.ts`
- [X] T056 [P] [US5] Register `StockAlertController` in `apps/api/src/modules/inventory/inventory.module.ts`

### Frontend

- [X] T057 [US5] Create `LowStockBanner` component that polls `GET /inventory/alerts/low-stock` every 30 seconds and renders an amber dismissable strip with item name, quantity, reorder point, and supplier name in `apps/web/components/inventory/low-stock-banner.tsx`
- [X] T058 [P] [US5] Mount `LowStockBanner` on the main inventory layout page (`apps/web/app/(clinic)/clinic/inventory/page.tsx`)
- [X] T059 [P] [US5] Increment notification bell badge count from `LowStockBanner` alert count (wire to existing notification bell in app shell)
- [X] T060 [P] [US5] Add `inventory.stock.alerts.*` i18n keys to `apps/web/messages/en.json` and `apps/web/messages/th.json`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: E2E tests, missing i18n keys audit, and any cleanup.

- [X] T061 [P] Write Playwright E2E test: Goods Receipt happy path (non-lot-tracked item) in `apps/web/test/inventory-receipt.spec.ts`
- [X] T062 [P] Write Playwright E2E test: Goods Issue with FEFO deviation (override dialog) in `apps/web/test/inventory-issue-fefo.spec.ts`
- [X] T063 [P] Write Playwright E2E test: Low Stock alert appears after issue reduces balance to reorderPoint in `apps/web/test/inventory-low-stock-alert.spec.ts`
- [X] T064 [P] Audit all `inventory.stock.*` keys for EN/TH completeness and fill any gaps in `apps/web/messages/en.json` and `apps/web/messages/th.json`
- [X] T065 [P] Add `@Audit()` decorator to all mutation endpoints in `StockController`, `StockAdjustmentController` per constitution Principle III

---

## Dependency Graph

```
Phase 1 (Schema) ──────────────────────────────────────────── ALL phases blocked until complete
       │
Phase 2 (Foundation DTOs/Services) ───────────────────────── All API phases blocked until complete
       │
       ├── Phase 3 (US1: Receipt)  ──────────────────────── MVP ✅
       │         └── Phase 4 (US2: Issue) ◄─── depends on US1 balance data
       │                   └── Phase 7 (US5: Alerts) ◄─── depends on US2 stock.low_stock_warning
       │
       ├── Phase 5 (US3: Adjustments) ◄─── independent after Phase 2
       │
       └── Phase 6 (US4: Ledger View) ◄─── depends on Phase 3 + Phase 4 data
```

**US1 and US3 can be implemented in parallel after Phase 2.**
**US4 frontend depends on US1 + US2 API data.**
**US5 depends on US2 (Goods Issue triggers low stock events).**

---

## Parallel Execution Examples

### Sprint Day 1 (after Phase 1 complete)
| Developer A | Developer B |
|---|---|
| T009–T016 (GoodsReceipt DTO + service) | T009, T012–T013 (Adjustment DTOs) |

### Sprint Day 2
| Developer A | Developer B |
|---|---|
| T017–T019 (Receipt endpoints + tests) | T020–T024 (Receipt frontend) |

### Sprint Day 3
| Developer A | Developer B |
|---|---|
| T025–T029 (Issue service + tests) | T034–T037 (Adjustment service + tests) |

### Sprint Day 4
| Developer A | Developer B |
|---|---|
| T030–T033 (Issue frontend) | T038–T042 (Adjustment frontend) |

---

## Implementation Strategy

**MVP (Deliver First)**: Phase 1 + Phase 2 + Phase 3 (US1) — Schema, DTOs, Goods Receipt API, Stock Ledger page. This alone gives a working, testable vertical slice.

**Phase 2 of Delivery**: Phase 4 (US2: Goods Issue) — highest-frequency daily operation; high value after Receipt is working.

**Phase 3 of Delivery**: Phase 5 (US3) + Phase 6 (US4) — Adjustments and full Ledger filtering.

**Phase 4 of Delivery**: Phase 7 (US5: Alerts) + Phase 8 (Polish).

---

## Summary

| Metric | Count |
|---|---|
| Total tasks | 65 |
| Phase 1 (Schema) | 8 |
| Phase 2 (Foundation) | 7 |
| US1 (Receipt) | 9 |
| US2 (Issue) | 9 |
| US3 (Adjustments) | 9 |
| US4 (Ledger) | 8 |
| US5 (Alerts) | 10 |
| Polish | 5 |
| Parallelizable tasks [P] | 38 |
| User stories | 5 |
| MVP scope | Phase 1 + 2 + 3 (US1) |
