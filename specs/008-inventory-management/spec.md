# Feature Specification: Inventory & Stock Management

**Feature Branch**: `008-inventory-management`
**Created**: 2026-06-01
**Status**: Draft
**Source Document**: `documents/6-inventory-management.md`

> **Context**: Building upon the `006-item-master` foundation, this phase transitions the system from static catalog data to dynamic, transactional stock tracking. It introduces branch-level stock ledgers, movement transactions, medical compliance enforcement (Lot/Expiry), and procurement reorder alerts.

---

## User Scenarios & Testing

### User Story 1 — Receive Stock at a Branch (Priority: P1)

A clinic staff member receives a physical delivery of goods from a supplier and records it in the system to update stock levels.

**Why this priority**: Stock receipt is the entry point for all inventory. Without it, the ledger cannot be populated and no other workflow functions.

**Independent Test**: Staff can open a Goods Receipt form, search for an item, enter a quantity (and optionally a lot number and expiry date), save the transaction, and immediately see the updated balance on the Stock Ledger. This is independently testable with no other workflows required.

**Acceptance Scenarios**:

1. **Given** staff is on the Goods Receipt form, **When** they select an item that does not require batch/expiry tracking and enter a quantity, **Then** the system saves the transaction and increments the branch stock balance by the entered quantity.
2. **Given** staff selects an item whose category has `defaultRequiresBatchTracking = true` or `defaultRequiresExpiryTracking = true`, **When** they attempt to save without entering the Lot Number and/or Expiry Date, **Then** the system blocks the save and displays a clear validation error indicating which fields are mandatory.
3. **Given** a valid Goods Receipt is saved, **Then** an immutable audit log entry is created recording the actor, timestamp, item, quantity, branch, and movement type (RECEIPT).
4. **Given** a valid Goods Receipt with a lot number is saved, **Then** the `StockBalance` row for `(branchId, productId, lotNumber)` is created or incremented accordingly.

---

### User Story 2 — Issue Stock from a Branch (Priority: P1)

A clinic staff member dispenses medicine, supplies a clinical procedure, or fulfills a retail sale, deducting quantity from the branch stock.

**Why this priority**: Goods Issue is the highest-frequency daily operation; it is the complement to Goods Receipt and must be implemented alongside it.

**Independent Test**: Staff can open a Goods Issue form, select an item, enter a quantity, and save. The system deducts from the balance. Testable independently of adjustments, transfers, or alerts.

**Acceptance Scenarios**:

1. **Given** sufficient stock exists, **When** staff submits a Goods Issue for a non-lot-tracked item, **Then** the system deducts the quantity and records an immutable ISSUE audit log entry.
2. **Given** a perishable (lot-tracked) item with multiple lots in stock, **When** staff opens the Goods Issue form, **Then** the system pre-selects the lot with the earliest expiry date (FEFO) and displays the lot expiry date prominently.
3. **Given** staff selects a lot other than the FEFO-recommended lot, **When** they attempt to save, **Then** the system displays a warning and requires a mandatory override reason before the transaction can be completed. The override reason is stored in the audit log.
4. **Given** staff attempts to issue a quantity greater than the available stock balance, **Then** the system hard-blocks the transaction and displays an "Insufficient stock" error. The balance is never allowed to go negative.
5. **Given** two staff simultaneously attempt to issue the last available unit of the same item, **Then** the second request is rejected via optimistic locking with an "Insufficient stock" error.

---

### User Story 3 — Perform a Stock Adjustment (Priority: P2)

A manager reconciles the physical count of items on a shelf against the system balance, correcting discrepancies.

**Why this priority**: Required for compliance and accuracy, but only meaningful after the ledger has been populated via Receipts and Issues.

**Independent Test**: A Manager role user can submit a Stock Adjustment form, which creates a pending adjustment entry. A Manager approves it, and the stock balance updates. Testable without involving procurement alerts or lot compliance.

**Acceptance Scenarios**:

1. **Given** a Manager submits a Stock Adjustment with a new physical count, **Then** the system creates a pending ADJUSTMENT transaction and does not immediately update the balance.
2. **Given** a pending Adjustment exists, **When** a Manager approves it, **Then** the system updates the `StockBalance` to reflect the corrected quantity and records an immutable ADJUSTMENT audit log entry with both the approver and the original submitter.
3. **Given** a Manager rejects a pending Adjustment, **Then** the balance remains unchanged and a rejection reason is recorded in the audit log.
4. **Given** a Staff-role user attempts to access the Stock Adjustment form, **Then** the system denies access with a permission error.

---

### User Story 4 — View Stock Ledger and Filter by Branch (Priority: P2)

A staff member or manager views current stock levels across the clinic or scoped to their branch.

**Why this priority**: Visibility is prerequisite to any action (issuing, adjusting, identifying low stock). Implemented after the core transactions.

**Independent Test**: A user navigates to the Stock Ledger page, sees a data grid of items with quantities, and can filter by branch. Testable with read-only data.

**Acceptance Scenarios**:

1. **Given** a Staff user is on the Stock Ledger, **Then** they see stock levels only for their authorized branch.
2. **Given** a Manager is on the Stock Ledger, **Then** they can switch a branch filter to view any branch under their clinic, as well as an aggregated clinic-wide view.
3. **Given** the ledger contains lot-tracked items, **Then** each lot appears as a separate row with its lot number, expiry date, and quantity displayed.
4. **Given** an item's total stock is at or below its `reorderPoint`, **Then** a "Low Stock" indicator is visible on that item's row in the ledger.

---

### User Story 5 — Receive and Act on Low Stock Alerts (Priority: P3)

A manager sees an in-app notification that a specific item has fallen to or below its reorder point and can identify the preferred supplier.

**Why this priority**: Alerts depend on stock balances being populated and reorder points configured in Item Master. Lower priority as it is a monitoring capability, not a transactional one.

**Independent Test**: After a Goods Issue reduces a balance to the reorder point, an in-app banner appears on the dashboard and a notification bell count increases. Testable by configuring a low reorder point and issuing stock.

**Acceptance Scenarios**:

1. **Given** a Goods Issue causes a stock balance to fall at or below the item's `reorderPoint`, **Then** a Low Stock alert is surfaced in the dashboard banner and notification bell within 5 seconds, without requiring a page refresh.
2. **Given** a Low Stock alert is displayed, **Then** it shows the item name, current quantity, reorder point, and the preferred supplier name linked from `defaultSupplierId`.
3. **Given** stock is replenished above the `reorderPoint` via a Goods Receipt, **Then** the Low Stock alert for that item is dismissed automatically.

---

### Edge Cases

- What happens when a lot's `expiryDate` is in the past at time of Goods Issue? → System flags the lot as "Expired" and requires an explicit override reason if staff attempts to issue from it.
- What if two lots for the same item have identical expiry dates? → FEFO pre-selects either; staff may choose between them without triggering an override warning.
- What if an item's `reorderPoint` is `null` or `0` in Item Master? → The system skips Low Stock evaluation for that item; no alert is generated.
- What if a Goods Receipt is submitted for a quantity of zero? → The system validates that quantity must be greater than zero; the transaction is blocked.
- What if a `StockBalance` row does not yet exist for a new item/branch/lot combination on first receipt? → The system creates the row and sets quantity to the received amount.
- What if a Manager rejects a pending Stock Adjustment? → The adjustment is cancelled, the balance remains unchanged, and a rejection reason is recorded in the audit log.

---

## Requirements

### Functional Requirements

#### 2.1 Branch-Level Stock Balance

- **FR-001**: The system MUST maintain real-time stock balances separated by `branchId` within the broader `clinicId` scope.
- **FR-002**: Stock balances MUST only be modified via validated `StockMovement` transactions. Direct editing of balance records is not permitted for any role.
- **FR-003**: The system MUST provide an aggregated clinic-wide stock view and allow filtering to a specific authorized branch.

#### 2.2 Stock Transactions (Movements)

- **FR-004**: The system MUST support **Goods Receipt (RECEIPT)**: creating a positive `StockMovement` and incrementing the corresponding `StockBalance`.
- **FR-005**: The system MUST support **Goods Issue (ISSUE)**: creating a negative `StockMovement` and decrementing the `StockBalance`. Any issue that would result in a negative balance MUST be hard-blocked with an "Insufficient stock" error. Concurrent conflicting requests are rejected via optimistic locking.
- **FR-006**: The system MUST support **Stock Adjustment (ADJUSTMENT)**: a two-step workflow where a Manager submits a proposed physical count and a Manager approves it before the balance is updated.
- **FR-007**: Every `StockMovement` MUST produce an immutable audit log record containing: `actorId`, `timestamp`, `movementType`, `productId`, `quantityChange`, `branchId`, and (where applicable) `lotNumber`, `expiryDate`, and `overrideReason`.

#### 2.3 Role-Based Access

- **FR-008**: **Staff** role: may initiate Goods Receipt and Goods Issue transactions only.
- **FR-009**: **Manager** role: may initiate and approve Stock Adjustments, and view stock across all branches within the clinic.
- **FR-010**: **Admin** role: has full access to all movement types, can export audit logs, and manages system configuration.

#### 2.4 Medical Compliance (Lot & Expiry)

- **FR-011**: For items with `defaultRequiresBatchTracking = true` or `defaultRequiresExpiryTracking = true`, Goods Receipt MUST require Lot Number and/or Expiry Date input. Saving without them MUST be blocked.
- **FR-012**: `StockBalance` rows for lot-tracked items are keyed by `(branchId, productId, lotNumber)`. Non-lot-tracked items use a single row per `(branchId, productId)` with `lotNumber = NULL`. A partial unique index enforces this constraint.
- **FR-013**: During Goods Issue for perishable items, the system MUST pre-select the lot with the earliest `expiryDate` (FEFO). If the user selects a different lot, a warning MUST be displayed and a mandatory override reason collected before saving. The override reason MUST be stored in the audit log.
- **FR-014**: Lots with a past `expiryDate` MUST be flagged as "Expired" in the UI and require an explicit override reason to issue from.

#### 2.5 Procurement Alerts

- **FR-015**: After every Goods Issue or Stock Adjustment that reduces a balance, the system MUST evaluate the item's total branch balance against its `reorderPoint`.
- **FR-016**: If the balance is at or below `reorderPoint`, an in-app Low Stock alert MUST be surfaced via dashboard banner and notification bell. The alert MUST display: item name, current quantity, reorder point, and preferred supplier name from `defaultSupplierId`.
- **FR-017**: When stock is replenished above the `reorderPoint`, the Low Stock alert for that item MUST be automatically dismissed.
- **FR-018**: Items with `reorderPoint = null` or `0` are exempt from Low Stock evaluation.

### Key Entities

- **StockBalance**: The current quantity of one item (optionally one lot) at one branch. Keyed by `(branchId, productId, lotNumber)`. Includes an optimistic lock `version` counter.
- **StockMovement**: An immutable ledger entry recording every quantity change. Source of truth for balance derivation and audit. Includes `status` for ADJUSTMENT two-step flow.
- **Item (Product)**: Sourced from Item Master. Carries compliance flags, `reorderPoint`, and `defaultSupplierId`.
- **LowStockAlert**: A derived, dismissable in-app notification tied to an item and branch when balance ≤ reorderPoint.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Staff can complete a Goods Receipt or Goods Issue transaction in under 90 seconds under normal conditions.
- **SC-002**: Stock balances reflect all committed transactions within 2 seconds of a movement being saved.
- **SC-003**: No stock balance is ever allowed to go negative under any concurrent load condition.
- **SC-004**: 100% of stock movements have a corresponding, non-deletable audit log entry including actor, timestamp, and quantity.
- **SC-005**: FEFO pre-selection is presented to staff in 100% of Goods Issue interactions involving a lot-tracked item with more than one active lot.
- **SC-006**: Low Stock alerts appear in the dashboard within 5 seconds of the triggering Goods Issue being committed.
- **SC-007**: A Manager can view the full audit trail for any item across all branches within 3 clicks from the Stock Ledger.

---

## Data & API Structures

### Data Model

#### `StockBalance`

| Field | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `clinicId` | UUID | FK → Clinic, NOT NULL |
| `branchId` | UUID | FK → Branch, NOT NULL |
| `productId` | UUID | FK → Item Master, NOT NULL |
| `lotNumber` | String | Nullable |
| `expiryDate` | DateTime | Nullable |
| `quantity` | Decimal | NOT NULL, >= 0 |
| `updatedAt` | DateTime | Updated on every movement |
| `version` | Integer | Optimistic lock counter, NOT NULL |

**Unique constraint**: `(branchId, productId, lotNumber)`. Partial unique index ensures only one `lotNumber = NULL` row per `(branchId, productId)`.

#### `StockMovement`

| Field | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `clinicId` | UUID | FK → Clinic, NOT NULL |
| `branchId` | UUID | FK → Branch, NOT NULL |
| `productId` | UUID | FK → Item Master, NOT NULL |
| `movementType` | Enum | RECEIPT, ISSUE, ADJUSTMENT — NOT NULL |
| `lotNumber` | String | Nullable |
| `expiryDate` | DateTime | Nullable |
| `quantityChange` | Decimal | NOT NULL (positive = in, negative = out) |
| `referenceDocumentId` | String | Nullable |
| `overrideReason` | String | Nullable — required when FEFO or expiry override |
| `actorId` | UUID | FK → User, NOT NULL |
| `approverId` | UUID | FK → User, Nullable (populated on ADJUSTMENT approval) |
| `status` | Enum | COMMITTED, PENDING_APPROVAL, REJECTED |
| `createdAt` | DateTime | NOT NULL, immutable |

### API Endpoints

#### Stock Balance

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/clinics/:clinicId/stock-balances` | Staff+ | List balances. Supports `?branchId=`, `?productId=`, `?lowStock=true` filters. |
| `GET` | `/api/v1/clinics/:clinicId/branches/:branchId/stock-balances` | Staff+ | Branch-scoped balance view. |

#### Stock Movements

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/clinics/:clinicId/stock-movements` | Staff+ | Create RECEIPT or ISSUE movement. |
| `POST` | `/api/v1/clinics/:clinicId/stock-adjustments` | Manager+ | Submit pending Stock Adjustment. |
| `PATCH` | `/api/v1/clinics/:clinicId/stock-adjustments/:id/approve` | Manager+ | Approve and commit adjustment. |
| `PATCH` | `/api/v1/clinics/:clinicId/stock-adjustments/:id/reject` | Manager+ | Reject adjustment with reason. |
| `GET` | `/api/v1/clinics/:clinicId/stock-movements` | Manager+ | Audit log query with filters. |

#### Alerts

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/clinics/:clinicId/alerts/low-stock` | Staff+ | List active Low Stock alerts. |

### Request / Response Shapes

**Goods Issue Request**:
```json
{
  "branchId": "uuid",
  "productId": "uuid",
  "movementType": "ISSUE",
  "quantityChange": -5,
  "lotNumber": "LOT-2025-001",
  "referenceDocumentId": "INV-00123",
  "overrideReason": "FEFO lot physically inaccessible — rear shelf blocked"
}
```

**Goods Receipt Request**:
```json
{
  "branchId": "uuid",
  "productId": "uuid",
  "movementType": "RECEIPT",
  "quantityChange": 50,
  "lotNumber": "LOT-2026-042",
  "expiryDate": "2027-03-31T00:00:00Z",
  "referenceDocumentId": "PO-00456"
}
```

**Low Stock Alert Response**:
```json
{
  "id": "uuid",
  "clinicId": "uuid",
  "branchId": "uuid",
  "productId": "uuid",
  "productName": "Amoxicillin 500mg",
  "currentQuantity": 3,
  "reorderPoint": 10,
  "preferredSupplierName": "PharmaCo Ltd.",
  "preferredSupplierId": "uuid",
  "triggeredAt": "2026-06-01T09:23:00Z"
}
```

---

## UI Requirements

### Stock Ledger Workspace

- High-density data grid: Item Name, SKU, Unit, Branch, Lot Number, Expiry Date, Current Quantity, Reorder Point, Status badge.
- Status badges: `In Stock` (green), `Low Stock` (amber), `Expired` (red), `Out of Stock` (grey).
- Filters: Branch selector, Item Name/SKU search, Status filter, Lot Number search.
- Clicking a row opens a slide-over panel with the item's full movement history (paginated audit log).
- Action buttons: "New Receipt", "New Issue", "Adjust Stock" (Manager/Admin only).

### Goods Receipt Form

- Fields: Item search (autocomplete by name/SKU/barcode), Branch (pre-filled for Staff), Quantity (numeric, > 0), Reference Document (optional), Lot Number (required if batch-tracked), Expiry Date (required if expiry-tracked, date picker, future date only).
- Compliance fields highlighted with red asterisk when required; form cannot be submitted without them.
- Barcode scan input field activates camera/scanner and populates Item field.
- On success: toast notification "Receipt recorded — [Item Name] +[Qty]", balance updates in real-time on ledger.

### Goods Issue Form

- Fields: Item search, Branch, Lot selector (sorted FEFO — earliest expiry first with "FEFO Recommended" badge on top lot), Quantity (validated against available lot quantity), Reference Document (optional).
- FEFO Warning Dialog: Triggers when a non-FEFO lot is selected. Modal: "You are deviating from FEFO order. The recommended lot expires [DATE]. Please provide a reason." Override Reason text field (mandatory, min 10 characters).
- Expired Lot Warning: If selected lot is expired, a red warning banner appears; override reason is mandatory.
- On insufficient stock: inline error "Insufficient stock. Available: [N] [Unit]."

### Stock Adjustment Form (Manager/Admin)

- Fields: Item search, Branch, Physical Count (actual observed quantity), Reference/Notes (mandatory), system-computed "Variance" (physical count minus system balance).
- Submitted adjustments appear in a "Pending Approvals" list for Managers.
- Approver sees: submitter, timestamp, item, branch, current balance, proposed balance, variance, notes.
- Approve / Reject buttons with confirmation dialogs.

### Low Stock Notification

- Dashboard banner: Dismissable amber strip listing count of active Low Stock items.
- Notification bell: Badge count increments on new alerts.
- Alert card: Item name, current quantity vs reorder point, preferred supplier name.

---

## Assumptions

- The three-tier role model (Staff / Manager / Admin) maps to roles already established in the `003-clinic-onboarding-staff` feature. No new role infrastructure is required.
- Item Master (`006-item-master`) is complete and provides `defaultRequiresBatchTracking`, `defaultRequiresExpiryTracking`, `reorderPoint`, and `defaultSupplierId` per item.
- Barcode scanning is supported via web-based camera input or USB HID scanner (keyboard-emulation mode). No native device SDK required.
- `reorderPoint` evaluation runs synchronously at the end of each movement transaction (not via a background job) for this phase.
- The `TRANSFER` movement type is reserved in the data model but not surfaced in the UI or API for this phase.
- Multi-branch Stock Transfers and automated Purchase Order generation are explicitly out of scope.
- Email/SMS/push Low Stock notification delivery is deferred to a later phase.

---

## Out of Scope

- Multi-branch Stock Transfers.
- Automated Purchase Order generation.
- Email/SMS/push notification delivery for Low Stock alerts.
- Barcode label printing.
- Inventory valuation / COGS accounting.
