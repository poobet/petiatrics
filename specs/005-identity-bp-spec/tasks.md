# Tasks: Identity & Business Partner Architecture

**Feature**: `005-identity-bp-spec`
**Input**: Design documents from `specs/005-identity-bp-spec/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Included — this task set covers Thai BP fields, TaxCode defaults, LN role activation, soft-delete behavior, session hardening, and tenant isolation. Runtime invoice VAT changes remain out of scope.

**Format**: `- [ ] T### [P?] [US?] Description — exact/file/path`
- `[P]` = parallelizable (independent files, no unmet dependencies)
- `[US1]` = User Story 1 tasks; `[US2]` = User Story 2 tasks
- Setup and foundational tasks carry no story label

---

## Phase 1: Setup

**Goal**: Validate environment and freeze revised scope before any implementation.

- [ ] T001 Confirm feature scope: `TaxCode` is global seeded reference data, invoice runtime VAT changes are deferred — `specs/005-identity-bp-spec/spec.md` and `specs/005-identity-bp-spec/plan.md`

---

## Phase 2: Foundation — Schema, Contracts, and Reference Data

**Goal**: Realign schema and shared contracts to the Thai BP architecture before any service or UI work.

**Critical**: No backend or frontend BP tasks should proceed until this phase is complete.

**Independent test**: `npx prisma db push` errors = 0; `tsc --noEmit` in `packages/types` = 0 errors.

- [X] T002 Update `packages/database/prisma/schema.prisma`: add `TaxCode` global model, `BpRole` enum, `BpRoleActive` model; expand `BusinessPartner` with Thai core fields (`taxId`, `isHeadOffice`, `branchCode`, `addressLine1`, `subDistrict`, `district`, `province`, `zipcode`, `parentBpId`, `defaultVatCodeId`, `defaultWhtCodeId`, `creditTermDays`); simplify `BpSupplier` to extension-only fields
- [X] T003 Generate Prisma migration and regenerate Prisma client from `packages/database/prisma/`
- [X] T004 [P] Export `BpRole` and `TaxCode`-type enums from `packages/types/src/enums.ts`
- [X] T005 [P] Rewrite BP contracts in `packages/types/src/api.ts`: Thai compliance fields, `TaxCode` default ids, active LN roles, BP hierarchy on `BusinessPartner` payload; remove supplier-local `taxId`/`creditTermDays`
- [X] T006 Export all revised BP contracts and enums from `packages/types/src/index.ts`
- [X] T007 Create `TaxCode` seed data for RD-compliant VAT and WHT codes in `packages/database/prisma/seed.ts` (VAT7 7%, VAT0 0%, WHT1 1%, WHT3 3%, WHT5 5%, WHT15 15%)
- [X] T008 Update `specs/005-identity-bp-spec/contracts/api.md`: add `GET /reference/tax-codes` endpoint contract, update all BP examples to Thai architecture fields, remove `whtRate` from all examples

**Checkpoint**: Schema, client, shared contracts, and contract docs all reflect the Thai BP architecture. ✅

**Checkpoint**: Schema, client, shared contracts, and contract docs all reflect the Thai BP architecture.

---

## Phase 3: User Story 1 — Session and Security Baseline

**Goal**: Preserve session and login hardening required by FR-001, FR-002, FR-010, FR-011.

**Story**: As a clinic staff member, I need to log in securely and select my active branch (US1 — P1).

**Independent test**: Login → 200 with branches; idle >1 h → 401; absolute >12 h → 401; wrong branch header → 403; 5 failed attempts → 403 ACCOUNT_LOCKED.

- [X] T009 [US1] Update `apps/api/src/common/session/session.service.ts`: support 12 h absolute TTL + 1 h sliding idle timeout using dual Redis TTL fields (`issuedAt`, idle key)
- [X] T010 [US1] Update `apps/api/src/common/session/session.guard.ts`: refresh idle TTL on every valid authenticated request; reject sessions that exceed the 12 h absolute ceiling
- [X] T011 [P] [US1] Verify `apps/api/src/modules/identity/services/auth.service.ts`: password policy (8 + chars, upper/lower/digit/special), 5-attempt lockout for 15 min, optional `businessPartnerId` in session profile
- [X] T012 [P] [US1] Verify `apps/api/src/modules/identity/services/user.service.ts`: same-clinic BP linkage validation still correct after BP schema expansion

**Checkpoint**: Session security compliant with FR-001, FR-010, FR-011; can be verified independently of BP work.

---

## Phase 4: User Story 2 — Backend Business Partner Architecture

**Goal**: Implement Thai BP CRUD with TaxCode references, LN roles, soft-delete, and tenant isolation (US2 — P1).

**Story**: As a clinic owner or admin, I need to manage Business Partners in a unified interface with Thai tax compliance details and Infor LN roles.

**Independent test**: `POST /clinic/business-partners` → 201 with Thai fields; `PATCH` → 200 with roles replaced; `DELETE` (soft) → BP `isActive = false`; `GET` list excludes inactive; ASSISTANT/VET/CASHIER → 403 on mutating operations.

### DTOs

- [X] T013 [P] [US2] Rewrite `apps/api/src/modules/identity/dto/create-business-partner.dto.ts`: Thai core field validation, `TaxCode` id refs, `parentBpId`, `activeRoles: BpRole[]`, VET/supplier extension fields
- [X] T014 [P] [US2] Rewrite `apps/api/src/modules/identity/dto/update-business-partner.dto.ts`: partial-update validation for same field set; `activeRoles` replaces all existing roles
- [X] T015 [P] [US2] Update `apps/api/src/modules/identity/dto/list-business-partners.dto.ts`: `isActive` filter, `type` filter, optional `taxId` / `name` search — `specs/005-identity-bp-spec/contracts/api.md` list endpoint

### Service

- [X] T016 [US2] Update response mapping in `apps/api/src/modules/identity/services/business-partner.service.ts`: core Thai BP fields, `TaxCode` defaults, active LN roles, optional hierarchy, extension records (`BpVet`, `BpSupplier`)
- [X] T017 [US2] Update create flow in `apps/api/src/modules/identity/services/business-partner.service.ts`: validate same-clinic `parentBpId`; validate global `TaxCode` refs via `assertTaxCodeExists`; persist `BpRoleActive` rows; strict soft-delete semantics
- [X] T018 [US2] Update update flow in `apps/api/src/modules/identity/services/business-partner.service.ts`: replace active roles safely; maintain `TaxCode` links; preserve extension invariants; enforce same-clinic linkage

### Controller, Reference Endpoint, and Module

- [X] T019 [US2] Update `apps/api/src/modules/identity/controllers/business-partners.controller.ts`: wire revised Thai BP payload; preserve authorization matrix (SUPER_ADMIN / CLINIC_OWNER / STAFF write; VET / CASHIER / ASSISTANT read-only per FR-009, FR-015); enforce `x-active-branch` guard
- [X] T020 [US2] Verify `apps/api/src/modules/identity/identity.module.ts`: provider and controller wiring correct after all DTO and service changes
- [X] T035 [US2] Implement `GET /reference/tax-codes` in `apps/api/src/modules/identity/controllers/reference.controller.ts`: return all active `TaxCode` records as `TaxCodeResponse[]`; no clinic scoping; all authenticated roles may read

**Checkpoint**: Backend BP CRUD supports Thai BP defaults, `TaxCode` references, LN roles, strict soft-delete, and correct role-based authorization.

---

## Phase 5: User Story 2 — Web Business Partner Experience

**Goal**: Align clinic UI to the revised BP contract (US2 — P1).

**Story**: Clinic-facing forms and list views for Thai BP management.

**Independent test**: Form create cycle succeeds; TaxCode dropdowns populate from `GET /reference/tax-codes`; LN role checkboxes persist correctly; business-partner table excludes soft-deleted rows.

- [X] T022 [US2] Rewrite `apps/web/components/business-partners/business-partner-form.tsx`: 7-section Thai BP form; TaxCode VAT/WHT selectors (empty-string state, no `SelectItem value=""`); `BpRole` checkbox grid; conditional VET `ExtensionFields`
- [X] T023 [US2] Rewrite `apps/web/components/business-partners/extension-fields.tsx`: VET-only (`licenseNumber`); remove `whtRate` and all supplier-specific fields
- [X] T025 [P] [US2] Update `apps/web/messages/en.json`: labels for Thai BP fields, TaxCode defaults, LN roles (`roles.*` keys), soft-delete wording, `common.clear`
- [X] T026 [P] [US2] Update `apps/web/messages/th.json`: corresponding Thai translations for all BP i18n keys
- [X] T021 [US2] Update `apps/web/app/(clinic)/clinic/business-partners/business-partners-client.tsx`: use revised BP contracts for list, create, edit, and deactivate flows; depends on T019 and T035
- [X] T024 [US2] Update `apps/web/components/business-partners/business-partner-table.tsx`: display Thai BP identifiers (`taxId`, `type` badge), `isActive` status; exclude inactive rows from default list view
- [ ] T036 [US2] Add `parentBpId` searchable selector to `apps/web/components/business-partners/business-partner-form.tsx`: fetch same-clinic BPs where `isHeadOffice = true`; pre-populate on edit; allow clear to `null`

**Checkpoint**: Clinic UI matches revised BP contract; no supplier-local `taxId` or `creditTermDays` assumptions remain in web layer.

---

## Phase 6: Tests and Final Verification

**Goal**: Validate the full revised architecture with automated and manual coverage.

**Independent test**: `npm --prefix apps/api test` = 0 failures; `npm --prefix apps/web test` = 0 failures; Playwright BP E2E = green.

### API Tests

- [ ] T027 [P] Rewrite `apps/api/src/modules/identity/services/business-partner.service.spec.ts`: Thai BP core fields, global `TaxCode` validation, same-clinic `parentBpId` linkage, `BpRoleActive` persistence, strict soft-delete
- [ ] T028 [P] Rewrite `apps/api/src/modules/identity/controllers/business-partners.controller.spec.ts`: revised payloads, role-authorization matrix, `x-active-branch` enforcement, error cases (400/403/404)
- [ ] T029 [P] Verify `apps/api/src/common/session/session.service.spec.ts` and related auth specs: 12 h absolute TTL, 1 h idle TTL, lockout after 5 failed attempts

### Web Tests

- [X] T030 [P] Rewrite `apps/web/components/business-partners/extension-fields.spec.tsx`: VET-only field rendering, `licenseNumber` validation
- [X] T031 [P] Update `apps/web/components/business-partners/business-partner-table.spec.tsx` and BP form tests: TaxCode selection, LN role rendering, inactive row filtering
- [ ] T032 Update `apps/web/test/e2e/business-partners.spec.ts`: BP create / edit / deactivate with Thai BP defaults; verify ASSISTANT/VET cannot mutate; no invoice runtime VAT scenarios

### Final Verification

- [ ] T033 Run quickstart verification flow (`npm run db:migrate` → `npm run dev` → manual BP CRUD steps in `quickstart.md` section 5): confirm no remaining references to supplier-local `taxId` or `creditTermDays` in BP contracts, DTOs, or UI
- [ ] T034 Repository search: confirm `TaxCode`, `defaultVatCodeId`, `defaultWhtCodeId`, `BpRoleActive` appear where expected; confirm `apps/api/src/modules/billing/services/invoice.service.ts` is unchanged (runtime VAT deferred)
- [ ] T034 Run targeted repository searches to confirm the revised implementation introduces `TaxCode`, `defaultVatCodeId`, `defaultWhtCodeId`, and `BpRoleActive` usage where expected, and that `invoice.service.ts` remains unchanged for runtime VAT logic in this phase

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 → blocks everything
Phase 2 → blocks Phases 4 and 5; Phase 3 can start once shared contracts (T004/T005) are stable
Phase 3 → can run in parallel with Phase 4 once T004/T005 done
Phase 4 → T013–T018 done; gates Phase 5
Phase 5 → gates Phase 6 web tests
Phase 6 → all implementation phases complete
```

### Within Phase 2

- T002 → T003
- T002 → T004 [P], T005 [P]
- T004 + T005 → T006
- T002 + T003 → T007
- T005 → T008 *(done)*

### Within Phase 4

- T013 [P], T014 [P], T015 [P] run in parallel
- T013 + T014 + T015 → T016
- T016 → T017, T018
- T017 + T018 → T019
- T019 → T020
- T019 + T007 → T035 *(T035 gates T021)*

### Within Phase 5

- T021 depends on T019 + T035
- T022 *(done)* depended on T005
- T023 *(done)* depended on T022
- T024 depends on T021
- T025 [P] and T026 [P] *(done)*
- T036 depends on T021 (P2 enhancement, can defer post-MVP)

### Within Phase 6

- T027 [P] and T028 [P] depend on Phase 4 complete
- T029 [P] depends on Phase 3 complete
- T030 [P] and T031 [P] depend on Phase 5 complete
- T032 depends on Phases 4 and 5 complete
- T033 and T034 run last

---

## Parallel Execution Examples

**US2 Backend Sprint (after T002/T003 done)**:
- Track A: T013 → T015 → T016 → T017 → T018 → T019 → T020
- Track B: T014 *(parallel to T013)*
- Track C: T035 *(once T019 controllers are wired)*

**US2 Frontend Sprint (after T019 + T035 done)**:
- Track A: T021 → T024
- Track B: T036 *(independent form enhancement)*

---

## Implementation Strategy

### MVP Scope

Minimum viable delivery (unblocks UAT):

1. Phase 2 complete — T007 (seed) is the only remaining item
2. Phase 4 complete — T015, T019, T020, T035 are the open items
3. T021 complete — client.tsx wired to revised contracts

This yields a testable Thai BP API + UI before adding test coverage.

### P0 (blocks UAT)

**Open tasks that block end-to-end testing**:
- T019 — controller wiring + authorization matrix (ASSISTANT guard)
- T035 — `GET /reference/tax-codes` endpoint (gates TaxCode dropdowns in form)
- T021 — `business-partners-client.tsx` (client-side list/create/edit flows)

### Incremental Delivery

| Increment | Tasks | Deliverable |
|-----------|-------|-------------|
| 1 | T001–T008 | Schema, contracts, TaxCode aligned *(mostly done)* |
| 2 | T009–T012 | Session and security baseline preserved |
| 3 | T013–T020, T035 | Full backend Thai BP CRUD + reference endpoint |
| 4 | T021–T026, T036 | Web UI aligned to revised contracts |
| 5 | T027–T034 | Tests, E2E, and final verification |

### Recommended Commit Sequence

1. `feat(database): add TaxCode seed data`
2. `feat(api): wire BP controller, authorization matrix, and GET /reference/tax-codes`
3. `feat(web): update business-partners-client and table for Thai BP contracts`
4. `feat(web): add parentBpId selector to BP form`
5. `test(api): rewrite BP service and controller specs for Thai architecture`
6. `test(web): realign BP UI and E2E coverage`
7. `chore: run quickstart verification and final repository search`
