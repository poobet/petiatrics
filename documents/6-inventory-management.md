# Feature Specification: Inventory & Stock Management

**Feature Branch**: `007-inventory-management`
**Status**: Draft
**Context**: Building upon the `006-item-master` foundation, this phase introduces transactional inventory ledgers, branch-level stock tracking, and medical compliance enforcement for the clinic.

## 1. Overview & Objectives

The primary goal of this phase is to transition from static catalog data (Item Master) to dynamic, transactional stock tracking. The system will manage physical quantities, track movements across branches, and enforce compliance rules (e.g., Lot/Expiry tracking) inherited from the Item Category policies.

## 2. Key Modules & Functional Requirements (FR)

### 2.1 Branch-Level Stock Balance
*   **FR-001**: The system MUST maintain real-time stock balances separated by `branchId` within the broader `clinicId` scope.
*   **FR-002**: Users MUST NOT be able to manually edit the stock balance directly. Balances MUST only be updated via validated `StockMovement` transactions.
*   **FR-003**: The system MUST aggregate total clinic stock while allowing users to filter visibility down to their authorized branch.

### 2.2 Stock Transactions (Movements)
*   **FR-004**: The system MUST support **Goods Receipt (In)**: Adding stock to a branch (e.g., receiving deliveries from suppliers).
*   **FR-005**: The system MUST support **Goods Issue (Out)**: Deducting stock from a branch (e.g., dispensing medicine, retail sales, or clinical use). The system MUST hard-block any issue that would result in negative stock, rejecting the transaction with an "Insufficient stock" error. Concurrent transactions are handled via optimistic locking; the second conflicting request is rejected.
*   **FR-006**: The system MUST support **Stock Adjustment**: Reconciling physical counts with system counts. A three-tier role model applies: **Staff** may perform Goods Receipt and Goods Issue only; **Manager** may submit Adjustments, approve pending Adjustments, and view stock across all authorized branches; **Admin** has full access including audit log exports and system configuration.
*   **FR-007**: Every stock movement MUST generate an immutable audit log detailing the actor, timestamp, transaction type, item, quantity changed, and branch.

### 2.3 Medical Compliance Execution (Lot & Expiry)
*   **FR-008**: When processing a Goods Receipt for an item whose category dictates `defaultRequiresBatchTracking = true` or `defaultRequiresExpiryTracking = true`, the system MUST strictly require the user to input the Lot Number and/or Expiry Date before saving.
*   **FR-009**: The system MUST track stock balances not just by Item, but by Item + Lot Number combination for perishable goods.
*   **FR-010**: During Goods Issue for perishable items, the system MUST pre-select the FEFO (First Expire, First Out) designated lot. If staff selects a different lot, the system MUST display a warning and require a mandatory override reason before saving. The override reason MUST be recorded in the audit log.

### 2.4 Procurement Alerts (Reorder Triggers)
*   **FR-011**: The system MUST continuously evaluate the current stock balance against the `reorderPoint` defined in the Item Master.
*   **FR-012**: If the stock balance falls at or below the `reorderPoint`, the system MUST surface a "Low Stock" alert delivered in-app via a dashboard banner and notification bell. External delivery (email/SMS) is out of scope for this phase.
*   **FR-013**: The Low Stock alert MUST display the `defaultSupplierId` associated with the item to streamline the upcoming Purchasing workflow.

## 3. Proposed Data Model Additions

### `StockBalance`
Tracks the current physical quantity of an item at a specific location.
*   `id` (UUID, PK)
*   `clinicId` (UUID, FK)
*   `branchId` (UUID, FK)
*   `productId` (UUID, FK -> Item Master)
*   `lotNumber` (String, Nullable)
*   `expiryDate` (DateTime, Nullable)
*   `quantity` (Decimal)
*   **Unique constraint**: `(branchId, productId, lotNumber)`. A partial unique index enforces that only one row with `lotNumber = NULL` exists per `(branchId, productId)` pair, representing non-lot-tracked items.

### `StockMovement`
The immutable ledger of all inventory transactions.
*   `id` (UUID, PK)
*   `clinicId` (UUID, FK)
*   `branchId` (UUID, FK)
*   `productId` (UUID, FK -> Item Master)
*   `movementType` (Enum: RECEIPT, ISSUE, ADJUSTMENT, TRANSFER)
*   `quantityChange` (Decimal - positive or negative)
*   `referenceDocumentId` (String, Optional - e.g., PO Number or Invoice Number)
*   `actorId` (UUID, FK -> User)
*   `createdAt` (DateTime)

## 4. UI/UX Requirements

*   **Stock Ledger Workspace**: A high-density data grid allowing staff to view current inventory levels across the clinic or filtered by branch.
*   **Movement Modals**: Streamlined pop-up forms or dedicated screens for quick Goods Receipt and Goods Issue, optimized for rapid data entry (including Barcode scanning support).
*   **Compliance Validation**: Visual cues (e.g., red asterisks, blocking alerts) if a user attempts to receive a restricted medical item without entering the mandatory Lot/Expiry data.

## 6. Clarifications

### Session 2026-06-01
- Q: When two staff simultaneously try to issue the last unit of stock, what should the system do? → A: Hard block — reject second transaction with "Insufficient stock" error; negative stock is never permitted.
- Q: Should FEFO be a soft warning or hard block during Goods Issue? → A: Soft warning — pre-select FEFO lot, warn on override, require mandatory override reason recorded in audit log.
- Q: Which role model governs movement permissions? → A: Three-tier — Staff (Receipt/Issue), Manager (Adjustments + cross-branch view), Admin (full access + audit exports).
- Q: What uniquely identifies a StockBalance row? → A: `(branchId, productId, lotNumber)` with partial unique index for NULL-lot (non-tracked) items.
- Q: Where should Low Stock alerts be delivered? → A: In-app only — dashboard banner + notification bell; email/SMS deferred to a later phase.

## 5. Out of Scope for this Phase
*   Multi-branch Stock Transfers (moving stock from Branch A to Branch B in a single transaction).
*   Automated Purchase Order (PO) generation (this will be handled in the Procurement module, though Phase 2 will provide the alerts for it).