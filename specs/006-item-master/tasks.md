# Tasks: Item Master ERP Foundation

**Feature**: `006-item-master`
**Input**: Design documents from `specs/006-item-master/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Included — this task set covers normalized item-code uniqueness, tenant isolation, unit conversions, pricing/tax configuration, ERP workspace behavior, bilingual UI, and stock compatibility.

**Format**: `- [ ] T### [P?] [US?] Description — exact/file/path`
- `[P]` = parallelizable (independent files, no unmet dependencies)
- `[US1]`, `[US2]`, `[US3]` = user-story traceability labels
- Setup and foundational tasks carry no story label

---

## Phase 1: Setup

**Goal**: Freeze the item-master execution boundary before schema or UI work starts.

- [X] T001 Confirm canonical Product-to-Item migration scope and inventory-module ownership in `specs/006-item-master/spec.md` and `specs/006-item-master/plan.md`
- [X] T002 Confirm item reference, pricing, and migration assumptions in `specs/006-item-master/data-model.md`, `specs/006-item-master/contracts/api.md`, and `specs/006-item-master/quickstart.md`

---

## Phase 2: Foundational — Schema, Contracts, and API Scaffolding

**Goal**: Put the canonical schema, shared contracts, and controller/service scaffolding in place before any story-specific behavior is implemented.

**Critical**: No user story work should begin until this phase is complete.

**Independent Test**: `npm --prefix apps/api run lint` passes, Prisma migration and client generation complete without schema errors, and `npx prisma db seed` seeds at least one `ItemCategory` and one `UnitOfMeasure` row.

- [X] T003 Update `packages/database/prisma/schema.prisma` to expand `Product` and add `ItemType`, `ItemCategory`, `UnitOfMeasure`, and `ItemUnitConversion`
- [X] T004 Create the Product backfill migration and regenerate Prisma client in `packages/database/prisma/migrations/*` and `packages/database/prisma/schema.prisma`
- [X] T005 Seed global `ItemCategory` and `UnitOfMeasure` reference data in `packages/database/prisma/seed.ts` (Categories: Medicine, Retail, Service, Laboratory, Procedure, Consultation; UoMs: Piece, Box, Bottle, Vial, Visit, Session)
- [X] T006 [P] Add shared item enums to `packages/types/src/enums.ts`
- [X] T007 [P] Add item payloads, query types, selector responses, and item detail contracts to `packages/types/src/api.ts`
- [X] T008 Export the new item-master contracts from `packages/types/src/index.ts`
- [X] T009 [P] Create item CRUD/filter DTOs in `apps/api/src/modules/inventory/dto/create-product.dto.ts`, `apps/api/src/modules/inventory/dto/update-product.dto.ts`, and `apps/api/src/modules/inventory/dto/list-products.dto.ts`
- [X] T010 [P] Create inventory reference scaffolding in `apps/api/src/modules/inventory/services/reference.service.ts` and `apps/api/src/modules/inventory/controllers/reference.controller.ts`
- [X] T011 Update `apps/api/src/modules/inventory/inventory.module.ts` to register the expanded item-master services, DTOs, and reference controller

**Checkpoint**: The schema, migration path, global seed data, shared contracts, and API scaffolding are ready for story implementation.

---

## Phase 3: User Story 1 - Create and Maintain Clinic Items (Priority: P1) 🎯 MVP

**Goal**: Deliver the canonical clinic item CRUD flow for stocked goods and services.

**Independent Test**: Create one stocked item and one service item, edit both, and deactivate one without breaking clinic scoping or existing stock compatibility.

### Tests for User Story 1

- [X] T012 [P] [US1] Add canonical item CRUD and normalized-code tests in `apps/api/src/modules/inventory/services/product.service.spec.ts`
- [X] T013 [P] [US1] Add clinic-scoped CRUD authorization and deactivate-route tests in `apps/api/src/modules/inventory/controllers/product.controller.spec.ts`
- [X] T014 [P] [US1] Add clinic item create/edit/deactivate Playwright coverage in `apps/web/test/e2e/inventory-items.spec.ts`

### Implementation for User Story 1

- [X] T015 [US1] Refactor `apps/api/src/modules/inventory/services/product.service.ts` for clinic-scoped create/list/get/update/deactivate item CRUD with canonical code normalization and item detail mapping
- [X] T016 [US1] Update `apps/api/src/modules/inventory/controllers/product.controller.ts` with item CRUD routes, role matrix, and `@Audit()` metadata for create/update/deactivate
- [X] T017 [US1] Update `apps/api/src/modules/inventory/services/stock.service.ts` to preserve stock compatibility with the evolved `Product` shape and reject service-item stock mutations
- [X] T018 [P] [US1] Update `apps/web/app/(clinic)/clinic/inventory/page.tsx` and `apps/web/app/(clinic)/clinic/inventory/products/new/page.tsx` for the baseline item-master list and create flow
- [X] T019 [P] [US1] Create `apps/web/app/(clinic)/clinic/inventory/products/[id]/edit/page.tsx` for clinic item edit flow
- [X] T020 [US1] Replace `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx` with baseline item list/create/edit/deactivate behavior using the new item contracts

**Checkpoint**: User Story 1 is fully functional and testable as the MVP item-master slice.

---

## Phase 4: User Story 2 - Configure Units, Pricing, and Tax Defaults (Priority: P1)

**Goal**: Add unit conversions, tax-code references, pricing strategy, and clinic-specific commercial configuration to the canonical item aggregate.

**Independent Test**: Configure a base unit, alternate conversion, `isTaxInclusive`, default tax code, preferred supplier, and doctor fee, then retrieve the same values through the API and form.

### Tests for User Story 2

- [X] T021 [P] [US2] Add item detail and selector contract coverage in `apps/api/test/inventory-products.contract.spec.ts`
- [X] T022 [P] [US2] Extend pricing, tax-reference, unit-conversion, and preferred-vendor validation tests in `apps/api/src/modules/inventory/services/product.service.spec.ts`
- [X] T023 [P] [US2] Add item form schema validation tests in `apps/web/components/inventory/item-form-schema.test.ts`

### Implementation for User Story 2

- [X] T024 [US2] Implement globally seeded category and unit selectors plus global tax-code lookup in `apps/api/src/modules/inventory/services/reference.service.ts`
- [X] T025 [US2] Implement `/api/v1/inventory/reference/categories` and `/api/v1/inventory/reference/units` in `apps/api/src/modules/inventory/controllers/reference.controller.ts`
- [X] T026 [US2] Extend `apps/api/src/modules/inventory/services/product.service.ts` to persist category/base-unit relations, alternate conversions, pricing fields, `isTaxInclusive`, `defaultTaxCodeId`, `defaultDoctorFee`, `requiresBatchAndExpiryTracking`, and `defaultSupplierId`
- [X] T027 [P] [US2] Create item form schema and payload helpers in `apps/web/components/inventory/item-form-schema.ts` and `apps/web/components/inventory/item-form-types.ts`
- [X] T028 [P] [US2] Create `apps/web/components/inventory/tabs/general-tab.tsx` and `apps/web/components/inventory/tabs/clinic-details-tab.tsx` for identity and clinic-specific item fields
- [X] T029 [P] [US2] Create `apps/web/components/inventory/tabs/units-tab.tsx` and `apps/web/components/inventory/tabs/pricing-tab.tsx` for conversions, pricing, tax, and supplier configuration
- [X] T030 [US2] Create `apps/web/components/inventory/item-form.tsx` to fetch selector data, enforce service-vs-stocked conditions, and submit create/update payloads
- [X] T031 [P] [US2] Update `apps/web/messages/en.json` and `apps/web/messages/th.json` with unit, pricing, tax, supplier, and validation copy for item master

**Checkpoint**: User Story 2 is independently testable with category/unit selectors, pricing defaults, tax references, and conversion rules.

---

## Phase 5: User Story 3 - Operate an ERP-Style Item Workspace (Priority: P2)

**Goal**: Upgrade the clinic inventory surface into a dense, searchable ERP workspace with sticky actions and tab-preserving editing.

**Independent Test**: Filter a mixed item catalog by text/type/category/status, open an item in tabbed edit mode, switch tabs without losing state, and save successfully in Thai or English.

### Tests for User Story 3

- [X] T032 [P] [US3] Add dense-grid and filter interaction tests in `apps/web/components/inventory/item-table.spec.tsx` and `apps/web/components/inventory/item-filter-bar.spec.tsx`
- [X] T033 [P] [US3] Add tab persistence and sticky-action tests in `apps/web/components/inventory/item-form.spec.tsx`
- [X] T034 [P] [US3] Add workspace filter and edit-flow Playwright coverage in `apps/web/test/e2e/inventory-workspace.spec.ts`

### Implementation for User Story 3

- [X] T035 [P] [US3] Create `apps/web/components/inventory/item-filter-bar.tsx` and `apps/web/components/inventory/item-table.tsx` for dense search and filterable list interactions
- [X] T036 [P] [US3] Create `apps/web/components/inventory/item-form-header.tsx` and `apps/web/components/inventory/item-status-badge.tsx` for sticky actions and status presentation
- [X] T037 [US3] Extend list filtering in `apps/api/src/modules/inventory/services/product.service.ts` and `apps/api/src/modules/inventory/controllers/product.controller.ts` for `search`, `itemType`, `categoryId`, `includeInactive`, and `controlledSubstance`
- [X] T038 [US3] Refactor `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx` and `apps/web/components/inventory/item-form.tsx` to use dense workspace filters, sticky primary actions, tab error badges, and unsaved-state-preserving tabs

**Checkpoint**: User Story 3 is independently usable as the clinic-facing ERP workspace for item operations.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Protect adjacent flows, finish verification, and close cross-story risks.

- [X] T039 [P] Update `apps/api/src/modules/inventory/services/stock.service.ts` and `apps/api/src/modules/clinical/services/visit.service.ts` to keep existing product-linked workflows compatible with the expanded item aggregate
- [X] T040 [P] Add stock-regression coverage in `apps/api/src/modules/inventory/services/stock.service.spec.ts` and confirm evolved-item compatibility
- [X] T041 Run the quickstart verification flow in `specs/006-item-master/quickstart.md` and update any validation notes in `specs/006-item-master/quickstart.md`
- [X] T042 [P] Validate bilingual navigation, loading states, and empty states in `apps/web/app/(clinic)/clinic/inventory/page.tsx`, `apps/web/messages/en.json`, and `apps/web/messages/th.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies.
- **Phase 2: Foundational**: Depends on Setup and blocks all story work.
- **Phase 3: US1**: Starts after Phase 2 and delivers the MVP.
- **Phase 4: US2**: Starts after Phase 2, but builds on the canonical item CRUD introduced in US1.
- **Phase 5: US3**: Starts after US1 and US2 because the workspace depends on the expanded item aggregate and selector-backed form.
- **Phase 6: Polish**: Starts after all desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; this is the MVP.
- **US2 (P1)**: Depends on the canonical item aggregate from US1, but remains independently testable once implemented.
- **US3 (P2)**: Depends on US1 and US2 to provide the full ERP workspace experience.

### Within Each User Story

- Tests should be written before or alongside implementation and used as the acceptance gate for the story.
- API DTOs and service behavior should be in place before web forms depend on them.
- Selector/reference endpoints should exist before form components rely on them.
- Story checkpoints should be used to validate independent usability before proceeding.

---

## Parallel Opportunities

- **Foundation**: T006, T007, T009, and T010 can run in parallel after T003 stabilizes the schema direction.
- **US1**: T012, T013, and T014 can run in parallel; T018 and T019 can run in parallel once T016 defines the route contract.
- **US2**: T021, T022, and T023 can run in parallel; T028 and T029 can run in parallel after T027 defines form types.
- **US3**: T032, T033, and T034 can run in parallel; T035 and T036 can run in parallel before T038 integrates them.
- **Polish**: T039, T040, and T042 can run in parallel once all stories are implemented.

---

## Parallel Example: User Story 1

```bash
# Launch US1 verification work together:
Task: T012 Add canonical item CRUD and normalized-code tests in apps/api/src/modules/inventory/services/product.service.spec.ts
Task: T013 Add clinic-scoped CRUD authorization and deactivate-route tests in apps/api/src/modules/inventory/controllers/product.controller.spec.ts
Task: T014 Add clinic item create/edit/deactivate Playwright coverage in apps/web/test/e2e/inventory-items.spec.ts

# Launch US1 web route work together after backend routes exist:
Task: T018 Update apps/web/app/(clinic)/clinic/inventory/page.tsx and apps/web/app/(clinic)/clinic/inventory/products/new/page.tsx
Task: T019 Create apps/web/app/(clinic)/clinic/inventory/products/[id]/edit/page.tsx
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 verification work together:
Task: T021 Add item detail and selector contract coverage in apps/api/test/inventory-products.contract.spec.ts
Task: T022 Extend pricing, tax-reference, unit-conversion, and preferred-vendor validation tests in apps/api/src/modules/inventory/services/product.service.spec.ts
Task: T023 Add item form schema validation tests in apps/web/components/inventory/item-form-schema.test.ts

# Launch tab component work together after T027:
Task: T028 Create apps/web/components/inventory/tabs/general-tab.tsx and apps/web/components/inventory/tabs/clinic-details-tab.tsx
Task: T029 Create apps/web/components/inventory/tabs/units-tab.tsx and apps/web/components/inventory/tabs/pricing-tab.tsx
```

---

## Parallel Example: User Story 3

```bash
# Launch US3 UI building blocks together:
Task: T035 Create apps/web/components/inventory/item-filter-bar.tsx and apps/web/components/inventory/item-table.tsx
Task: T036 Create apps/web/components/inventory/item-form-header.tsx and apps/web/components/inventory/item-status-badge.tsx

# Launch US3 verification work together:
Task: T032 Add dense-grid and filter interaction tests in apps/web/components/inventory/item-table.spec.tsx and apps/web/components/inventory/item-filter-bar.spec.tsx
Task: T033 Add tab persistence and sticky-action tests in apps/web/components/inventory/item-form.spec.tsx
Task: T034 Add workspace filter and edit-flow Playwright coverage in apps/web/test/e2e/inventory-workspace.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate US1 independently through API and Playwright coverage.
5. Demo or release the canonical item CRUD slice before expanding pricing/workspace sophistication.

### Incremental Delivery

1. Finish Setup + Foundational to lock schema and contracts.
2. Deliver US1 for canonical item CRUD.
3. Add US2 for units, pricing, tax defaults, and commercial configuration.
4. Add US3 for the ERP workspace, dense filters, and sticky tabbed UX.
5. Finish with cross-cutting regression and quickstart verification.

### Suggested MVP Scope

- **MVP**: Phase 1 + Phase 2 + Phase 3 (US1 only)
- **Next increment**: Phase 4 (US2)
- **Operational polish**: Phase 5 (US3) + Phase 6

---

## Notes

- `[P]` tasks are safe to parallelize because they target different files or independent validation tracks.
- All tasks reference concrete repository paths so an implementation agent can execute them directly.
- The task order intentionally preserves one canonical item aggregate and avoids creating a second catalog beside `Product`.
- `GET /api/v1/reference/tax-codes` remains the existing global tax selector; category and unit selectors serve globally seeded `ItemCategory` and `UnitOfMeasure` records rather than clinic-managed data.
- Quickstart verification in `specs/006-item-master/quickstart.md` is the final acceptance pass for this feature slice.
