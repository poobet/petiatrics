# Tasks: Clinic Onboarding, Staff Creation, and Dual Authentication

**Input**: Design documents from `/specs/003-clinic-onboarding-staff/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification — test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Schema migration, shared types, and seed updates that all subsequent phases depend on.

- [X] T001 Extend `ClinicStatus` enum with `PENDING` and `REJECTED`, extend `UserStatus` enum with `PENDING`, add `slug String @unique` and `phone String?` to `Clinic` model, add `name String`, `username String? @unique`, `mustChangePassword Boolean @default(false)` to `User` model, make `email String? @unique` (nullable) in `packages/database/prisma/schema.prisma`
- [X] T002 Generate Prisma migration with backfill SQL: slug backfill from existing clinic names (slugify + unique suffix), name backfill for existing users (default empty then NOT NULL), email DROP NOT NULL — run `npx prisma migrate dev --name 003-clinic-onboarding-auth` then `npx prisma generate` in `packages/database/prisma/`
- [X] T003 [P] Add `PENDING` and `REJECTED` to `ClinicStatus` enum and `PENDING` to `UserStatus` enum in `packages/types/src/enums.ts`
- [X] T004 [P] Make `email` optional (`email?: string | null`), add `username?: string | null` and `mustChangePassword?: boolean` to `UserContext` and `AuthProfile` interfaces in `packages/types/src/api.ts`
- [X] T005 Update seed to set `slug` on seeded clinic, `name` and `username` on seeded staff user, add a `PENDING` clinic+owner for testing in `packages/database/src/seed.ts`

**Checkpoint**: Schema migrated, Prisma client regenerated, shared types updated. All packages compile. Foundation ready — user story implementation can now begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend service infrastructure that ALL user stories depend on — identifier resolution in auth, slug generation in clinic service, session backfill.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Add slug generation helper function (lowercase, replace non-alphanumeric with hyphens, strip leading/trailing, cap at 50 chars, numeric suffix retry up to 9, then nanoid(4) fallback) to `apps/api/src/modules/identity/services/clinic.service.ts`
- [X] T007 Replace `LoginDto.email` with `LoginDto.identifier` and implement identifier resolution logic (split on `@`, lookup clinic by slug, branch to username vs email path) in `apps/api/src/modules/identity/services/auth.service.ts`
- [X] T008 Add `PENDING` user status check in login flow — throw 401 for PENDING/INACTIVE/LOCKED users in `apps/api/src/modules/identity/services/auth.service.ts`
- [X] T009 Include `mustChangePassword`, `username`, and nullable `email` in session context written to Redis in `apps/api/src/modules/identity/services/auth.service.ts`
- [X] T010 [P] Add `mustChangePassword: false` to the session backfill block for pre-migration sessions in `apps/api/src/common/session/session.service.ts`

**Checkpoint**: Auth service resolves both email and username paths. Slug generation is available. Session includes mustChangePassword. All foundational services ready.

---

## Phase 3: User Story 1 — Guest Requests Clinic Registration (Priority: P1) 🎯 MVP

**Goal**: A guest can submit a clinic registration request from a public page. The system creates a PENDING clinic+owner and shows a confirmation.

**Independent Test**: Submit the registration form at `/register`, verify PENDING clinic and owner rows exist in the database, verify no session cookie is issued, verify the UI shows a "pending review" confirmation.

### Implementation for User Story 1

- [X] T011 [US1] Add `registerRequest(dto: RegisterRequestDto)` method to `ClinicService` — create clinic with `status=PENDING`, auto-generate slug, create owner user with `status=PENDING`, hash password, wrap in `$transaction`, emit audit event in `apps/api/src/modules/identity/services/clinic.service.ts`
- [X] T012 [US1] Create `RegisterRequestDto` with class-validator decorators (clinicName, taxId, address, ownerName, ownerEmail, password, phone) in `apps/api/src/modules/identity/dto/register-request.dto.ts`
- [X] T013 [US1] Add `@Public() @Throttle({ default: { ttl: 900000, limit: 5 } }) @Post('register-request')` endpoint calling `clinicService.registerRequest()` in `apps/api/src/modules/identity/controllers/auth.controller.ts`
- [X] T014 [US1] Update `LoginDto` from `email` field to `identifier` field with class-validator decorators in `apps/api/src/modules/identity/controllers/auth.controller.ts`
- [X] T015 [P] [US1] Add `/register` to `PUBLIC_PATHS` array in `apps/web/middleware.ts`
- [X] T016 [P] [US1] Add i18n keys for registration page (`auth.register.title`, `auth.register.clinicName`, `auth.register.taxId`, `auth.register.address.*`, `auth.register.ownerName`, `auth.register.ownerEmail`, `auth.register.password`, `auth.register.phone`, `auth.register.submit`, `auth.register.pending`) in `apps/web/messages/en.json` and `apps/web/messages/th.json`
- [X] T017 [US1] Create public clinic registration page with form fields (clinicName, taxId, address, ownerName, ownerEmail, password, confirmPassword, phone), inline validation, submit to `POST /auth/register-request`, success state showing "pending review" in `apps/web/app/(auth)/register/page.tsx`

**Checkpoint**: User Story 1 complete. A guest can register a clinic and see feedback. No login is possible for pending accounts.

---

## Phase 4: User Story 2 — Platform Admin Approves/Rejects a Pending Clinic (Priority: P1)

**Goal**: A SUPER_ADMIN can view pending clinic requests, approve them (activating clinic+owner), or reject them (terminal state).

**Independent Test**: Create a pending clinic via registration, log in as admin, navigate to `/admin/clinics`, approve the clinic, verify clinic and owner become ACTIVE. Repeat with reject and verify REJECTED+INACTIVE.

### Implementation for User Story 2

- [X] T018 [US2] Add `approve(clinicId: string, note?: string)` method to `ClinicService` — update clinic status to ACTIVE, owner status to ACTIVE in `$transaction`, emit audit in `apps/api/src/modules/identity/services/clinic.service.ts`
- [X] T019 [US2] Add `reject(clinicId: string, reason?: string)` method to `ClinicService` — update clinic status to REJECTED, owner status to INACTIVE in `$transaction`, emit audit in `apps/api/src/modules/identity/services/clinic.service.ts`
- [X] T020 [US2] Add `@Patch(':id/approve')` and `@Patch(':id/reject')` endpoints in `apps/api/src/modules/identity/controllers/admin.controller.ts`
- [X] T021 [US2] Update `@Get()` clinics list to include `slug`, `owner.name`, `owner.email`, `owner.status` in response in `apps/api/src/modules/identity/controllers/admin.controller.ts`
- [X] T022 [P] [US2] Add i18n keys for admin clinic list (`admin.clinics.pendingBadge`, `admin.clinics.approve`, `admin.clinics.reject`, `admin.clinics.rejectReason`, `admin.clinics.approveSuccess`, `admin.clinics.rejectSuccess`, `admin.clinics.rejectedBadge`) in `apps/web/messages/en.json` and `apps/web/messages/th.json`
- [X] T023 [US2] Update admin clinics page to show PENDING clinics distinctly, add Approve button calling `PATCH /admin/clinics/:id/approve`, add Reject button with reason dialog calling `PATCH /admin/clinics/:id/reject`, show success/error feedback in `apps/web/app/(admin)/admin/clinics/page.tsx`

**Checkpoint**: User Story 2 complete. Admin can approve/reject pending clinics from the clinic list page.

---

## Phase 5: User Story 3 — Clinic Slug Is Established (Priority: P1)

**Goal**: Every clinic has a unique auto-generated slug. The slug is visible in admin responses and available on clinic context for staff creation.

**Independent Test**: Register a clinic named "Happy Paws", verify a slug like `happy-paws` is generated. Register another with the same name, verify a disambiguated slug (e.g. `happy-paws-2`) is stored.

> **Note**: Most slug implementation is already covered by T006 (slug generation helper) and T011 (registerRequest uses it). This phase covers the remaining slug exposure tasks.

### Implementation for User Story 3

- [X] T024 [US3] Expose `slug` field in the clinic context returned by `GET /auth/me` so the frontend can display it in the staff creation form — update `AuthProfile` construction in `apps/api/src/modules/identity/services/auth.service.ts`
- [X] T025 [US3] Add slug immutability guard — ensure no update path on `ClinicService` modifies the slug field in `apps/api/src/modules/identity/services/clinic.service.ts`

**Checkpoint**: User Story 3 complete. Slugs are auto-generated, unique, immutable, and visible in relevant API responses.

---

## Phase 6: User Story 4 — Clinic Owner Creates Staff with a Username (Priority: P1)

**Goal**: An approved clinic owner can create staff with a usernamePrefix. The system builds the full username (`prefix@slug`), sets `mustChangePassword=true`, and returns the new user.

**Independent Test**: Log in as clinic owner, open staff page, enter prefix `somchai`, see `@happy-paws` suffix, submit. Verify staff row has `username=somchai@happy-paws` and `mustChangePassword=true`.

### Implementation for User Story 4

- [X] T026 [US4] Add `createStaff(clinicId: string, dto: CreateStaffDto)` method to `UserService` — validate usernamePrefix format, build full username (`prefix@slug`), hash temporaryPassword, create user with `mustChangePassword=true`, assign branches in `$transaction`, emit audit in `apps/api/src/modules/identity/services/user.service.ts`
- [X] T027 [P] [US4] Create `CreateStaffDto` with class-validator decorators (name, usernamePrefix, role, temporaryPassword, phone, branchIds) in `apps/api/src/modules/identity/dto/create-staff.dto.ts`
- [X] T028 [US4] Replace `@Post('invite')` with `@Post()` using `CreateStaffDto` calling `userService.createStaff()`, catch Prisma P2002 and return 409 in `apps/api/src/modules/identity/controllers/staff.controller.ts`
- [X] T029 [US4] Update `@Get()` staff list to return `id`, `username`, `name`, `role`, `status` (replacing email with username) in `apps/api/src/modules/identity/controllers/staff.controller.ts`
- [X] T030 [P] [US4] Add i18n keys for staff creation (`clinic.staff.usernamePrefix`, `clinic.staff.usernameSuffix`, `clinic.staff.name`, `clinic.staff.temporaryPassword`, `clinic.staff.branchSelect`, `clinic.staff.createSuccess`, `clinic.staff.duplicateUsername`) in `apps/web/messages/en.json` and `apps/web/messages/th.json`
- [X] T031 [US4] Replace invite email dialog with usernamePrefix text field + read-only `@<clinicSlug>` suffix display, add name field, add temporaryPassword field, add branch multi-select, submit to `POST /clinic/staff`, show generated full username in success toast in `apps/web/app/(clinic)/clinic/staff/staff-client.tsx`

**Checkpoint**: User Story 4 complete. Owner can create staff with username-based accounts. Staff list shows username and name.

---

## Phase 7: User Story 5 — Clinic Staff Logs In via Username (Priority: P1)

**Goal**: A staff member can log in using `username@clinic-slug` format. The system resolves the identifier through the slug lookup path and creates a session.

**Independent Test**: Create a staff account via the owner flow, log in with `somchai@happy-paws` and the temporary password, verify session is created and redirect occurs.

> **Note**: The identifier resolution logic is already implemented in T007–T009 (Phase 2). This phase covers the login UI changes.

### Implementation for User Story 5

- [X] T032 [P] [US5] Add i18n keys for login page update (`login.identifierLabel`, `login.identifierHint`, `login.identifierPlaceholder`) in `apps/web/messages/en.json` and `apps/web/messages/th.json`
- [X] T033 [US5] Change email input to text input with label "Email or Staff Username", update `autoComplete` to `"username"`, change form post from `{ email, password }` to `{ identifier, password }`, add helper text explaining `username@clinic-slug` format in `apps/web/app/(auth)/login/page.tsx`

**Checkpoint**: User Story 5 complete. Both email and username login paths work from a single login form.

---

## Phase 8: User Story 6 — Portal Separation and Forced Password Change (Priority: P1)

**Goal**: Authenticated users are routed to the correct portal by role. Staff with `mustChangePassword=true` are redirected to the change-password page before accessing any clinic routes.

**Independent Test**: Log in as staff with `mustChangePassword=true`, verify redirect to `/clinic/change-password`. Complete the change, verify redirect to `/clinic/dashboard` and flag is cleared. Log in as non-admin and try to access `/admin/*`, verify redirect.

### Implementation for User Story 6

- [X] T034 [US6] Add `changePassword(userId: string, newPassword: string)` method to `AuthService` — update password hash, set `mustChangePassword=false`, invalidate all sessions for this user, emit audit in `apps/api/src/modules/identity/services/auth.service.ts`
- [X] T035 [US6] Add `@Post('change-password')` endpoint (authenticated, any clinic role) calling `authService.changePassword()` in `apps/api/src/modules/identity/controllers/auth.controller.ts`
- [X] T036 [P] [US6] Add i18n keys for change-password page (`clinic.changePassword.title`, `clinic.changePassword.newPassword`, `clinic.changePassword.confirmPassword`, `clinic.changePassword.submit`, `clinic.changePassword.success`) in `apps/web/messages/en.json` and `apps/web/messages/th.json`
- [X] T037 [US6] Add `mustChangePassword` check in clinic layout RSC — if `mustChangePassword === true` AND pathname is NOT `/clinic/change-password`, redirect to `/clinic/change-password` in `apps/web/app/(clinic)/layout.tsx`
- [X] T038 [US6] Create forced password change page with newPassword + confirmPassword fields, submit to `POST /auth/change-password`, on success redirect to `/clinic/dashboard` in `apps/web/app/(clinic)/clinic/change-password/page.tsx`

**Checkpoint**: User Story 6 complete. Portal separation enforced. Forced password change works end-to-end.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Backwards compatibility checks, audit verification, compile-time cleanup.

- [X] T039 [P] Audit all existing TypeScript consumers of `UserContext.email` and `AuthProfile.email` — fix any non-null assertions that now fail due to nullable email across `apps/api/` and `apps/web/`
- [X] T040 [P] Verify existing INVITED-status users with email addresses can still log in via the email path — manual smoke test or seed verification in `packages/database/src/seed.ts`
- [X] T041 [P] Run `turbo build` from repo root and fix any remaining compile errors across all packages
- [ ] T042 Run quickstart.md validation — follow all steps in `specs/003-clinic-onboarding-staff/quickstart.md` and confirm expected outputs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — registration flow
- **User Story 2 (Phase 4)**: Depends on Phase 2 — approve/reject flow (can run in parallel with US1)
- **User Story 3 (Phase 5)**: Depends on Phase 2 — slug exposure (mostly covered by Phase 2, can run in parallel with US1/US2)
- **User Story 4 (Phase 6)**: Depends on Phase 2 + US3 (slug must be exposed for staff creation UI)
- **User Story 5 (Phase 7)**: Depends on Phase 2 — login UI changes (can run in parallel with US1–US4)
- **User Story 6 (Phase 8)**: Depends on Phase 2 — forced password change (can run in parallel with US1–US5)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Independence

- **US1** (Registration): Independent — no dependency on other stories
- **US2** (Approve/Reject): Independent — needs a PENDING clinic (can use seed or US1)
- **US3** (Slug): Independent — slug generation is in foundational phase
- **US4** (Staff Creation): Depends on US3 (slug must be available in clinic context)
- **US5** (Username Login): Independent — identifier resolution is in foundational phase
- **US6** (Portal Separation + Password Change): Independent

### Within Each User Story

- DTOs/models before services
- Services before controllers
- Controllers before frontend pages
- i18n keys before frontend pages (can be parallel with backend)

### Parallel Opportunities

**After Phase 2 completes, these can run simultaneously:**

```
US1 (Registration)    ──→ in parallel
US2 (Approve/Reject)  ──→ in parallel
US3 (Slug Exposure)   ──→ in parallel
US5 (Login UI)        ──→ in parallel
US6 (Password Change) ──→ in parallel
US4 (Staff Creation)  ──→ after US3 slug exposure task (T024)
```

---

## Parallel Example: After Phase 2

```bash
# These can all launch in parallel (different files):
T011: registerRequest in clinic.service.ts        [US1]
T018: approve in clinic.service.ts                [US2] ← same file as T011, sequence these
T024: slug in auth.service.ts me response         [US3]
T026: createStaff in user.service.ts              [US4] ← needs T024 first
T032: i18n keys for login                         [US5]
T034: changePassword in auth.service.ts           [US6]

# True parallel (different files):
T012: RegisterRequestDto                          [US1]
T027: CreateStaffDto                              [US4]
T015: middleware.ts PUBLIC_PATHS                   [US1]
T016: i18n keys en.json + th.json                 [US1]
T022: i18n keys en.json + th.json                 [US2]
T030: i18n keys en.json + th.json                 [US4]
T032: i18n keys en.json + th.json                 [US5]
T036: i18n keys en.json + th.json                 [US6]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + types)
2. Complete Phase 2: Foundational (auth identifier resolution, slug generation, session backfill)
3. Complete Phase 3: User Story 1 (registration flow)
4. **STOP and VALIDATE**: Test registration end-to-end
5. Deploy/demo if ready — guests can register, admins see pending clinics

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Registration) → Test → **MVP!**
3. Add US2 (Approve/Reject) → Test → Admins can manage registrations
4. Add US3 (Slug Exposure) → Test → Slug visible in context
5. Add US4 (Staff Creation) → Test → Owners can create staff
6. Add US5 (Login UI) → Test → Staff can log in
7. Add US6 (Portal Separation + Password Change) → Test → Full security enforcement
8. Polish → Compile check + quickstart validation

### Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
