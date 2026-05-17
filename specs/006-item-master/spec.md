# Feature Specification: Item Master ERP Foundation

**Feature Branch**: `006-item-master`  
**Created**: 2026-05-16  
**Status**: Draft  
**Input**: User description: "Create a detailed technical specification at d:\Deaw\petiatrics\documents\5-item-master.md for all. Focus on UI requirements, Data/API structures, and Acceptance Criteria. Use the template at d:\Deaw\petiatrics\.specify\templates\spec-template.md and adhere to d:\Deaw\petiatrics\.specify\memory\constitution.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and maintain clinic items (Priority: P1)

As a clinic owner or authorized staff member, I need to create and maintain a clinic-wide item master for medicines, retail goods, and service fees so that downstream purchasing, inventory, billing, and treatment workflows use the same trusted item definitions.

**Why this priority**: The item master is prerequisite master data for nearly every ERP workflow. Without it, later procurement, dispensing, and billing slices cannot be configured reliably.

**Independent Test**: Can be fully tested by creating one physical item and one service item, editing both, and confirming they are stored under the current clinic with the expected type-specific rules.

**Acceptance Scenarios**:

1. **Given** an authenticated clinic owner with item-master access, **When** they create a stocked medicine item with code, name, category, and base unit, **Then** the system stores the item under the clinic from session context and makes it available in item search results.
2. **Given** an authenticated clinic owner, **When** they create a service item for a doctor consultation, **Then** the system stores it as a non-stock item and does not require inventory-specific fields.
3. **Given** an existing item, **When** an authorized user updates non-identity details such as category, status, or clinic-specific flags, **Then** the item remains the same clinic-owned record and the changes are reflected in subsequent reads.

---

### User Story 2 - Configure units, pricing, and tax defaults (Priority: P1)

As a clinic operations user, I need to define each item's unit-of-measure structure, conversion rules, pricing defaults, and tax profile so that purchase, stocking, and selling quantities stay consistent without manual calculation.

**Why this priority**: Incorrect units or pricing will corrupt inventory counts, billing values, and doctor-fee setup even if the item record itself exists.

**Independent Test**: Can be tested by defining a base unit, adding an alternate unit conversion, assigning standard cost and selling price, then retrieving the item and verifying the same values are returned and validated.

**Acceptance Scenarios**:

1. **Given** a physical item whose base unit is "Piece", **When** a user adds an alternate unit "Box" with a conversion of 1 Box = 10 Pieces, **Then** the system stores one canonical base unit and one valid conversion factor for the same clinic item.
2. **Given** a service item, **When** a user assigns a selling price and tax defaults, **Then** the system saves the commercial profile without requiring stock conversion rules beyond the chosen service unit.
3. **Given** an item pricing profile, **When** a user retrieves the item in the UI or API, **Then** the standard cost, base selling price, tax defaults, and doctor fee defaults are returned together with the active unit configuration.

---

### User Story 3 - Operate an ERP-style item workspace (Priority: P2)

As a clinic admin or staff member, I need a dense, searchable item-master workspace with tabs, sticky actions, and filterable grids so that I can review and update large item catalogs efficiently in both Thai and English.

**Why this priority**: The data model only becomes usable at operational scale if staff can browse, filter, and edit many items quickly.

**Independent Test**: Can be tested by loading a mixed item list, filtering by type/category/status, opening an item in tabbed edit mode, and saving a change without losing context.

**Acceptance Scenarios**:

1. **Given** a clinic with many active and inactive items, **When** a user filters by item type, category, controlled-substance status, or text search, **Then** the grid updates to show only matching items.
2. **Given** an item opened for editing, **When** the user moves between item tabs such as General, Units, Pricing, and Clinic Details, **Then** the screen keeps primary actions visible and preserves unsaved form state until the user saves or cancels.
3. **Given** the clinic application is operating in Thai or English, **When** a user views the item list or form, **Then** user-facing labels and status text are presented in the selected language.

### Edge Cases

- What happens when a user attempts to save an item code that already exists in the same clinic with different casing or whitespace? The system must reject the save and explain that item codes are unique per clinic after normalization.
- What happens when a user tries to deactivate an item already referenced by future workflows? The item should become unavailable for new selections but remain queryable for historical references.
- How does the system handle a conversion rule with zero, negative, or duplicate alternate units? The system must reject invalid conversions before save.
- What happens when a service item is incorrectly given stock-only behavior? The system must prevent inventory-only fields from being required or persisted for service-only items.
- What happens when an authenticated user changes the active branch? Item master access remains clinic-scoped; branch changes must not alter or bypass clinic ownership rules.

## Clarifications

### Session 2026-05-16

- Q: How should the system treat the Base Selling Price and Standard Cost regarding Thai VAT? → A: Configurable per Item (Option C - add an `isTaxInclusive` boolean flag). Tax profiles must reference the global `TaxCode` table to ensure statutory rate changes flow naturally into inclusive reverse-calculations or exclusive additions downstream.
- Q: When defining `ItemCategory`, should categories include a strict mapping to GL account codes? → A: Optional GL Mapping (Option C). GL account maps for Revenue and Expense are available on categories but nullable, bridging organizational needs with deferred accounting readiness.
- Q: How should the Item Master handle traceability requirements (e.g., Lot numbers and expiry dates) for medical goods? → A: Item-Level Control Flag (Option A). Add a boolean `requiresBatchAndExpiryTracking` to dictate which items force downstream receipt/dispensing workflows to capture this data.
- Q: When configuring physical items, should the Item Master capture the preferred default supplier? → A: Single Preferred Vendor (Option A). Add an optional `defaultSupplierId` pointing to the BusinessPartner to streamline future procurement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST manage item master records as clinic-owned master data scoped by `clinicId` derived from trusted server-side session context.
- **FR-002**: The system MUST NOT accept client-provided tenant identifiers as the source of truth for item ownership.
- **FR-003**: The system MUST support at least two item types: stocked physical goods and non-stock services.
- **FR-004**: Each item MUST belong to exactly one item category drawn from the globally seeded `ItemCategory` reference list, used for classification, search, and downstream defaults.
- **FR-005**: Each item MUST have a clinic-unique item code and a display name.
- **FR-006**: Duplicate item codes MUST be blocked within a clinic even when the submitted value differs only by letter casing or surrounding whitespace.
- **FR-007**: The system MUST allow items to be marked active or inactive without deleting historical references.
- **FR-008**: Each item MUST define one primary unit of measure that acts as the canonical base quantity for that item.
- **FR-009**: The system MUST support zero or more alternate units of measure for an item, each with a positive conversion ratio back to the base unit.
- **FR-010**: The system MUST prevent duplicate alternate-unit assignments on the same item.
- **FR-011**: The system MUST distinguish stocked items from service items so that stock-related behavior is only available for stocked items.
- **FR-012**: The system MUST store standard cost and base selling price for each item as separate commercial values.
- **FR-013**: The system MUST support item-level tax defaults by referencing the global `TaxCode` master table using the `defaultTaxCodeId` field, avoiding hardcoded percentages.
- **FR-025**: The commercial profile MUST support a configurable `isTaxInclusive` boolean flag. If true, the system treats `baseSellingPrice` as the grand total inclusive of the referenced tax code. If false, downstream workflows MUST dynamically add the tax percentage on top of `baseSellingPrice`. No billing computations are performed in the item master scope itself.
- **FR-014**: The system MUST allow clinic-specific medical attributes including generic name and controlled-substance status for applicable items.
- **FR-026**: The system MUST store a boolean `requiresBatchAndExpiryTracking` on stocked items. When true, downstream workflows (receiving, dispensing) MUST enforce capture of lot number and expiration date for this item.
- **FR-027**: The system MUST support an optional preferred vendor assignment (`defaultSupplierId` pointing to a `BusinessPartner` with an active `SUPPLIER` `BpRole`) on stocked items to streamline procurement.
- **FR-015**: The system MUST allow a default doctor-fee rate or fee amount to be configured for service items used for veterinarian charging workflows.
- **FR-016**: The system MUST provide create, list, view, update, and deactivate behaviors for items through a clinic-authenticated API surface.
- **FR-017**: The system MUST provide read-only reference selectors for globally seeded item categories, globally seeded units of measure, and global tax defaults needed by the item form.
- **FR-018**: Item list retrieval MUST support filtering by text search, item type, category, active status, and controlled-substance flag.
- **FR-019**: The item-maintenance UI MUST provide an ERP-style workspace with a sticky page header, persistent primary actions, tabbed editing, and a high-density list view.
- **FR-020**: The item-maintenance UI MUST preserve unsaved form state while the user navigates between item tabs within the same edit session.
- **FR-021**: User-facing item-master flows MUST be localizable in Thai and English.
- **FR-022**: Material item mutations MUST produce audit records that preserve actor identity and before/after business values for the changed record.
- **FR-023**: Only authorized clinic roles may create, update, or deactivate items; read-only roles may view and search items but may not mutate them.
- **FR-024**: The system MUST return item details in a shape that includes identity, classification, unit configuration, pricing defaults, tax defaults, clinic-specific medical flags, and status in one item response.

### UI Requirements

- The item workspace MUST prioritize dense data entry and rapid scanning over marketing-style presentation.
- The list view MUST expose columns for code, name, type, category, base unit, active status, and key clinic-specific indicators.
- The create/edit form MUST separate concerns into clear tabs such as General, Units, Pricing, and Clinic Details.
- The form MUST keep save and cancel actions visible while the user scrolls long tabs.
- The interface MUST clearly distinguish stock items from service items and only reveal relevant fields for the selected type.
- The interface MUST show validation feedback inline for duplicate item codes, invalid conversion ratios, and missing required pricing/unit fields.

### Data & API Structures

#### Proposed Data Model

- **Item**: Clinic-owned master record identified by item code. Captures item type, display name, item category, base unit, commercial defaults, clinic-specific medical attributes, active status, and audit metadata.
- **ItemCategory**: Globally seeded read-only reference record used to classify items for search, defaults, and reporting. Categories are seeded for all clinics (e.g., Medicine, Retail, Service, Laboratory, Procedure, Consultation) and are not clinic-managed in this release. Supports optional (nullable) General Ledger (GL) account mappings for Revenue and Expense.
- **UnitOfMeasure**: Globally seeded read-only reference record describing a usable quantity label such as Piece, Box, Bottle, Vial, or Visit. Units are shared across all clinics and are not clinic-managed in this release.
- **ItemUnitConversion**: Child record of an item that maps one alternate unit to the item's base unit using a positive ratio so all quantities can normalize back to a single canonical measure. An item may have zero or more conversions.

#### API Resource Expectations

- The item API MUST expose item-list and item-detail resources that are already filtered to the authenticated clinic, including `isTaxInclusive` in all item responses.
- Create and update requests MUST accept business fields for item identity, type, category, unit configuration, pricing, tax defaults, and clinic-specific attributes in a single transactionally validated payload.
- Item-detail responses MUST return both the canonical base unit and any alternate-unit conversions so downstream consumers do not need separate lookups to interpret quantities.
- Reference endpoints MUST expose globally seeded item categories and units of measure, plus the global tax defaults; no clinic-scoping is applied to category or unit selectors.
- Mutation responses MUST provide enough detail for the UI to refresh the edited row and the full form without issuing conflicting follow-up requests.

### Key Entities *(include if feature involves data)*

- **Item**: A clinic-owned master record representing either a stocked physical good or a non-stock service. Key business attributes include item code, display name, item type, category, base unit, active status, generic name, controlled-substance flag, `requiresBatchAndExpiryTracking` control flag, preferred supplier reference (`defaultSupplierId`), doctor-fee default, standard cost, base selling price, `isTaxInclusive` flag, `defaultTaxCodeId`, and audit metadata. Commercial attributes are stored directly on the `Item`/`Product` row and are not held in a separate pricing entity.
- **ItemCategory**: A globally seeded read-only reference used to classify items into operational groups such as Medicine, Retail, Service, Procedure, Laboratory, or Consultation. Categories are shared across all clinics in this release and are not clinic-managed. Includes optional GL account mappings for Revenue and Expense.
- **UnitOfMeasure**: A globally seeded read-only quantity label (e.g., Piece, Box, Bottle, Vial, Visit) that gives meaning to item quantities. Units are shared across all clinics in this release. One unit acts as the item's base measure; others may be attached through explicit conversion rules.
- **ItemUnitConversion**: A rule that translates an alternate unit for a specific item back into the base unit using a positive conversion factor. An item may have zero or more conversions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authorized clinic staff can create a new physical item or service item, including required unit and pricing data, in under 3 minutes for 90% of attempts during user acceptance testing.
- **SC-002**: 100% of attempted duplicate item-code submissions within the same clinic are rejected before a conflicting record is committed.
- **SC-003**: 100% of approved unit configurations normalize alternate units back to the same base quantity consistently in verification scenarios.
- **SC-004**: Staff can locate an existing item by search or filters in under 30 seconds for 90% of verification scenarios using the item workspace.
- **SC-005**: 100% of item-master screens covered by the feature present Thai and English user-facing copy for labels, validation messages, and statuses.

## Assumptions

- Item master is clinic-scoped master data and is not separately owned by branch; branch context may affect downstream operational use later but not item ownership in this slice.
- The existing authenticated session model, role checks, and audit strategy will be reused for item-master access control and mutation tracking.
- The current tax-code master remains the source for selectable tax defaults; this feature does not introduce a separate tenant tax table. `ItemCategory` and `UnitOfMeasure` are globally seeded reference data for V1 and are not clinic-managed in this release; management of these reference lists is deferred to a future administrative feature.
- Physical inventory valuation, stock movement posting, procurement documents, and billing calculations remain outside this feature even though they will consume item master later.
- Existing clinic users who can manage master data today will also manage item master by default, while read-only roles retain inquiry access only.

## Out of Scope

- Inventory transaction posting, replenishment logic, and warehouse balances.
- Purchase orders, goods receipts, vendor bills, invoices, and payment allocation workflows.
- Automatic accounting entries or financial ledgers derived from item activity.
- Branch-level price overrides or branch-owned item catalogs.
- Barcode printing, label design, and external scanner integration.
