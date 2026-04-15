# Tasks: Identity & Business Partner Architecture

**Input**: Design documents from `/specs/005-identity-bp-spec/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Included — SC-004 requires automated tenant isolation tests, and this revised task set adds explicit coverage for Thai BP fields, TaxCode defaults, LN role activation, and soft-delete behavior. Runtime invoice VAT changes remain out of scope and are not included in this task list.

**Organization**: Tasks are grouped by implementation phase so the revised BP architecture can be delivered incrementally without mixing in future billing-tax work.

## Format: `[ID] [P?] [Area] Description`

- **[P]**: Can run in parallel
- **[Area]**: Foundation, US1, US2, Contracts, Web, Tests
- Includes exact file paths in descriptions

## Path Conventions

- **Monorepo**: apps/api/ (NestJS), apps/web/ (Next.js), packages/database/ (Prisma), packages/types/ (shared contracts)

---

## Phase 1: Setup

**Purpose**: Validate environment and freeze the revised scope before implementation

- [ ] T001 Confirm feature scope in `specs/005-identity-bp-spec/spec.md` and `specs/005-identity-bp-spec/plan.md`: `TaxCode` is global seeded reference data; invoice runtime VAT changes are deferred

---

## Phase 2: Foundation — Schema, Contracts, and Reference Data

**Purpose**: Realign the schema and shared contracts to the Thai BP architecture before touching service or UI logic

**Critical**: No backend or frontend BP implementation should continue until this phase is complete

- [X] T002 Update `packages/database/prisma/schema.prisma` to add `TaxCode` as a global reference model, add `BpRole` enum, add `BpRoleActive` model, expand `BusinessPartner` with Thai core fields (`taxId`, `isHeadOffice`, `branchCode`, `addressLine1`, `subDistrict`, `district`, `province`, `zipcode`, `parentBpId`, `defaultVatCodeId`, `defaultWhtCodeId`, `creditTermDays`), and simplify `BpSupplier` to extension-only fields
- [X] T003 Generate Prisma migration for the revised BP architecture and regenerate Prisma client from `packages/database/prisma/`
- [X] T004 [P] Update `packages/types/src/enums.ts` to export `BpRole` and any `TaxCode`-type enums needed by API and web
- [X] T005 [P] Rewrite `packages/types/src/api.ts` BP contracts so Thai compliance fields, `TaxCode` default ids, active LN roles, and BP hierarchy live on the `BusinessPartner` payload rather than inside supplier-only fields
- [X] T006 Export all revised BP contracts and enums from `packages/types/src/index.ts`
- [ ] T007 Define or document global `TaxCode` seed data for standard RD-compliant VAT and WHT codes in `packages/database/prisma/` seed assets or the agreed seed location
- [ ] T008 Update `specs/005-identity-bp-spec/contracts/api.md` examples and field definitions to match the revised BP contract and explicitly avoid invoice runtime tax behavior

**Checkpoint**: Schema, client, shared contracts, and contract docs all reflect the Thai BP architecture

---

## Phase 3: User Story 1 — Session and Security Baseline

**Purpose**: Preserve the existing session and login hardening work already required by the feature

- [ ] T009 Update `apps/api/src/common/session/session.service.ts` to preserve dual TTL behavior (12h absolute plus 1h idle)
- [ ] T010 Update `apps/api/src/common/session/session.guard.ts` to preserve idle TTL refresh and absolute-expiry enforcement
- [ ] T011 [P] Update `apps/api/src/modules/identity/services/auth.service.ts` to preserve password policy and optional `businessPartnerId` in the auth/session profile
- [ ] T012 [P] Verify `apps/api/src/modules/identity/services/user.service.ts` still enforces same-clinic BP linkage after the BP schema expansion

**Checkpoint**: Session security remains compliant while the BP model evolves

---

## Phase 4: User Story 2 — Backend Business Partner Architecture

**Purpose**: Implement the revised clinic-scoped BP behavior on top of the new schema and contracts

### DTOs

- [X] T013 [P] Rewrite `apps/api/src/modules/identity/dto/create-business-partner.dto.ts` to validate Thai core BP fields, `TaxCode` ids, `parentBpId`, active role lists, and extension-specific vet or supplier fields
- [X] T014 [P] Rewrite `apps/api/src/modules/identity/dto/update-business-partner.dto.ts` with partial-update validation for the same field set
- [ ] T015 [P] Update `apps/api/src/modules/identity/dto/list-business-partners.dto.ts` to support active/inactive filters and any Thai-ID-oriented search fields required by the revised contract

### Service and Controller

- [X] T016 Update `apps/api/src/modules/identity/services/business-partner.service.ts` to map `BusinessPartner` responses from core Thai BP fields, `TaxCode` defaults, active LN roles, optional hierarchy, and extension-only vet or supplier records
- [X] T017 Update `apps/api/src/modules/identity/services/business-partner.service.ts` create flow to validate same-clinic `parentBpId`, validate global `TaxCode` references, persist `BpRoleActive` rows, and keep strict soft-delete semantics
- [X] T018 Update `apps/api/src/modules/identity/services/business-partner.service.ts` update flow to maintain `TaxCode` links, replace active roles safely, preserve extension invariants, and keep same-clinic linkage rules
- [ ] T019 Update `apps/api/src/modules/identity/controllers/business-partners.controller.ts` to accept the revised payload shape while preserving the current authorization matrix and branch-context enforcement
- [ ] T020 Verify `apps/api/src/modules/identity/identity.module.ts` provider and controller wiring remains correct after DTO and service changes

**Checkpoint**: Backend BP CRUD supports Thai BP defaults, `TaxCode` references, LN roles, and strict soft-delete

---

## Phase 5: User Story 2 — Web Business Partner Experience

**Purpose**: Realign the clinic UI to the revised BP contract without introducing billing-tax runtime logic

### Form and Client Flows

- [ ] T021 Update `apps/web/app/(clinic)/clinic/business-partners/business-partners-client.tsx` to use the revised BP contracts for list, create, edit, and deactivate flows
- [ ] T022 Update `apps/web/components/business-partners/business-partner-form.tsx` to capture Thai BP core fields, `TaxCode` default selections, parent BP selection input if applicable, and active LN roles
- [ ] T023 Update `apps/web/components/business-partners/extension-fields.tsx` so only true extension fields remain there, such as vet license or supplier-specific metadata
- [ ] T024 Update `apps/web/components/business-partners/business-partner-table.tsx` to surface Thai BP identifiers and status correctly in list views
- [ ] T025 [P] Update `apps/web/messages/en.json` with labels and messages for Thai BP fields, `TaxCode` defaults, LN roles, and soft-delete wording
- [ ] T026 [P] Update `apps/web/messages/th.json` with the corresponding Thai translations

**Checkpoint**: The clinic UI matches the revised BP contract and no longer assumes supplier-local tax data

---

## Phase 6: Tests and Verification

**Purpose**: Replace stale tests and verify the revised architecture end to end

### API Tests

- [ ] T027 [P] Rewrite `apps/api/src/modules/identity/services/business-partner.service.spec.ts` to cover Thai BP core fields, global `TaxCode` validation, same-clinic parent linkage, active LN role persistence, and strict soft-delete behavior
- [ ] T028 [P] Rewrite `apps/api/src/modules/identity/controllers/business-partners.controller.spec.ts` to cover revised payloads, role rules, branch-context enforcement, and error cases
- [ ] T029 [P] Verify or extend `apps/api/src/common/session/session.service.spec.ts` and auth-related specs so session/security coverage still passes after contract changes

### Web Tests

- [ ] T030 [P] Rewrite `apps/web/components/business-partners/extension-fields.spec.tsx` and related BP component tests for the new field split between BP core data and extension-only data
- [ ] T031 [P] Update `apps/web/components/business-partners/business-partner-table.spec.tsx` and any BP form tests to cover `TaxCode` selection, LN role rendering, and inactive filtering
- [ ] T032 Update `apps/web/test/e2e/business-partners.spec.ts` to validate BP create, edit, and deactivate behavior with Thai BP defaults only, not invoice runtime VAT calculation

### Final Verification

- [ ] T033 Run the feature quickstart verification flow and confirm there are no remaining references to supplier-local `taxId` or `creditTermDays` in BP shared contracts, DTOs, or UI payloads
- [ ] T034 Run targeted repository searches to confirm the revised implementation introduces `TaxCode`, `defaultVatCodeId`, `defaultWhtCodeId`, and `BpRoleActive` usage where expected, and that `invoice.service.ts` remains unchanged for runtime VAT logic in this phase

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 blocks everything
- Phase 2 blocks backend and frontend BP work
- Phase 3 can proceed in parallel with later BP work once shared contracts are stable
- Phase 4 depends on Phase 2
- Phase 5 depends on Phase 2 and should follow Phase 4 shared contract finalization
- Phase 6 depends on Phases 3, 4, and 5

### Within Phase 2

- T002 → T003
- T002 → T004, T005
- T004 + T005 → T006
- T002 + T003 → T007
- T005 → T008

### Within Phase 4

- T013, T014, T015 can run in parallel
- T013 + T014 + T015 → T016
- T016 → T017, T018
- T017 + T018 → T019
- T019 → T020

### Within Phase 5

- T021 depends on T005 and T019
- T022 depends on T005
- T023 depends on T022
- T024 depends on T021
- T025 and T026 can run in parallel

### Within Phase 6

- T027 and T028 depend on Phase 4
- T030 and T031 depend on Phase 5
- T032 depends on Phases 4 and 5
- T033 and T034 run last

---

## Implementation Strategy

### MVP Scope

Minimum viable delivery for the revised architecture is:

1. Phase 2 complete
2. Phase 4 backend complete
3. Phase 6 API verification complete

This yields a correct API-level Thai BP architecture before frontend polish.

### Incremental Delivery

1. Increment 1: T001-T008 — schema, contracts, and `TaxCode` reference model aligned
2. Increment 2: T009-T012 — session and security baseline preserved
3. Increment 3: T013-T020 — backend BP behavior aligned to Thai BP architecture
4. Increment 4: T021-T026 — web BP UI aligned to revised contracts
5. Increment 5: T027-T034 — tests, E2E, and verification complete

### Recommended Commit Sequence

1. `feat(database): expand business partner schema for Thai core fields and global tax codes`
2. `feat(types): realign BP contracts and enums to tax-code defaults and active roles`
3. `docs(contracts): update BP API contracts for Thai architecture`
4. `feat(api): update BP DTOs and service for tax-code defaults, hierarchy, and active roles`
5. `test(api): rewrite BP API tests for Thai architecture`
6. `feat(web): update BP UI for Thai fields and tax-code defaults`
7. `test(web): realign BP UI and E2E coverage`
