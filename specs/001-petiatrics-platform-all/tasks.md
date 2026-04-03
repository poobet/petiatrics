# Tasks: Petiatrics — Full Platform (All Modules)

**Input**: Design documents from `/specs/001-petiatrics-platform-all/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not explicitly requested in specification — test tasks are omitted. Add test phases per user story if TDD is desired.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo web platform** per plan.md:
  - `apps/api/src/` — NestJS backend
  - `apps/web/app/` — Next.js App Router frontend
  - `packages/database/` — Prisma + Mongoose schemas and clients
  - `packages/types/` — Shared TypeScript types and enums
  - `packages/ui/` — Shared UI component library
  - `packages/config/` — Shared configuration

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize Turborepo monorepo structure, Docker services, and environment configuration

- [X] T001 Initialize Turborepo monorepo with root package.json, turbo.json, and workspace configuration at project root
- [X] T002 Scaffold apps/api as a NestJS project with TypeScript (src/main.ts, src/app.module.ts, nest-cli.json, tsconfig.json, package.json)
- [X] T003 [P] Scaffold apps/web as a Next.js App Router project with React 19 and Tailwind CSS (app/layout.tsx, next.config.ts, tsconfig.json, tailwind.config.ts, package.json)
- [X] T004 [P] Create packages/database with Prisma and Mongoose setup (package.json, tsconfig.json, prisma/schema.prisma stub, mongo/ directory, src/index.ts)
- [X] T005 [P] Create packages/types with shared TypeScript interfaces and enums (package.json, tsconfig.json, src/index.ts)
- [X] T006 [P] Create packages/ui scaffold by promoting reusable components from documents/display/ (package.json, tsconfig.json, src/index.ts)
- [X] T007 [P] Create packages/config with shared environment and runtime configuration helpers (package.json, tsconfig.json, src/index.ts, src/env.ts)
- [X] T008 Create docker-compose.yml with PostgreSQL 16, MongoDB 7, and Redis 7 services at project root
- [X] T009 [P] Create .env.example with all required environment variables per quickstart.md at project root
- [X] T010 [P] Create apps/api/Dockerfile with multi-stage build (deps → build → runtime)
- [X] T011 [P] Create apps/web/Dockerfile with multi-stage build (deps → build → runtime)
- [X] T012 Create docker-compose.prod.yml with API, web, and infrastructure services at project root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schemas, authentication framework, tenant isolation, i18n, event infrastructure, and audit interceptor that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T013 Define full Prisma schema with Clinic, User, Appointment, Product, StockMovement, Invoice, and InvoiceLineItem models including enums in packages/database/prisma/schema.prisma
- [X] T014 [P] Create Mongoose schema for PetProfile in packages/database/mongo/pet-profile.schema.ts
- [X] T015 [P] Create Mongoose schema for VisitRecord (SOAP, prescriptions, attachments, status lifecycle) in packages/database/mongo/visit-record.schema.ts
- [X] T016 [P] Create Mongoose schema for VaccinationRecord in packages/database/mongo/vaccination-record.schema.ts
- [X] T017 [P] Create Mongoose schema for AuditLog (append-only, immutable) in packages/database/mongo/audit-log.schema.ts
- [X] T018 Implement Prisma client extensions for automatic clinic_id tenant scoping on all queries in packages/database/src/prisma-tenant.ts
- [X] T019 [P] Implement Mongoose query middleware for automatic clinic_id tenant scoping in packages/database/src/mongo-tenant.ts
- [X] T020 Export all database clients, Prisma service, and Mongoose schemas from packages/database/src/index.ts
- [X] T021 Define shared TypeScript enums (Role, AppointmentStatus, VisitStatus, InvoiceStatus, StockMovementReason, SubscriptionTier, Locale) in packages/types/src/enums.ts
- [X] T022 [P] Define shared API types (Envelope, PaginatedResponse, ErrorResponse, UserContext) in packages/types/src/api.ts
- [X] T023 Implement Redis-backed session module with session guard and session service in apps/api/src/common/session/session.module.ts and apps/api/src/common/session/session.guard.ts
- [X] T024 Implement RBAC guard and @Roles() decorator for role-based access control in apps/api/src/common/guards/roles.guard.ts and apps/api/src/common/guards/roles.decorator.ts
- [X] T025 Implement global exception filter that returns the standard envelope error format in apps/api/src/common/filters/http-exception.filter.ts
- [X] T026 [P] Implement response envelope interceptor wrapping all responses in { data, meta, error } in apps/api/src/common/interceptors/envelope.interceptor.ts
- [X] T027 Implement tenant-context decorator and middleware to inject clinic_id from session into request context in apps/api/src/common/decorators/tenant.decorator.ts
- [X] T028 [P] Configure NestJS event-emitter module for cross-domain events (VisitFinalized, LowStock) in apps/api/src/common/events/events.module.ts
- [X] T029 Create stub NestJS module files for all bounded contexts: identity/, clinical/, appointments/, inventory/, billing/, audit/ in apps/api/src/modules/
- [X] T030 [P] Configure next-intl with Thai and English locale resource files in apps/web/messages/th.json and apps/web/messages/en.json
- [X] T031 [P] Implement i18n provider and locale detection in apps/web/lib/i18n.ts and apps/web/app/layout.tsx
- [X] T032 Create shared API client with session cookie handling and typed response parsing in apps/web/lib/api-client.ts
- [X] T033 [P] Implement shared UI layout shell (sidebar navigation, header with language switcher, user menu) in apps/web/components/layout/app-shell.tsx
- [X] T034 Implement audit logging interceptor that captures entity before/after state for all write operations in apps/api/src/common/interceptors/audit.interceptor.ts
- [X] T035 Run initial Prisma migration to create all PostgreSQL tables (npx prisma migrate dev) from packages/database/

**Checkpoint**: Foundation ready — database schemas, auth, tenant isolation, i18n, event bus, and audit interceptor all operational. User story implementation can now begin.

---

## Phase 3: User Story 1 — Clinic Onboarding & Identity Setup (Priority: P1) 🎯 MVP

**Goal**: Platform Admin registers clinics, Clinic Managers invite staff, staff log in securely with role-based portal routing

**Independent Test**: Create a clinic via Admin portal → invite Manager + Vet + Cashier → each logs in and verifies they land on the correct dashboard with role-restricted menus

### Implementation for User Story 1

- [X] T036 [US1] Implement AuthService with login, logout, session creation, password validation, and lockout logic in apps/api/src/modules/identity/services/auth.service.ts
- [X] T037 [US1] Implement AuthController with POST /auth/login, POST /auth/logout, GET /auth/me in apps/api/src/modules/identity/controllers/auth.controller.ts
- [X] T038 [P] [US1] Implement ClinicService with create, findAll, findById, updateStatus in apps/api/src/modules/identity/services/clinic.service.ts
- [X] T039 [P] [US1] Implement UserService with invite, findByClinic, updateRole, deactivate, password policy enforcement in apps/api/src/modules/identity/services/user.service.ts
- [X] T040 [US1] Implement AdminController with POST /admin/clinics, PATCH /admin/clinics/:id/status, GET /admin/metrics in apps/api/src/modules/identity/controllers/admin.controller.ts
- [X] T041 [US1] Implement StaffController with POST /clinic/staff/invite, PATCH /clinic/staff/:id/role, DELETE /clinic/staff/:id in apps/api/src/modules/identity/controllers/staff.controller.ts
- [X] T042 [US1] Register all Identity module providers, controllers, and exports in apps/api/src/modules/identity/identity.module.ts
- [X] T043 [P] [US1] Create login page with email/password form, lockout feedback, and language selector in apps/web/app/(auth)/login/page.tsx
- [X] T044 [P] [US1] Create Admin portal layout with sidebar navigation (Clinics, Metrics, Audit, Settings) in apps/web/app/(admin)/layout.tsx
- [X] T045 [US1] Create Admin Clinic List page with data table (name, status, tier, user count) and Suspend/Activate actions in apps/web/app/(admin)/clinics/page.tsx
- [X] T046 [US1] Create Admin Clinic Detail page with tabs (Info, Users, Usage) and editable fields in apps/web/app/(admin)/clinics/[id]/page.tsx
- [X] T047 [US1] Create Admin Platform Metrics dashboard with KPI cards (total clinics, MAU, MRR) in apps/web/app/(admin)/dashboard/page.tsx
- [X] T048 [P] [US1] Create Clinic Staff portal layout with role-based sidebar (Dashboard, Patients, Appointments, Inventory, Billing, Staff, Audit) in apps/web/app/(clinic)/layout.tsx
- [X] T049 [US1] Create Staff Management page with user table, invite-by-email modal, role dropdown, deactivate action in apps/web/app/(clinic)/staff/page.tsx
- [X] T050 [US1] Implement role-based route protection middleware (redirect unauthenticated, enforce portal access by role) in apps/web/middleware.ts
- [X] T051 [US1] Create Clinic Staff Dashboard page with today's placeholder sections and quick-action buttons in apps/web/app/(clinic)/dashboard/page.tsx

**Checkpoint**: Clinic onboarding and identity fully functional — Platform Admin can register clinics, managers invite staff, staff log in with role-based routing

---

## Phase 4: User Story 2 — Patient Registration & Medical Records (Priority: P1)

**Goal**: Receptionist registers patients (pets) with linked owners, Veterinarian creates SOAP-structured visit records with prescriptions and attachments

**Independent Test**: Receptionist creates a patient → Vet creates and finalizes a visit note with SOAP + prescription → verify visit record exists with correct lifecycle states

### Implementation for User Story 2

- [X] T052 [US2] Implement PatientService with create, findAll, findById using PetProfile Mongoose model in apps/api/src/modules/clinical/services/patient.service.ts
- [X] T053 [P] [US2] Implement VisitService with create, update, finalize, amend (lifecycle: Draft → Finalized → Amended) in apps/api/src/modules/clinical/services/visit.service.ts
- [X] T054 [P] [US2] Implement VaccinationService with create and listByPatient in apps/api/src/modules/clinical/services/vaccination.service.ts
- [X] T055 [US2] Implement PatientController with POST /patients, GET /patients, GET /patients/:id in apps/api/src/modules/clinical/controllers/patient.controller.ts
- [X] T056 [US2] Implement VisitController with POST /patients/:id/visits, PATCH /patients/:id/visits/:visitId, POST .../finalize in apps/api/src/modules/clinical/controllers/visit.controller.ts
- [X] T057 [US2] Implement VaccinationController with POST /patients/:id/vaccinations in apps/api/src/modules/clinical/controllers/vaccination.controller.ts
- [X] T058 [US2] Emit VisitFinalized domain event when a visit record transitions to Finalized status in apps/api/src/modules/clinical/services/visit.service.ts
- [X] T059 [US2] Register all Clinical module providers, controllers, and exports in apps/api/src/modules/clinical/clinical.module.ts
- [X] T060 [P] [US2] Create Patient List page with searchable/filterable table (name, species, breed, last visit) in apps/web/app/(clinic)/patients/page.tsx
- [X] T061 [US2] Create Patient Profile page with tabs (Info, Medical History, Vaccinations) and timeline of visits in apps/web/app/(clinic)/patients/[id]/page.tsx
- [X] T062 [US2] Create Visit Record Form with SOAP structured inputs, inline prescription builder, and file attachment uploader in apps/web/app/(clinic)/patients/[id]/visits/new/page.tsx
- [X] T063 [US2] Create Visit Record Edit/View page with finalize and amend actions, amendment reason dialog in apps/web/app/(clinic)/patients/[id]/visits/[visitId]/page.tsx

**Checkpoint**: Patient registration and medical records fully functional — pets registered with owners, SOAP visit records with prescriptions, full lifecycle management

---

## Phase 5: User Story 3 — Appointment Scheduling (Priority: P1)

**Goal**: Receptionist or Pet Owner books free-form appointments, clinic calendar shows real-time availability with per-vet overlap prevention

**Independent Test**: Book appointment via API → Receptionist confirms in clinic calendar → attempt overlapping booking for same Vet is rejected

### Implementation for User Story 3

- [X] T064 [US3] Implement AppointmentService with create, findAll, findById, updateStatus, cancel, and per-vet overlap detection in apps/api/src/modules/appointments/services/appointment.service.ts
- [X] T065 [P] [US3] Implement appointment overlap validation utility (check vet time-range interval conflicts) in apps/api/src/modules/appointments/utils/overlap-detection.util.ts
- [X] T066 [US3] Implement AppointmentController with POST /appointments, GET /appointments, GET /appointments/:id, PATCH .../status, DELETE in apps/api/src/modules/appointments/controllers/appointment.controller.ts
- [X] T067 [US3] Implement ReminderService for scheduling 24h-before appointment notifications in apps/api/src/modules/appointments/services/reminder.service.ts
- [X] T068 [US3] Register all Appointments module providers, controllers, and exports in apps/api/src/modules/appointments/appointments.module.ts
- [X] T069 [US3] Create Appointment Calendar page with week/day view, color-coded status, drag-to-reschedule, and overlap warnings in apps/web/app/(clinic)/appointments/page.tsx
- [X] T070 [P] [US3] Create New Appointment form/modal with vet selection, patient, date, start time, and duration inputs in apps/web/app/(clinic)/appointments/new/page.tsx
- [X] T071 [US3] Integrate today's appointments list and quick-action "New Appointment" button into Clinic Staff Dashboard in apps/web/app/(clinic)/dashboard/page.tsx

**Checkpoint**: Appointment scheduling fully functional — free-form booking, per-vet overlap prevention, calendar view with reminders

---

## Phase 6: User Story 4 — Inventory Management (Priority: P2)

**Goal**: Clinic Manager manages product catalog, stock auto-deducts on medication dispense, low-stock alerts fire when threshold is reached

**Independent Test**: Manager adds product → Vet dispenses during visit → stock count decreases → low-stock alert appears when reaching threshold

### Implementation for User Story 4

- [X] T072 [US4] Implement ProductService with create, findAll, findById, update for product catalog management in apps/api/src/modules/inventory/services/product.service.ts
- [X] T073 [P] [US4] Implement StockService with replenish, deduct, getMovements, and low-stock threshold alert detection in apps/api/src/modules/inventory/services/stock.service.ts
- [X] T074 [US4] Implement ProductController with POST /inventory/products, GET /inventory/products, PATCH /inventory/products/:id in apps/api/src/modules/inventory/controllers/product.controller.ts
- [X] T075 [US4] Implement StockController with POST /inventory/stock/replenish, GET /inventory/stock/movements in apps/api/src/modules/inventory/controllers/stock.controller.ts
- [X] T076 [US4] Listen for VisitFinalized event to auto-deduct inventory for linked prescriptions (skip unlinked) in apps/api/src/modules/inventory/listeners/visit-finalized.listener.ts
- [X] T077 [US4] Implement UnlinkedItemsService to detect and report unlinked prescription items for Manager review in apps/api/src/modules/inventory/services/unlinked-items.service.ts
- [X] T078 [US4] Register all Inventory module providers, controllers, and event listeners in apps/api/src/modules/inventory/inventory.module.ts
- [X] T079 [US4] Create Inventory Dashboard page with stock table, low-stock row highlighting, and movement log tab in apps/web/app/(clinic)/inventory/page.tsx
- [X] T080 [P] [US4] Create Product Form modal for adding and editing products (name, SKU, category, unit, threshold) in apps/web/app/(clinic)/inventory/products/new/page.tsx
- [X] T081 [US4] Create Stock Replenishment form with supplier, quantity, unit cost entry in apps/web/app/(clinic)/inventory/replenish/page.tsx
- [X] T082 [US4] Add low-stock alerts badge and unlinked items indicator to Clinic Staff Dashboard in apps/web/app/(clinic)/dashboard/page.tsx

**Checkpoint**: Inventory management fully functional — product catalog, auto-deduction on dispense, low-stock alerts, unlinked item reporting

---

## Phase 7: User Story 5 — Billing & Invoicing (Priority: P2)

**Goal**: Cashier generates invoices auto-populated from finalized visits, processes payments, Manager accesses financial reports

**Independent Test**: Cashier creates invoice from completed visit → line items pre-populated → marks as paid → Manager views revenue report by date range

### Implementation for User Story 5

- [X] T083 [US5] Implement InvoiceService with create (auto-populate from visit), issue, markPaid, void, and report generation in apps/api/src/modules/billing/services/invoice.service.ts
- [X] T084 [US5] Listen for VisitFinalized event to auto-create draft invoice with pre-populated line items in apps/api/src/modules/billing/listeners/visit-finalized.listener.ts
- [X] T085 [US5] Implement InvoiceController with POST /billing/invoices, GET /billing/invoices, GET .../id, PATCH .../issue, .../pay, .../void in apps/api/src/modules/billing/controllers/invoice.controller.ts
- [X] T086 [US5] Implement ReportController with GET /billing/reports for date-range financial reporting (revenue, outstanding, per-service) in apps/api/src/modules/billing/controllers/report.controller.ts
- [X] T087 [US5] Register all Billing module providers, controllers, and event listeners in apps/api/src/modules/billing/billing.module.ts
- [X] T088 [US5] Create Billing List page with invoice table (amount, status, patient, date) and quick actions in apps/web/app/(clinic)/billing/page.tsx
- [X] T089 [US5] Create Invoice Detail page with line item table, issue/pay/void actions, and payment confirmation dialog in apps/web/app/(clinic)/billing/[id]/page.tsx
- [X] T090 [US5] Create Financial Reports page with date range filter, revenue charts, outstanding invoices, and per-service breakdown in apps/web/app/(clinic)/billing/reports/page.tsx

**Checkpoint**: Billing and invoicing fully functional — auto-populated invoices from visit data, payment tracking, void trail, financial reporting

---

## Phase 8: User Story 6 — Pet Owner Mobile PWA (Priority: P2)

**Goal**: Pet Owner manages pets, books appointments, views medical records and invoices from a mobile-first offline-capable PWA

**Independent Test**: Login on mobile browser → view pets → view health records → book appointment → view invoice — all within 3 taps from home

### Implementation for User Story 6

- [X] T091 [US6] Implement OwnerController with GET /owner/pets, GET /owner/pets/:id/records, GET /owner/appointments, GET /owner/invoices in apps/api/src/modules/clinical/controllers/owner.controller.ts
- [X] T092 [US6] Create Pet Owner PWA layout with mobile-first shell, bottom navigation bar, and notification bell in apps/web/app/(pet-owner)/layout.tsx
- [X] T093 [US6] Create PWA Home page with pet avatar cards and upcoming appointment banner in apps/web/app/(pet-owner)/page.tsx
- [X] T094 [US6] Create Pet Detail page with health summary card, records timeline, and vaccination status chips in apps/web/app/(pet-owner)/pets/[id]/page.tsx
- [X] T095 [US6] Create Visit Record View page with read-only SOAP summary in plain language and prescription cards in apps/web/app/(pet-owner)/pets/[id]/visits/[visitId]/page.tsx
- [X] T096 [US6] Create Book Appointment multi-step flow (select clinic → date → time/duration → confirm) in apps/web/app/(pet-owner)/appointments/book/page.tsx
- [X] T097 [US6] Create Appointments List page with upcoming/past tabs, status badge, and cancel action in apps/web/app/(pet-owner)/appointments/page.tsx
- [X] T098 [US6] Create Invoice List page with status badges (Issued/Paid) and receipt view in apps/web/app/(pet-owner)/invoices/page.tsx
- [X] T099 [US6] Configure PWA manifest and service worker for offline caching of pet profiles and records in apps/web/public/manifest.json and apps/web/lib/sw.ts
- [X] T100 [US6] Implement push notification registration for appointment reminders in apps/web/lib/push-notifications.ts

**Checkpoint**: Pet Owner PWA fully functional — mobile-first portal with offline caching, push notifications, all core pet-owner workflows

---

## Phase 9: User Story 7 — Audit Trail & Compliance (Priority: P3)

**Goal**: All write operations automatically logged with actor identity, timestamp, and before/after state; logs immutable and queryable by authorized reviewers

**Independent Test**: Make any edit to a clinical or financial record → check audit log view shows correct before/after diff with actor info → verify logs cannot be modified or deleted

### Implementation for User Story 7

- [X] T101 [US7] Implement AuditService with query, filter by clinic/date-range/actor/entity-type using AuditLog Mongoose model in apps/api/src/modules/audit/services/audit.service.ts
- [X] T102 [US7] Implement AuditController with GET /audit/logs (paginated, filterable) in apps/api/src/modules/audit/controllers/audit.controller.ts
- [X] T103 [US7] Enforce immutability constraints — reject all update/delete operations on AuditLog collection in apps/api/src/modules/audit/audit.module.ts
- [X] T104 [US7] Register all Audit module providers and controllers in apps/api/src/modules/audit/audit.module.ts
- [X] T105 [US7] Create cross-tenant Audit Log Viewer page with filterable table and expandable before/after JSON diff in apps/web/app/(admin)/audit/page.tsx
- [X] T106 [P] [US7] Create clinic-scoped Audit Log page accessible by Clinic Manager in apps/web/app/(clinic)/audit/page.tsx

**Checkpoint**: Audit trail and compliance fully functional — immutable logs, queryable by authorized reviewers, cross-tenant view for Platform Admin

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Integration validation, platform settings, performance optimization, security hardening

- [X] T107 [P] Create configurable platform settings page (password policy, lockout rules) for Platform Admin in apps/web/app/(admin)/settings/page.tsx
- [X] T108 [P] Create clinic-level settings page (tax rate, clinic profile) for Clinic Manager in apps/web/app/(clinic)/settings/page.tsx
- [X] T109 Create seed script with demo data (Platform Admin, sample clinic, staff, patients, visits, inventory, invoices) in packages/database/src/seed.ts
- [X] T110 Validate full quickstart.md flow end-to-end (docker compose up → seed → login → exercise all portals)
- [X] T111 [P] Add OpenAPI contract validation middleware to verify API responses match contracts/api.openapi.yaml in apps/api/src/common/middleware/contract-validation.middleware.ts
- [X] T112 [P] Add database indexes optimized for query patterns (clinic_id composites, appointment date ranges, patient search) in packages/database/prisma/schema.prisma
- [X] T113 [P] Security hardening: configure CORS, CSP headers, rate limiting, and secure session cookie attributes in apps/api/src/main.ts
- [X] T114 Run Lighthouse audit on Pet Owner PWA and optimize for ≥ 85 performance score targeting apps/web/app/(pet-owner)/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational — No dependencies on other stories — **MVP**
- **US2 (Phase 4)**: Depends on Foundational — Can proceed in parallel with US1
- **US3 (Phase 5)**: Depends on Foundational — Can proceed in parallel with US1 and US2
- **US4 (Phase 6)**: Depends on Foundational + US2 (listens for VisitFinalized event)
- **US5 (Phase 7)**: Depends on Foundational + US2 (listens for VisitFinalized event)
- **US6 (Phase 8)**: Depends on US1 + US2 + US3 (consumes identity, clinical, and appointment endpoints)
- **US7 (Phase 9)**: Depends on Foundational (audit interceptor) — Can proceed in parallel with US1–US6
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    └─→ Phase 2 (Foundational) ⚠️ BLOCKS ALL
            ├─→ US1 (Identity) 🎯 MVP
            ├─→ US2 (Clinical)
            │       ├─→ US4 (Inventory) — listens to VisitFinalized
            │       └─→ US5 (Billing) — listens to VisitFinalized
            ├─→ US3 (Appointments)
            ├─→ US7 (Audit) — can start early, consumes interceptor
            └─→ US6 (PWA) — depends on US1 + US2 + US3 endpoints
                    └─→ Phase 10 (Polish)
```

### Within Each User Story

- Backend services before controllers
- Controllers before frontend pages
- Event listeners after the events they consume exist
- Core CRUD before advanced features (alerts, reports)

### Parallel Opportunities

- **Phase 1**: T003–T007 and T009–T011 can all run in parallel
- **Phase 2**: T014–T017 (Mongoose schemas) in parallel; T021–T022 in parallel; T025–T026, T030–T031, T033 in parallel
- **US1**: T038 + T039 in parallel; T043 + T044 + T048 in parallel
- **US2**: T053 + T054 in parallel; T060 in parallel with backend work
- **US3**: T065 in parallel with other backend tasks; T070 in parallel with T069
- **US4**: T073 in parallel with T072
- **US5**: T084 can begin once US2's VisitFinalized event exists
- **US6**: T092–T100 are mostly independent frontend pages — high parallelism
- **US7**: T105 + T106 in parallel
- **Phase 10**: T107, T108, T111, T112, T113 all in parallel

---

## Parallel Example: User Story 1

```text
# After Foundational Phase completes:

# Backend services in parallel:
Task T038: "ClinicService with create, findAll, findById, updateStatus"
Task T039: "UserService with invite, findByClinic, updateRole, deactivate"

# Auth service (depends on session module from foundational):
Task T036: "AuthService with login, logout, session, lockout"

# Controllers after their services:
Task T037: "AuthController"
Task T040: "AdminController"
Task T041: "StaffController"
Task T042: "Identity module registration"

# Frontend layouts in parallel:
Task T043: "Login page"
Task T044: "Admin portal layout"
Task T048: "Clinic Staff portal layout"

# Pages after layouts:
Task T045 → T046 → T047 (Admin portal pages)
Task T049 → T050 → T051 (Clinic staff pages)
```

---

## Parallel Example: User Story 2

```text
# Backend services in parallel:
Task T052: "PatientService (PetProfile CRUD)"
Task T053: "VisitService (SOAP lifecycle)"
Task T054: "VaccinationService"

# Controllers after services:
Task T055 → T056 → T057 → T058 → T059

# Frontend (after controllers ready):
Task T060: "Patient List page"
Task T061: "Patient Profile page"
Task T062: "Visit Record Form"
Task T063: "Visit Record Edit/View page"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL** — blocks all stories)
3. Complete Phase 3: User Story 1 (Clinic Onboarding & Identity)
4. **STOP and VALIDATE**: Platform Admin can register clinics, invite staff, staff log in with role-based portals
5. Deploy/demo if ready — this is the base platform identity layer

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. **US1** (Identity) → Test independently → Deploy/Demo (**MVP!**)
3. **US2** (Clinical) → Test independently → Deploy/Demo — core medical records
4. **US3** (Appointments) → Test independently → Deploy/Demo — daily scheduling workflow
5. **US4** (Inventory) → Test independently → Deploy/Demo — stock management
6. **US5** (Billing) → Test independently → Deploy/Demo — revenue collection
7. **US6** (PWA) → Test independently → Deploy/Demo — pet owner experience
8. **US7** (Audit) → Test independently → Deploy/Demo — compliance layer
9. Polish → Final validation and security hardening

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Identity) → US3 (Appointments)
   - Developer B: US2 (Clinical) → US4 (Inventory)
   - Developer C: US5 (Billing) + US7 (Audit)
   - Developer D: US6 (PWA) — starts after US1 + US2 + US3 endpoints exist
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The display prototype in documents/display/ can be referenced for UI patterns but implementation targets apps/web/
- All monetary values stored as integers in smallest currency unit (satang for THB)
