# Tasks: First Vertical Slice — Auth, Session Management, Role-Based Routing & Branch Context

**Input**: Design documents from `/specs/002-first-vertical-slice/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **API app**: `apps/api/src/`
- **Web app**: `apps/web/`
- **Database package**: `packages/database/`
- **Types package**: `packages/types/src/`

---

## Phase 1: Setup (Schema & Type Migration)

**Purpose**: Migrate the existing 001 role enum and Prisma schema to the approved 002 data model with Branch and UserBranch support.

- [X] T001 [P] Update Role enum to 002 canonical values (SUPER_ADMIN, CLINIC_OWNER, VET, ASSISTANT, CASHIER, STAFF) in packages/types/src/enums.ts
- [X] T002 [P] Add Branch and UserBranch models, update Role enum to 002 values, and add clinic-branch relations in packages/database/prisma/schema.prisma
- [X] T003 [P] Add AuthProfile, BranchSummary, and expanded UserContext types with authorizedBranches in packages/types/src/api.ts
- [X] T004 Generate and apply Prisma migration for Branch, UserBranch, and Role enum changes in packages/database/prisma/migrations/
- [X] T005 Update seed script with 002 role values, at least one clinic with two branches, one single-branch user, one multi-branch user, and one SUPER_ADMIN in packages/database/src/seed.ts

**Dependencies**: T001, T002, T003 are parallel (different files). T004 depends on T002. T005 depends on T004.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented — session expansion, branch guard, client-side store, and API client update.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Expand SessionService to store and retrieve authorizedBranches and clinicName in session payload in apps/api/src/common/session/session.service.ts
- [X] T007 [P] Create BranchContextGuard that validates x-active-branch header against session authorizedBranches and injects activeBranchId into request context in apps/api/src/common/guards/branch-context.guard.ts
- [X] T008 [P] Create Zustand session/branch store with user profile, authorizedBranches, activeBranch state, setBranch action, hydrate action, and clear action in apps/web/lib/session-store.ts
- [X] T009 Update api-client to read activeBranch from Zustand store, inject x-active-branch header on all requests, and redirect to /login on 401 responses in apps/web/lib/api-client.ts

**Dependencies**: T006, T007, T008 are parallel (different files, different apps). T009 depends on T008 (imports the store).

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Clinic Staff Logs In Securely (Priority: P1) 🎯 MVP

**Goal**: A clinic staff member can log in with email/password, receive a secure HttpOnly session cookie, and land on their role-appropriate dashboard with branches loaded.

**Independent Test**: Submit valid credentials on `/login` and verify the browser receives a Secure cookie and the user lands on the correct role-based dashboard.

### Implementation for User Story 1

- [X] T010 [US1] Update AuthService.login to load user's authorized branches (via UserBranch→Branch join) and clinic name, then store expanded payload (authorizedBranches, clinicName) in the Redis session in apps/api/src/modules/identity/services/auth.service.ts
- [X] T011 [US1] Update AuthController.login to set cookie with SameSite=Strict (was Lax), return AuthProfile response shape with id, email, role, clinicName, and branches array in apps/api/src/modules/identity/controllers/auth.controller.ts
- [X] T012 [US1] Update AuthController.me to return the expanded AuthProfile (with branches and clinicName from session) matching the login response shape in apps/api/src/modules/identity/controllers/auth.controller.ts
- [X] T013 [US1] Update login page to use 002 role routing (SUPER_ADMIN → /admin/dashboard, others → /clinic/dashboard), hydrate Zustand session store on successful login, and show loading/error states in apps/web/app/(auth)/login/page.tsx

**Dependencies**: T010 first (service changes), then T011 and T012 (controller changes, same file — sequential). T013 depends on T008 (Zustand store) and can run in parallel with T010–T012 if the store API shape is known.

**Checkpoint**: At this point, User Story 1 should be fully functional — a user can log in, get a session cookie, and be redirected to their role dashboard.

---

## Phase 4: User Story 2 — Protected Routes Redirect Unauthenticated Visitors (Priority: P1)

**Goal**: Any visitor without a valid session is redirected to /login before any protected content renders. Authenticated users who visit the wrong portal are redirected to their correct dashboard.

**Independent Test**: Clear browser cookies and navigate to `/clinic/dashboard` — verify immediate redirect to `/login` without any protected content flash.

### Implementation for User Story 2

- [X] T014 [US2] Update Next.js middleware to protect /admin, /clinic, and /pet-owner route groups by checking session cookie presence and redirecting to /login when absent in apps/web/middleware.ts
- [X] T015 [P] [US2] Update (admin) layout to call GET /auth/me for authoritative role verification, redirect non-SUPER_ADMIN users to /clinic/dashboard, and pass user profile to children in apps/web/app/(admin)/layout.tsx
- [X] T016 [P] [US2] Update (clinic) layout to call GET /auth/me for authoritative role verification, redirect SUPER_ADMIN users to /admin/dashboard, and pass user profile to children in apps/web/app/(clinic)/layout.tsx
- [X] T017 [P] [US2] Create placeholder admin dashboard displaying user name, role, and logout button in apps/web/app/(admin)/admin/dashboard/page.tsx
- [X] T018 [P] [US2] Create placeholder clinic dashboard displaying user name, role, clinic name, active branch name, and logout button in apps/web/app/(clinic)/dashboard/page.tsx

**Dependencies**: T014 first (middleware). T015 and T016 are parallel (different layout files). T017 and T018 are parallel (different dashboard files) and depend on their respective layouts (T015, T016).

**Checkpoint**: At this point, User Stories 1 AND 2 should both work — login, route protection, and role-based redirects are all functional.

---

## Phase 5: User Story 3 — Branch Selector Adapts to User's Access Profile (Priority: P2)

**Goal**: Multi-branch users see a dropdown to switch branches; single-branch users are auto-assigned. All API calls carry the active branch in the x-active-branch header automatically.

**Independent Test**: Log in as a multi-branch seed user — verify the branch selector appears and that selecting a branch updates the x-active-branch header on subsequent API calls. Log in as a single-branch user — verify no selector is shown.

### Implementation for User Story 3

- [X] T019 [US3] Create BranchSelector dropdown component that reads authorizedBranches from Zustand store, hides when single-branch, and calls setBranch action on selection in apps/web/components/layout/branch-selector.tsx
- [X] T020 [US3] Integrate BranchSelector into top navigation and display user name and role in the app shell in apps/web/components/layout/app-shell.tsx
- [X] T021 [US3] Add GET /inventory/test verification endpoint guarded by BranchContextGuard that returns clinicId and activeBranchId from request context in apps/api/src/modules/inventory/controllers/branch-test.controller.ts
- [X] T022 [US3] Register branch-test controller and import BranchContextGuard in inventory module in apps/api/src/modules/inventory/inventory.module.ts

**Dependencies**: T019 depends on T008 (Zustand store). T020 depends on T019. T021 depends on T007 (BranchContextGuard). T022 depends on T021.

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work — login, route protection, and branch context are functional. The verification endpoint confirms branch context flows end-to-end.

---

## Phase 6: User Story 4 — User Logs Out and Session Is Invalidated (Priority: P2)

**Goal**: A user can log out, destroying the server-side session and clearing all client state. Replaying the old session cookie returns 401.

**Independent Test**: Log in, log out, then navigate to a protected route — verify redirect to /login. Replay the old cookie value in a manual request — verify 401 response.

### Implementation for User Story 4

- [X] T023 [US4] Update AuthController.logout to destroy session via SessionService, clear cookie with matching SameSite=Strict/HttpOnly/Secure attributes, and return 204 in apps/api/src/modules/identity/controllers/auth.controller.ts
- [X] T024 [US4] Add logout handler to app shell navigation that calls POST /auth/logout, clears Zustand store, and redirects to /login in apps/web/components/layout/app-shell.tsx

**Dependencies**: T023 is independent (API-side). T024 depends on T020 (app shell exists) and T008 (Zustand store).

**Checkpoint**: All four user stories are now complete — login, route protection, branch switching, and logout are all functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, and verification across all user stories.

- [X] T025 [P] Verify TypeScript compilation across all packages (npx turbo build) and fix any type errors from the enum/type migration
- [X] T026 [P] Validate OpenAPI contract (specs/002-first-vertical-slice/contracts/api.openapi.yaml) against actual API response shapes
- [X] T027 Run quickstart.md manual verification flow end-to-end and fix any issues found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3, P1)**: Depends on Phase 2 — MVP target
- **US2 (Phase 4, P1)**: Depends on Phase 2. Can start in parallel with US1 (middleware/layouts are independent files), but full testing requires US1 login working
- **US3 (Phase 5, P2)**: Depends on Phase 2. Can start in parallel with US1/US2 for component creation, but integration testing requires login working
- **US4 (Phase 6, P2)**: Depends on Phase 2 and US3 (needs app shell from T020). Lightweight — only 2 tasks
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2. No dependencies on other stories. **MVP target.**
- **US2 (P1)**: Can start after Phase 2. Layouts call /auth/me (from US1's T012) but can be coded independently. Full validation requires US1 working.
- **US3 (P2)**: Can start after Phase 2. Branch selector and verification endpoint are independent of US1/US2 coding. Full E2E validation requires login (US1) working.
- **US4 (P2)**: Can start after Phase 2. Logout button lives in app shell (created in US3 T020). If doing sequential delivery, implement after US3.

### Within Each User Story

- Service changes before controller changes
- API changes and web changes can proceed in parallel if interface shape is agreed
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T001, T002, T003 are all parallel (different files)
- Phase 2: T006, T007, T008 are all parallel (different files, different apps)
- Phase 3: API tasks (T010–T012) and web task (T013) can overlap if store API is agreed
- Phase 4: T015+T016 parallel, T017+T018 parallel
- Phase 5: T021+T022 (API) can parallel with T019 (web component)
- Cross-story: Once Phase 2 is done, US1 API + US2 middleware + US3 web component can all start concurrently

---

## Parallel Example: Phase 1 (Setup)

```
# All three type/schema changes in parallel:
T001: "Update Role enum to 002 values in packages/types/src/enums.ts"
T002: "Add Branch/UserBranch models in packages/database/prisma/schema.prisma"
T003: "Add AuthProfile/BranchSummary types in packages/types/src/api.ts"

# Then sequential:
T004: "Generate and apply Prisma migration"
T005: "Update seed script"
```

## Parallel Example: Phase 2 (Foundational)

```
# All three infrastructure pieces in parallel:
T006: "Expand SessionService in apps/api/src/common/session/session.service.ts"
T007: "Create BranchContextGuard in apps/api/src/common/guards/branch-context.guard.ts"
T008: "Create Zustand store in apps/web/lib/session-store.ts"

# Then:
T009: "Update api-client in apps/web/lib/api-client.ts" (depends on T008)
```

## Parallel Example: Cross-Story (after Phase 2)

```
# Developer A (US1): T010 → T011 → T012 → T013
# Developer B (US2): T014 → T015 + T016 → T017 + T018
# Developer C (US3): T019 → T020; T021 → T022
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + type migration + seed)
2. Complete Phase 2: Foundational (session, guard, store, api-client)
3. Complete Phase 3: User Story 1 (login flow end-to-end)
4. **STOP and VALIDATE**: User can log in, get a cookie, see their dashboard
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Add US1 (Login) → Test independently → **MVP!**
3. Add US2 (Route Protection) → Test independently → Routes are protected
4. Add US3 (Branch Selector) → Test independently → Branch context flows end-to-end
5. Add US4 (Logout) → Test independently → Full auth lifecycle complete
6. Phase 7 (Polish) → Contract validation, manual verification, cleanup
7. Each story adds value without breaking previous stories

### Suggested MVP Scope

US1 (Clinic Staff Logs In Securely) is the MVP target. It delivers the minimum path: login → session → dashboard redirect. All other stories build on this foundation.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- The existing session cookie name (`petiatrics_sid`) is preserved — only attributes (SameSite, Secure) are tightened
- The 001→002 role enum migration (T001, T002) will break any code still referencing old role values — T025 catches remaining issues
