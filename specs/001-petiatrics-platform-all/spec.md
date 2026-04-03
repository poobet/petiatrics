# Feature Specification: Petiatrics — Full Platform (All Modules)

**Feature Branch**: `001-petiatrics-platform-all`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: Petiatrics Pet Clinic Management SaaS — Full Platform Specification covering all three portals (Admin, Clinic Staff, Pet Owner PWA), all backend modules (Identity, Clinical, Inventory, Billing), UI requirements, Data/API structures, and Acceptance Criteria

---

## Overview

**Petiatrics** is a multi-tenant B2B2C SaaS platform that digitizes and streamlines veterinary clinic operations. It serves three distinct user groups through purposefully designed portals:

1. **Platform Admin Portal** — centralized governance for the Petiatrics platform operator.
2. **Clinic Staff Portal** — desktop-optimized daily operations hub for veterinarians, cashiers, and clinic managers.
3. **Pet Owner PWA** — mobile-first Progressive Web App for pet owners to manage their pets, appointments, and health records.

All portals are backed by a single NestJS API organized around four bounded contexts: **Identity**, **Clinical**, **Inventory**, and **Billing**.

---

## Clarifications

### Session 2026-03-26

- Q: How are appointment time slots structured (fixed duration, per-service, or free-form)? → A: Fully free-form — Receptionist picks any start time and duration manually.
- Q: What is the explicit lifecycle of a Visit Record (states and transitions)? → A: `Draft → Finalized → Amended`. Finalized = complete and triggers billing eligibility. Amended = post-24h edit by Manager only.
- Q: What login security policy applies (lockout, password requirements)? → A: Lock account after 5 failed attempts for 15 minutes + password policy (8+ chars, 1 uppercase, 1 number). All thresholds (attempt limit, lockout duration, password rules) are configurable by Platform Admin.
- Q: What languages and locale formats does the UI support? → A: Full i18n from day one. User selects language at login (Thai, English). Date/currency/number formatting adapts to locale. SOAP notes are free-text (any language).
- Q: What happens when a medication is dispensed but the inventory product doesn't exist? → A: Allow the visit record to save; skip stock deduction; flag the prescription item as "unlinked to inventory" for Manager review.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Clinic Onboarding & Identity Setup (Priority: P1)

A Platform Admin registers a new veterinary clinic on Petiatrics, configures its profile, and the clinic's manager invites staff members with appropriate roles. Staff log in securely and land in their role-specific workspace.

**Why this priority**: Without clinic onboarding and role-based access control, no other module can function. This is the foundation of the entire platform.

**Independent Test**: Can be tested by: creating a clinic via Admin portal → inviting a Manager + Vet + Cashier → each logging in and verifying they land on the correct dashboard with correct role-restricted menus.

**Acceptance Scenarios**:

1. **Given** the Platform Admin is logged in, **When** they submit a new clinic registration form (name, address, tax ID, subscription tier), **Then** a new tenant record is created, the clinic receives a unique `clinic_id`, and an invitation email is sent to the designated Clinic Manager.
2. **Given** the Clinic Manager has accepted the invitation and logged in, **When** they navigate to Staff Management, **Then** they can invite staff by email and assign one of the predefined roles (Veterinarian, Cashier, Receptionist).
3. **Given** a staff member receives an invitation, **When** they click the link and complete registration, **Then** their account is linked to the correct clinic and role, and they are redirected to the role-appropriate dashboard.
4. **Given** a logged-in user's session is revoked by an admin, **When** the user makes any subsequent request, **Then** they are immediately redirected to the login page (real-time session invalidation).
5. **Given** an unauthenticated user, **When** they try to access any protected route directly, **Then** they are redirected to the login page.

---

### User Story 2 — Patient Registration & Medical Records (Priority: P1)

A Receptionist registers a new pet and its owner. A Veterinarian records a SOAP-structured medical note after a clinical examination, prescribes medication, and the record becomes immediately visible to the Pet Owner.

**Why this priority**: Core clinical value proposition. Patient and medical records are the heart of the Clinic Staff portal and the primary data Pet Owners care about.

**Independent Test**: Can be tested by: Receptionist creating a patient → Vet creating a visit note → Pet Owner logging into the PWA and viewing the record.

**Acceptance Scenarios**:

1. **Given** a Receptionist is logged in, **When** they submit a new patient form (pet name, species, breed, date of birth, owner details), **Then** a Pet Profile and linked Owner Account are created, and the patient appears in the clinic's patient list.
2. **Given** a Veterinarian opens a patient's profile, **When** they create a new visit record (SOAP: Subjective, Objective, Assessment, Plan), **Then** the record is saved in `Draft` status under the patient's medical history with a timestamp and the Vet's name.
3. **Given** a Vet is in a visit record, **When** they add a prescription (drug name, dosage, frequency, duration), **Then** the prescription is saved and linked to the visit.
4. **Given** a new visit record is saved, **When** the Pet Owner logs into the PWA, **Then** they can view the visit summary, diagnosis, and prescriptions in plain language.
5. **Given** a Vet edits an existing medical record within 24 hours of finalization, **When** the change is saved, **Then** the record remains `Finalized` and the system stores both the old and new values in the Audit Log with the Vet's identity and timestamp.
6. **Given** a Clinic Manager edits a Finalized record after 24 hours, **When** they provide an amendment reason and save, **Then** the record transitions to `Amended` status and the amendment reason, actor, and timestamp are recorded.

---

### User Story 3 — Appointment Scheduling (Priority: P1)

A Receptionist or Pet Owner books an appointment. The clinic's appointment calendar reflects real-time availability. Reminders are sent automatically.

**Why this priority**: Appointment management is the primary daily workflow driver for both clinic staff and pet owners.

**Independent Test**: Can be tested by: Pet Owner booking an appointment via PWA → seeing it confirmed → Receptionist viewing it in the clinic calendar.

**Acceptance Scenarios**:

1. **Given** a Pet Owner is logged into the PWA, **When** they select a clinic, available date, preferred start time, estimated duration, and reason for visit, **Then** an appointment request is submitted and the owner sees a confirmation screen.
2. **Given** an appointment request is submitted, **When** a Receptionist reviews the queue, **Then** they can confirm or reschedule the appointment and the Pet Owner receives a notification of the status change.
3. **Given** an appointment is confirmed, **When** 24 hours before the appointment time, **Then** the Pet Owner receives an automated reminder.
4. **Given** a Receptionist views the appointment calendar, **When** they attempt to book a time range that overlaps with an existing appointment for the same Veterinarian, **Then** the system prevents the overlap and highlights the conflicting block.
5. **Given** a Pet Owner cancels an appointment at least 2 hours in advance, **When** the cancellation is submitted, **Then** the slot is freed on the clinic calendar and the Vet is notified.

---

### User Story 4 — Inventory Management (Priority: P2)

A Clinic Manager manages the clinic's medication and supply inventory. Stock levels are tracked automatically when medications are dispensed during a visit. Alerts are triggered when stock falls below threshold.

**Why this priority**: Directly impacts clinical safety and operational efficiency. Automating stock deduction prevents manual errors and medication shortages.

**Independent Test**: Can be tested by: Manager adding a product → Vet dispensing it during a visit → Manager confirming stock count decreased accordingly → Low-stock alert appearing.

**Acceptance Scenarios**:

1. **Given** a Clinic Manager is logged in, **When** they add a new product (name, SKU, unit, reorder threshold, current quantity), **Then** the product appears in the inventory list with current stock.
2. **Given** a Vet dispenses a medication during a visit record, **When** the record is saved, **Then** the dispensed quantity is automatically deducted from inventory without manual intervention.
3. **Given** a product's stock falls at or below its reorder threshold, **When** this is detected, **Then** the Clinic Manager and Platform Admin receive a low-stock alert.
4. **Given** a Manager records a stock replenishment (supplier, quantity, unit cost), **When** the entry is saved, **Then** the total cost is recorded for financial reporting and the stock count is updated.

---

### User Story 5 — Billing & Invoicing (Priority: P2)

After a clinical visit, a Cashier generates an invoice covering services and dispensed medications. The Pet Owner pays, and a receipt is issued. Financial reports are available to the Clinic Manager.

**Why this priority**: Revenue collection is critical to clinic operations. Accurate billing directly tied to clinical records prevents disputes.

**Independent Test**: Can be tested by: Cashier creating an invoice from a completed visit → adding line items → marking as paid → Pet Owner viewing receipt in PWA.

**Acceptance Scenarios**:

1. **Given** a visit is marked as complete by the Vet, **When** the Cashier opens the billing screen for that visit, **Then** services rendered and dispensed medications are pre-populated as invoice line items.
2. **Given** a Cashier reviews the invoice, **When** they confirm and issue it, **Then** the total amount is calculated, the invoice status changes to "Issued", and the Pet Owner can view it in the PWA.
3. **Given** a Pet Owner pays (cash or card), **When** the Cashier marks the invoice as paid, **Then** the invoice status changes to "Paid", a receipt is generated, and the transaction is recorded in the financial ledger.
4. **Given** a Clinic Manager accesses reports, **When** they select a date range, **Then** they can view total revenue, outstanding invoices, and per-service revenue breakdown.
5. **Given** an invoice contains an error before payment, **When** the Cashier voids it, **Then** the voided invoice is retained in the audit trail and a corrected invoice can be issued.

---

### User Story 6 — Pet Owner Mobile PWA (Priority: P2)

A Pet Owner can manage their pets, book appointments, view medical records and prescriptions, and receive notifications entirely from a mobile browser without installing a native app.

**Why this priority**: The Pet Owner experience drives engagement and differentiates Petiatrics as a B2C product. Must be mobile-first and offline-capable for key views.

**Independent Test**: Can be tested entirely from a mobile browser: login → view pets → view records → book appointment.

**Acceptance Scenarios**:

1. **Given** a Pet Owner opens the PWA URL on a mobile browser, **When** they log in, **Then** they see a home screen listing their registered pets within 2 seconds on a 4G connection.
2. **Given** a Pet Owner selects a pet, **When** they navigate to Health Records, **Then** they can view all past visit summaries, diagnoses, and prescriptions in chronological order.
3. **Given** the PWA is added to the home screen, **When** the owner opens it in low-connectivity conditions, **Then** previously loaded pet profiles and records are available from local cache.
4. **Given** a Pet Owner has a confirmed appointment, **When** a notification is enabled, **Then** they receive an in-app push notification as a reminder 24 hours before the appointment.

---

### User Story 7 — Audit Trail & Compliance (Priority: P3)

All data mutations (create, update, delete) across clinical and financial records are automatically logged with actor identity, timestamp, and before/after values. Audit logs are immutable and accessible to authorized reviewers.

**Why this priority**: Regulatory and trust requirement. Ensures accountability and supports fraud investigation. Immutable logs protect the platform from disputes.

**Independent Test**: Can be tested by: making any edit to a record → checking the audit log view shows the correct before/after diff with actor info.

**Acceptance Scenarios**:

1. **Given** any authorized user modifies a clinical or financial record, **When** the change is committed, **Then** an audit entry is automatically created containing: actor ID, role, timestamp, entity type, entity ID, operation type, before-state, and after-state.
2. **Given** a Platform Admin opens the Audit Log viewer, **When** they filter by clinic, date range, or actor, **Then** the matching audit entries are displayed.
3. **Given** an audit log entry exists, **When** any user (including admins) attempts to edit or delete it, **Then** the operation is rejected — audit logs are immutable.

---

### Edge Cases

- What happens when a pet owner's account is linked to multiple clinics?
- How does the system handle time zone differences between the server and the clinic's local time for appointment scheduling?
- What happens when a medication is dispensed during a visit but the inventory record for that item does not exist? → **Resolved**: Visit saves successfully; prescription flagged as "unlinked to inventory"; no stock deduction; Manager sees unlinked items for resolution.
- How does the system behave when the MongoDB service is temporarily unavailable (medical records write failure)?
- What happens when two Receptionists attempt to book the same appointment slot simultaneously (race condition)?
- How does the system handle a clinic that exceeds their subscription tier's patient or user limits?
- What happens when a Pet Owner's invited account has not yet been verified but a new visit is created for their pet?

---

## Requirements *(mandatory)*

### Functional Requirements

#### Identity & Access Module

- **FR-001**: The system MUST support multi-tenant isolation — all data access operations MUST be scoped to the authenticated user's `clinic_id`.
- **FR-002**: The system MUST implement session-based authentication with an HttpOnly Secure cookie, storing session context (user ID, clinic ID, role) in Redis.
- **FR-003**: The system MUST enforce Role-Based Access Control (RBAC) with the following predefined roles: Platform Admin, Clinic Manager, Veterinarian, Receptionist, Cashier.
- **FR-004**: A Clinic Manager MUST be able to invite staff by email, assign roles, and deactivate user accounts.
- **FR-005**: Session revocation by an administrator MUST take effect immediately on the next request from the affected user.
- **FR-005a**: The system MUST lock a user account after a configurable number of consecutive failed login attempts (default: 5). The account MUST be automatically unlocked after a configurable lockout duration (default: 15 minutes). Failed attempt counters reset on successful login.
- **FR-005b**: The system MUST enforce a configurable password policy. Default minimum requirements: 8+ characters, at least 1 uppercase letter, at least 1 number. Platform Admins MUST be able to adjust password policy rules (minimum length, required character classes) via platform settings.
- **FR-006**: The system MUST support a Platform Admin role that can view all clinics, manage subscription tiers, and access cross-tenant audit data without accessing clinical PII.

#### Clinical Module

- **FR-007**: Receptionists MUST be able to register new patients (pets) with species, breed, date of birth, weight, and an associated pet owner account.
- **FR-008**: Veterinarians MUST be able to create, edit, and finalize visit records using a structured SOAP (Subjective, Objective, Assessment, Plan) format. Visit records follow this lifecycle: `Draft → Finalized → Amended`. A Draft record is freely editable by the authoring Vet. Finalizing a record marks it as complete and triggers billing eligibility (FR-020).
- **FR-009**: Each visit record MUST support attaching: prescriptions, diagnostic results (as file attachments), and vaccination records.
- **FR-010**: Medical record history for a patient MUST be displayed in reverse-chronological order with filtering by date range and record type.
- **FR-011**: The system MUST prevent Cashiers and Receptionists from editing finalized visit notes. The authoring Veterinarian may edit a Finalized record within 24 hours of finalization (record remains in Finalized state). After 24 hours, only a Clinic Manager may perform an amendment, which transitions the record to the `Amended` state. All Amended records MUST include a mandatory amendment reason.

#### Appointment Module

- **FR-012**: Pet Owners MUST be able to request appointments via the PWA, selecting: clinic, preferred date, start time, estimated duration, pet, and reason for visit. Scheduling is fully free-form (no fixed slot grid); the Receptionist or Pet Owner specifies start time and duration.
- **FR-013**: The system MUST prevent double-booking of the same Veterinarian for overlapping time ranges. Overlap detection is based on `(scheduled_at, scheduled_at + duration)` intervals.
- **FR-014**: Appointment status MUST follow this lifecycle: `Requested → Confirmed → In-Progress → Completed → Cancelled`.
- **FR-015**: An automated reminder notification MUST be sent to the Pet Owner 24 hours before a confirmed appointment.

#### Inventory Module

- **FR-016**: Clinic Managers MUST be able to manage a product catalog of medications and supplies (name, SKU, category, unit of measure, reorder threshold).
- **FR-017**: When a Veterinarian adds a dispensed item to a visit record, the system MUST attempt to match it to an existing inventory product and automatically decrement the corresponding stock. If no matching product exists in inventory, the visit record MUST still be saved successfully — the prescription item is flagged as `inventory_linked: false` and no stock deduction occurs. The Clinic Manager MUST be able to view all unlinked prescription items via an "Unlinked Items" alert or report for manual resolution.
- **FR-018**: The system MUST trigger a low-stock alert when a product's quantity reaches or falls below its configured reorder threshold.
- **FR-019**: Every stock change (dispense, replenishment, manual adjustment) MUST be recorded with quantity before, quantity after, actor, and timestamp.

#### Billing Module

- **FR-020**: When a visit is marked complete, the system MUST pre-populate an invoice draft with all services and dispensed medications from that visit.
- **FR-021**: Invoice line items MUST include: description, quantity, unit price, and calculated subtotal. A tax rate MUST be configurable per clinic.
- **FR-022**: Invoices MUST support the following status lifecycle: `Draft → Issued → Paid → Voided`.
- **FR-023**: Void operations MUST retain the original invoice record in the system; a void creates an immutable record with the voiding actor and reason.
- **FR-024**: Clinic Managers MUST be able to generate financial reports filtered by date range, showing total revenue, outstanding invoices, and per-service breakdown.

#### Platform Admin Module

- **FR-025**: Platform Admins MUST be able to register, suspend, and reactivate clinic tenants.
- **FR-026**: The system MUST support configurable subscription tiers (e.g., Free, Standard, Premium) with per-tier limits on active users, patients, and storage.
- **FR-027**: Platform Admins MUST be able to access aggregated platform-level metrics: total clinics, total active users, monthly transaction volume.
- **FR-027a**: The system MUST support internationalization (i18n) with Thai (`th`) and English (`en`) as available languages from launch. Users MUST be able to select their preferred language at login or via a persistent language switcher. All UI text (labels, messages, notifications, empty states) MUST be served from locale resource files, not hardcoded.

#### Audit & Compliance Module

- **FR-028**: All write operations (create, update, delete) on clinical records, invoices, inventory, and user accounts MUST be automatically captured in an immutable audit log.
- **FR-029**: Each audit log entry MUST contain: `entity_type`, `entity_id`, `operation`, `actor_id`, `actor_role`, `clinic_id`, `timestamp`, `before_state` (JSON), `after_state` (JSON).
- **FR-030**: Audit log entries MUST be immutable — no update or delete operations should be permitted on audit records, even by Platform Admins.

### Key Entities

#### PostgreSQL (Relational — Structured / Financial)

- **Clinic**: Tenant record. Attributes: `id`, `name`, `tax_id`, `address`, `subscription_tier`, `status`, `settings` (JSONB — configurable values: `max_login_attempts`, `lockout_duration_minutes`, `password_min_length`, `password_require_uppercase`, `password_require_number`), `created_at`.
- **User**: Platform user. Attributes: `id`, `clinic_id` (nullable for platform admins), `email`, `password_hash`, `role`, `status`, `invited_by`, `failed_login_attempts`, `locked_until`, `preferred_locale` (enum: `th | en`, default: `th`), `created_at`.
- **Appointment**: Attributes: `id`, `clinic_id`, `patient_id`, `vet_user_id`, `requested_at`, `scheduled_at`, `duration_minutes`, `status`, `reason`. Scheduling is free-form: any start time and duration are accepted; overlap detection uses the `(scheduled_at, scheduled_at + duration_minutes)` interval per vet.
- **Product**: Inventory item. Attributes: `id`, `clinic_id`, `name`, `sku`, `category`, `unit`, `quantity`, `reorder_threshold`.
- **StockMovement**: Attributes: `id`, `clinic_id`, `product_id`, `delta`, `reason`, `actor_id`, `created_at`.
- **Invoice**: Attributes: `id`, `clinic_id`, `visit_id`, `patient_id`, `subtotal`, `tax_rate`, `total`, `status`, `issued_at`, `paid_at`.
- **InvoiceLineItem**: Attributes: `id`, `invoice_id`, `description`, `quantity`, `unit_price`, `subtotal`, `item_type` (service | product).
- **Session**: Redis-backed (not a DB table). Context object: `{ session_id, user_id, clinic_id, role, expires_at }`.

#### MongoDB (Document — Flexible / Clinical)

- **PetProfile**: `{ _id, clinic_id, owner_user_id, name, species, breed, date_of_birth, weight_kg, photo_url, created_at }`.
- **VisitRecord**: `{ _id, clinic_id, patient_id, vet_id, visit_date, soap: { subjective, objective, assessment, plan }, prescriptions: [{ drug, dosage, frequency, duration, product_id` (nullable — null if unlinked)`, inventory_linked` (boolean)` }], attachments: [{ type, url }], status` (enum: `Draft | Finalized | Amended`)`, finalized_at, amended_at, amended_by, amendment_reason }`.
- **VaccinationRecord**: `{ _id, clinic_id, patient_id, vaccine_name, administered_at, next_due_at, batch_number, vet_id }`.
- **AuditLog**: `{ _id, clinic_id, entity_type, entity_id, operation, actor_id, actor_role, timestamp, before_state, after_state }`.

---

## API Structure

> All endpoints are prefixed with `/api/v1`. All responses follow the envelope format: `{ data, meta, error }`. All clinic-scoped endpoints require an authenticated session cookie. The `clinic_id` is injected server-side from the session — clients MUST NOT send `clinic_id` in request bodies.

### Identity & Auth

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/auth/login` | Authenticate user, set session cookie | Public |
| POST | `/auth/logout` | Invalidate session, clear cookie | Authenticated |
| GET | `/auth/me` | Return current user context | Authenticated |
| POST | `/admin/clinics` | Register a new clinic tenant | Platform Admin |
| PATCH | `/admin/clinics/:id/status` | Suspend or reactivate clinic | Platform Admin |
| POST | `/clinic/staff/invite` | Invite a staff member by email | Clinic Manager |
| PATCH | `/clinic/staff/:id/role` | Update a staff member's role | Clinic Manager |
| DELETE | `/clinic/staff/:id` | Deactivate a staff member | Clinic Manager |

### Clinical

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/patients` | Create a new patient (pet) | Receptionist, Manager |
| GET | `/patients` | List all patients for the clinic | All staff |
| GET | `/patients/:id` | Get patient details + visit history | All staff, Pet Owner (own pets) |
| POST | `/patients/:id/visits` | Create a new visit record | Veterinarian |
| PATCH | `/patients/:id/visits/:visitId` | Update a visit record | Veterinarian (within 24h), Manager |
| POST | `/patients/:id/visits/:visitId/finalize` | Finalize a visit (locks editing) | Veterinarian |
| POST | `/patients/:id/vaccinations` | Add a vaccination record | Veterinarian |

### Appointments

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/appointments` | Request or create an appointment | Pet Owner, Receptionist |
| GET | `/appointments` | List appointments (calendar view) | All staff |
| GET | `/appointments/:id` | Get appointment detail | All staff, Pet Owner (own) |
| PATCH | `/appointments/:id/status` | Update appointment status | Receptionist, Manager, Vet |
| DELETE | `/appointments/:id` | Cancel appointment | Pet Owner (own, ≥2h notice), Receptionist |

### Inventory

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/inventory/products` | Add a new product | Manager |
| GET | `/inventory/products` | List all products with stock levels | Manager, Vet |
| PATCH | `/inventory/products/:id` | Update product details or threshold | Manager |
| POST | `/inventory/stock/replenish` | Record a stock replenishment | Manager |
| GET | `/inventory/stock/movements` | View stock movement history | Manager |

### Billing

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/billing/invoices` | Create invoice (auto-populated from visit) | Cashier |
| GET | `/billing/invoices` | List invoices for the clinic | Cashier, Manager |
| GET | `/billing/invoices/:id` | Get invoice details | Cashier, Manager, Pet Owner (own) |
| PATCH | `/billing/invoices/:id/issue` | Issue an invoice to the pet owner | Cashier |
| PATCH | `/billing/invoices/:id/pay` | Mark invoice as paid | Cashier |
| PATCH | `/billing/invoices/:id/void` | Void an invoice | Cashier, Manager |
| GET | `/billing/reports` | Financial report by date range | Manager |

### Pet Owner (PWA)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/owner/pets` | List pet owner's registered pets | Pet Owner |
| GET | `/owner/pets/:id/records` | View pet's full medical history | Pet Owner |
| GET | `/owner/appointments` | List owner's upcoming appointments | Pet Owner |
| GET | `/owner/invoices` | List owner's invoices and receipts | Pet Owner |

### Audit

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/audit/logs` | Query audit log (filter by entity, actor, date) | Manager, Platform Admin |

---

## UI Requirements

### Design Principles

- **Clinic Staff Portal**: Desktop-first (minimum 1280px width). Dense information layout. Keyboard-navigable workflows. Quick-access command palette for power users.
- **Pet Owner PWA**: Mobile-first (minimum 375px). Touch-optimized. Offline support for previously loaded data (via Service Worker caching). Maximum 3 taps to reach any core action.
- **Admin Portal**: Functional and data-dense. Standard web dashboard patterns.
- **Shared**: High-contrast accessible color system. WCAG 2.1 AA minimum. All interactive elements have visible focus indicators.
- **Localization**: Full i18n support from day one. Supported languages: Thai (`th`) and English (`en`). Users select their preferred language at login or from a language switcher in the header. All UI labels, form validation messages, system notifications, and empty-state text MUST be translatable. Date format follows locale convention (`DD/MM/YYYY` for Thai, `MM/DD/YYYY` for English). Currency displays as `THB (฿)` for Thai locale. SOAP notes and free-text clinical fields are not translated — they accept any language input.

### Admin Portal — Key Screens

| Screen | Key Components | Data Shown |
|--------|---------------|------------|
| Clinic List | Data table (name, status, tier, user count, patient count); actions: Suspend, Activate | All clinics |
| Clinic Detail | Tabs: Info, Users, Usage, Billing; editable fields | Single clinic |
| Platform Metrics | KPI cards: total clinics, MAU, MRR, storage; charts: growth over time | Aggregated |
| Audit Log | Filterable table (date, entity, actor, clinic); expandable Before/After JSON diff | Cross-tenant |

### Clinic Staff Portal — Key Screens

| Screen | Key Components | Data Shown |
|--------|---------------|------------|
| Dashboard | Today's appointments list, quick-action buttons (New Patient, New Appointment), low-stock alerts badge | Today's data |
| Appointment Calendar | Week/day view calendar; free-form time blocks (variable duration); drag-to-reschedule; color-coded by status; overlap warning on conflict | Clinic appointments |
| Patient List | Searchable/filterable table (name, species, breed, last visit); quick-open patient | All clinic patients |
| Patient Profile | Tabs: Info, Medical History, Vaccinations, Billing; timeline of visits | Single patient |
| Visit Record Form | SOAP structured form; inline prescription builder; file attachment uploader | Single visit |
| Inventory Dashboard | Stock table with inline quantity editing; low-stock row highlighting; movement log | All products |
| Billing Screen | Invoice builder from visit; line item table; payment confirmation dialog | Single invoice |
| Staff Management | User table (name, role, status); invite via email; role dropdown | Clinic staff |

### Pet Owner PWA — Key Screens

| Screen | Key Components | Data Shown |
|--------|---------------|------------|
| Home | Pet avatar cards; upcoming appointment banner; notification bell | Owner's pets + next appt |
| Pet Detail | Health summary card; records timeline; vaccination status chips | Single pet |
| Visit Record View | Read-only SOAP summary in plain language; prescription cards; attached files | Single visit |
| Book Appointment | Multi-step flow: select clinic → select service → pick date + start time + duration → confirm; visual availability indicator | Availability |
| Appointments List | Upcoming / past tabs; status badge; cancel action for upcoming | Owner's appointments |
| Invoice List | Amount, status badge (Issued/Paid); PDF download button | Owner's invoices |

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new clinic can be registered and have its first staff member operational within 10 minutes of receiving their invitation.
- **SC-002**: A Veterinarian can create and finalize a complete visit record (SOAP + prescription) in under 3 minutes per patient.
- **SC-003**: A Pet Owner can book an appointment on the PWA in under 2 minutes from login to confirmation.
- **SC-004**: The clinic appointment calendar loads and displays all appointments for the current week in under 2 seconds on a standard broadband connection.
- **SC-005**: Stock levels are automatically updated within 5 seconds of a visit record being saved containing dispensed items.
- **SC-006**: An invoice is automatically pre-populated with visit data and ready for Cashier review within 3 seconds of the Vet marking a visit as complete.
- **SC-007**: 100% of write operations on clinical and financial records produce a corresponding audit log entry — no mutation should be untracked.
- **SC-008**: Session revocation by an administrator takes effect within one request cycle — no grace period.
- **SC-009**: The Pet Owner PWA achieves a Lighthouse Performance score of ≥ 85 on a mid-range mobile device simulation.
- **SC-010**: All data access is tenant-isolated — no query, test, or API response should return records belonging to a different `clinic_id` than the authenticated session.

---

## Assumptions

- All users have stable internet connectivity during active sessions; the PWA Service Worker cache covers previously loaded data for offline viewing only.
- The initial version (Phase 0) does not support multiple branches/locations per clinic; each clinic is a single physical location.
- File attachments (diagnostic results, X-rays) are stored in an object storage service; the API stores only the URL reference, not the binary content.
- Notification delivery (appointment reminders) is handled via a third-party service; the Platform's responsibility is to generate and dispatch the notification payload.
- The system does not process online payments in Phase 0; payment is recorded manually by the Cashier after collection.
- Pet Owner accounts are created through clinic invitation or via the PWA registration flow linked to a clinic; self-registration without a clinic link is not supported in Phase 0.
- All monetary values are stored as integers (smallest currency unit) to avoid floating-point precision errors.
- A single user email can only be associated with one clinic in Phase 0; cross-clinic staff portability is a future-phase concern.
- Time zones: All appointment times are stored in UTC and displayed in the clinic's configured local time zone.
- Localization: Thai and English are supported from Phase 0. All UI strings are externalized in locale resource files (`th.json`, `en.json`). Clinical free-text (SOAP notes, prescriptions) is not translated — entered in any language by the user.
