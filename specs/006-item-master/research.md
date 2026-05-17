# Research: Item Master ERP Foundation

## Decision 1: Evolve the existing Product aggregate into the canonical Item Master record

- **Decision**: Expand the current relational `Product` model and inventory CRUD slice instead of creating a second `Item` table or parallel item module.
- **Rationale**: Existing stock movements, low-stock logic, and clinical inventory links already point to `Product.id`. Preserving one canonical aggregate avoids cross-domain duplication and migration churn.
- **Alternatives considered**:
  - Create a new `Item` table alongside `Product` — rejected because it would split identity between item master and stock operations.
  - Keep `Product` unchanged and store advanced item metadata in JSON — rejected because unit conversions, tax references, and vendor links need relational validation.

## Decision 2: Keep item ownership inside InventoryModule

- **Decision**: Implement item master backend changes in `apps/api/src/modules/inventory`.
- **Rationale**: The current inventory module already owns product CRUD and stock movements. Item master is an inventory-owned master-data concern even when some items are services.
- **Alternatives considered**:
  - Move item master into `IdentityModule` for reference-data convenience — rejected because it would blur bounded contexts.
  - Create a new top-level `ItemMasterModule` — rejected because current repo structure does not justify another domain slice yet.

## Decision 3: Normalize item categories as clinic-scoped reference data with optional GL mappings

- **Decision**: Add a clinic-scoped `ItemCategory` model with nullable revenue and expense GL mapping fields.
- **Rationale**: The spec requires categories to remain clinic-owned and optionally accounting-aware without blocking clinics that are not ready to configure GL mappings on day one.
- **Alternatives considered**:
  - Keep `category` as a raw string on `Product` — rejected because it cannot support optional GL mappings or clean selector UX.
  - Require non-null GL mappings for every category — rejected because it would over-couple item setup to accounting readiness.

## Decision 4: Normalize units of measure and model alternate conversions per item

- **Decision**: Add clinic-scoped `UnitOfMeasure` records and per-item `ItemUnitConversion` rows tied to one canonical base unit.
- **Rationale**: The spec requires Box-to-Piece style conversion logic and duplicate/invalid alternate-unit prevention. That is difficult to enforce reliably with string fields alone.
- **Alternatives considered**:
  - Store units as strings and conversions in JSON — rejected because it weakens referential validation and makes selectors harder to reuse.
  - Create global units with no clinic scope — rejected because the user explicitly requested tenant-aligned modeling and clinics may need local naming conventions.

## Decision 5: Use global TaxCode references plus isTaxInclusive, never hardcoded rates

- **Decision**: Persist only a tax-code reference and an `isTaxInclusive` flag in the item pricing profile.
- **Rationale**: This preserves statutory-rate agility. A `TaxCode` master update can change downstream billing behavior without rewriting item rows or hardcoding percentages in the item master.
- **Alternatives considered**:
  - Store tax percentage snapshots directly on items — rejected because it breaks rate-change propagation.
  - Omit `isTaxInclusive` and force one pricing mode globally — rejected because the clarified spec requires per-item pricing strategy.

## Decision 6: Keep billing calculations out of the item-master write path

- **Decision**: Document downstream calculation rules for inclusive vs. exclusive tax behavior, but do not perform invoice math in item CRUD.
- **Rationale**: The spec explicitly future-proofs billing behavior without expanding this slice into invoice computation.
- **Alternatives considered**:
  - Add reverse-tax calculation logic in the item service — rejected because item master is configuration, not billing execution.
  - Ignore downstream tax semantics entirely — rejected because the clarified spec made those rules mandatory.

## Decision 7: Store batch/expiry requirements as an item-level control flag only

- **Decision**: Add `requiresBatchAndExpiryTracking` to stocked items, with enforcement deferred to future receipt/dispense workflows.
- **Rationale**: This captures the operational rule in master data now without prematurely implementing lot-state persistence in an out-of-scope flow.
- **Alternatives considered**:
  - Build full lot and expiration transaction tables in this slice — rejected because procurement/dispensing execution is out of scope.
  - Ignore the flag until inventory transactions exist — rejected because the item master is where the clinic defines the rule.

## Decision 8: Support a single optional preferred supplier reference

- **Decision**: Add one nullable `defaultSupplierId` reference from item master to `BusinessPartner`.
- **Rationale**: The clarified spec chose one preferred vendor to support future procurement without introducing a complex vendor matrix yet.
- **Alternatives considered**:
  - No supplier reference in item master — rejected because it loses sourcing value chosen during clarification.
  - Multi-vendor catalog with vendor-specific pricing — rejected because it expands scope into procurement catalog management.

## Decision 9: Reuse existing audit, session, and role-guard infrastructure

- **Decision**: Apply the current `@Audit()` interceptor, `@TenantId()` decorator, branch guard, and roles guard to item-master endpoints.
- **Rationale**: The repo already implements append-only Mongo audit logging and trusted clinic derivation through Redis-backed session context.
- **Alternatives considered**:
  - Add a new inventory-specific audit store — rejected because it duplicates established infrastructure.
  - Rely only on controller role guards with no service-level validation — rejected because clinic and entity ownership checks still need enforcement in service logic.

## Decision 10: Reuse the Business Partner tabbed form pattern for the item workspace

- **Decision**: Model the item form as a multi-tab clinic CRUD experience using the same `Tabs`, `react-hook-form`, and `zod` patterns already used by Business Partners.
- **Rationale**: The repo already has a proven ERP-style master-data form with sticky actions and bilingual text infrastructure. Reusing that pattern lowers UI risk and keeps clinic experiences consistent.
- **Alternatives considered**:
  - Keep the current single-page simple product UI — rejected because it cannot scale to item types, pricing, units, clinic flags, and validations.
  - Build a modal-only editor — rejected because the required scope and density need a dedicated workspace.
