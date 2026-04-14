# Tasks: Identity & Business Partner Architecture

**Input**: Design documents from `/specs/005-identity-bp-spec/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Included — spec success criteria SC-004 requires automated tenant isolation tests, and the plan explicitly includes test phases (B8, C7, D3).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Includes exact file paths in descriptions

## Path Conventions

- **Monorepo**: apps/api/ (NestJS), apps/web/ (Next.js), packages/database/ (Prisma), packages/types/ (shared contracts)

---

## Phase 1: Setup

**Purpose**: Validate environment for feature work

- [X] T001 Checkout branch `005-identity-bp-spec` and run `npm install` from repo root

---

## Phase 2: Foundational (Schema & Shared Types)

**Purpose**: Database schema, migration, and shared type contracts that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Add `BpType` enum, `BusinessPartner` model, `BpVet` model, `BpSupplier` model, optional `businessPartnerId` relation on `User`, and composite indexes in `packages/database/prisma/schema.prisma`
- [X] T003 Generate Prisma migration (`005-identity-business-partners`) and regenerate Prisma client from `packages/database/prisma/`
- [X] T004 [P] Add `BusinessPartnerType` enum and re-export `BpType` discriminator values in `packages/types/src/enums.ts`
- [X] T005 [P] Add BP request/response DTOs (`CreateBusinessPartnerPayload`, `UpdateBusinessPartnerPayload`, `BusinessPartnerListQuery`, `BusinessPartnerResponse`, `BpVetPayload`, `BpSupplierPayload`) and extend `AuthProfile` with optional `businessPartnerId` in `packages/types/src/api.ts`
- [X] T006 Export all new BP contracts and enums from `packages/types/src/index.ts`

**Checkpoint**: Schema migrated, Prisma client regenerated, shared types importable by both apps

---

## Phase 3: User Story 1 — Clinic Login & Branch Selection (Priority: P1) 🎯 MVP

**Goal**: Harden the existing auth/session stack with idle timeout, absolute expiry enforcement, and complete password policy — ensuring zero-trust session validation on every request.

**Independent Test**: Log in via UI, stay idle for >1 hour, confirm 401 on next request. Change password and verify special-character enforcement. Trigger 5 failed logins and verify 15-minute lockout.

### Implementation for User Story 1

- [X] T007 [US1] Add `issuedAt` field to session payload and implement dual-TTL logic (12h absolute check + 1h idle Redis TTL) in `apps/api/src/common/session/session.service.ts`
- [X] T008 [US1] Refresh idle TTL on valid authenticated requests and reject sessions exceeding 12h absolute expiry in `apps/api/src/common/session/session.guard.ts`
- [X] T009 [P] [US1] Add special-character requirement to password validation regex and server-side enforcement on create/change flows in `apps/api/src/modules/identity/services/auth.service.ts`
- [X] T010 [P] [US1] Verify and complete account lockout logic (5 consecutive failures → 15-minute lock, auto-unlock after expiry) in `apps/api/src/modules/identity/services/auth.service.ts`

### Tests for User Story 1

- [X] T011 [P] [US1] Add integration tests for session idle timeout, absolute expiry, and TTL refresh behaviour in `apps/api/src/common/session/session.service.spec.ts`
- [X] T012 [P] [US1] Add integration tests for password policy enforcement (special char) and account lockout (5 attempts, 15min) in `apps/api/src/modules/identity/services/auth.service.spec.ts`

**Checkpoint**: Login flow enforces idle timeout, absolute expiry, special-character passwords, and lockout — all testable without BP data

---

## Phase 4: User Story 2 — Business Partner Management (Priority: P1)

**Goal**: Deliver clinic-facing CRUD for Business Partners (Customer, Staff, Vet, Supplier) with role-based authorization, extension-specific forms, soft-delete, and tenant isolation — enabling the foundational master-data layer for all future billing, procurement, and clinical workflows.

**Independent Test**: Log in as CLINIC_OWNER → create Customer BP (no user link) → create Vet BP with license → create Supplier BP with tax ID → edit a BP → soft-delete a BP → confirm inactive BP excluded from active list → log in as VET role → confirm read-only access.

### Backend — DTOs

- [X] T013 [P] [US2] Create `CreateBusinessPartnerDto` with class-validator rules and conditional vet/supplier extension validation in `apps/api/src/modules/identity/dto/create-business-partner.dto.ts`
- [X] T014 [P] [US2] Create `UpdateBusinessPartnerDto` with partial update rules and conditional extension validation in `apps/api/src/modules/identity/dto/update-business-partner.dto.ts`
- [X] T015 [P] [US2] Create `ListBusinessPartnersDto` with optional `type`, `search`, and `includeInactive` query filters in `apps/api/src/modules/identity/dto/list-business-partners.dto.ts`

### Backend — Service & Controller

- [X] T016 [US2] Implement `BusinessPartnerService` with clinic-scoped create, list (active-only default), getById (include inactive for management), update, and soft-delete methods using Prisma transactions for extension tables in `apps/api/src/modules/identity/services/business-partner.service.ts`
- [X] T017 [US2] Implement `BusinessPartnerController` with `@Roles()` enforcement (SUPER_ADMIN/CLINIC_OWNER/STAFF for write, all authenticated for read) and branch-context guard on all routes in `apps/api/src/modules/identity/controllers/business-partners.controller.ts`
- [X] T018 [US2] Register `BusinessPartnerService` and `BusinessPartnerController` in providers and controllers arrays in `apps/api/src/modules/identity/identity.module.ts`

### Backend — User-BP Linkage & Auth Profile

- [X] T019 [US2] Add optional `businessPartnerId` to auth profile response and session payload in `apps/api/src/modules/identity/services/auth.service.ts`
- [X] T020 [US2] Add user-to-BP linking and unlinking support (same-clinic validation) in `apps/api/src/modules/identity/services/user.service.ts`

### Backend Tests

- [X] T021 [P] [US2] Add integration tests for BP CRUD, authorization matrix (write vs read-only roles), tenant isolation (cross-clinic rejection), and soft-delete behaviour in `apps/api/src/modules/identity/services/business-partner.service.spec.ts`
- [X] T022 [P] [US2] Add controller integration tests for endpoint routing, role guards, branch-context enforcement, and error responses in `apps/api/src/modules/identity/controllers/business-partners.controller.spec.ts`

### Frontend — i18n

- [X] T023 [P] [US2] Add Business Partner UI strings (page titles, form labels, table headers, action buttons, error messages, type labels) to `apps/web/messages/en.json`
- [X] T024 [P] [US2] Add Thai Business Partner UI strings to `apps/web/messages/th.json`

### Frontend — Routes & Components

- [X] T025 [US2] Create BP list server route page with metadata in `apps/web/app/(clinic)/clinic/business-partners/page.tsx`
- [X] T026 [US2] Create BP client UI shell with list/create/edit state management, API calls via api-client, and role-based action visibility in `apps/web/app/(clinic)/clinic/business-partners/business-partners-client.tsx`
- [X] T027 [P] [US2] Create BP data table component with columns (name, type, status, linked user, actions), active/inactive filtering, and search in `apps/web/components/business-partners/business-partner-table.tsx`
- [X] T028 [P] [US2] Create BP form component with dynamic extension fields by type (vet: license/whtRate, supplier: taxId/creditTermDays), optional user-link selector, and validation in `apps/web/components/business-partners/business-partner-form.tsx`
- [X] T029 [P] [US2] Create extension fields sub-component rendering vet-specific and supplier-specific fields conditionally based on selected BP type in `apps/web/components/business-partners/extension-fields.tsx`

### Frontend Tests

- [X] T030 [P] [US2] Add component tests for BP form conditional fields by type and read-only UI states for VET/CASHIER/ASSISTANT roles in `apps/web/components/business-partners/`

**Checkpoint**: Full BP CRUD operational via API and clinic web UI; all roles correctly enforced; tenant isolation verified

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Contract validation, end-to-end coverage, and final verification

- [X] T031 [P] Update contract validation manifests to include BP endpoints in `apps/api/scripts/validate-contracts.js` and `apps/web/scripts/validate-contracts.mjs` if applicable
- [X] T032 Add Playwright E2E test for login → branch selection → create BP → edit BP → soft-delete BP → verify read-only role rejection in `apps/web/test/e2e/` or existing Playwright location
- [X] T033 Run full quickstart.md verification steps (manual and automated) to confirm feature completeness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion — can start independently of US2
- **US2 (Phase 4)**: Depends on Phase 2 completion — can start independently of US1 (backend DTOs/service/controller do not depend on session changes)
- **Polish (Phase 5)**: Depends on Phase 3 and Phase 4 completion

### User Story Dependencies

- **US1 (Clinic Login & Branch Selection)**: Depends only on Phase 2. No dependency on US2.
- **US2 (Business Partner Management)**: Depends only on Phase 2. No dependency on US1 session changes (BP CRUD does not require idle timeout to function). However, T019 (auth profile extension) benefits from T007 session payload changes being in place.

### Within Each User Story

```
Phase 2 (Foundational):
  T002 → T003 → T006
  T002 ──┬── T004 ──┐
         └── T005 ──┴── T006

Phase 3 (US1):
  T007 → T008
  T009 ┐
  T010 ┤ (parallel, independent files)
  T011 ┤
  T012 ┘

Phase 4 (US2) Backend:
  T013 ┐
  T014 ┤ (parallel DTOs)
  T015 ┘
    ↓
  T016 → T017 → T018
  T019 (after T016)
  T020 (after T016)
  T021, T022 (parallel tests, after T017)

Phase 4 (US2) Frontend:
  T023, T024 (parallel i18n, can start early)
  T027, T028, T029 (parallel components)
    ↓
  T025 → T026 (route depends on components)
  T030 (tests, after components)
```

### Parallel Opportunities

**Within Phase 2**: T004 and T005 can run in parallel after T002/T003 completes.

**Between User Stories**: US1 and US2 can proceed in parallel after Phase 2 completes, by different developers or in interleaved sessions.

**Within US2 Backend**: T013, T014, T015 (all DTOs) can run in parallel; T021, T022 (tests) can run in parallel.

**Within US2 Frontend**: T023/T024 (i18n) parallel; T027/T028/T029 (components) parallel; T025/T026 (route assembly) sequential after components.

**Cross-app within US2**: Backend work (T013–T022) and frontend i18n/component scaffolding (T023–T029) can proceed in parallel since components can be built against the shared type contracts before the API is running.

---

## Implementation Strategy

### MVP Scope

**Minimum Viable Feature**: Phase 2 + Phase 3 (US1) delivers hardened session security on the existing login flow. Add Phase 4 backend tasks (T013–T022) for API-level BP management. This provides a fully functional and testable API without frontend.

### Incremental Delivery

1. **Increment 1**: T001–T006 (Foundational) — schema and types ready
2. **Increment 2**: T007–T012 (US1) — session hardening complete
3. **Increment 3**: T013–T022 (US2 Backend) — BP API operational
4. **Increment 4**: T023–T030 (US2 Frontend) — clinic BP UI live
5. **Increment 5**: T031–T033 (Polish) — contracts validated, E2E passing

### Recommended Commit Sequence

1. `feat(database): add business partner schema and relations` (T002–T003)
2. `feat(types): add business partner API contracts` (T004–T006)
3. `feat(api): implement session idle timeout and password policy updates` (T007–T010)
4. `test(api): cover session expiry and password policy` (T011–T012)
5. `feat(api): add business partner service and controller` (T013–T020)
6. `test(api): cover BP authz tenant isolation and soft-delete` (T021–T022)
7. `feat(web): add business partner clinic routes and components` (T023–T029)
8. `test(web): cover BP forms and read-only modes` (T030)
9. `test(e2e): add login branch and BP management flow` (T031–T033)
