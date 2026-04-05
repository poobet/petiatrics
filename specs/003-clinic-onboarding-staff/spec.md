# Feature Specification: Clinic Onboarding, Staff Creation, and Dual Authentication

**Feature Branch**: `003-clinic-onboarding-staff`
**Created**: 2026-04-05
**Status**: Draft
**Input**: Merged from two related feature requests:
- Clinic Onboarding & Staff Creation — registration, approval/rejection, manual staff provisioning, portal role separation.
- Dual Login Methods & Staff Username Authentication — clinic slug, identifier-based login, username-based staff accounts.

## Overview

This feature introduces a gated onboarding flow for new clinics, replaces invite-based staff provisioning with owner-managed staff creation, tightens portal separation between admin and clinic roles, and refactors authentication to support two distinct login paths based on user type.

The feature has four linked outcomes:

1. A guest can request a new clinic registration without receiving access immediately.
2. A platform administrator can review pending requests and explicitly approve or reject them. Approval activates the clinic and its initial owner.
3. A clinic owner can create staff accounts directly inside the clinic portal using a username prefix and a temporary password. Staff accounts do not require an email address.
4. Platform administrators and clinic owners log in using their email address. Clinic staff log in using a composite `<username>@<clinic-slug>` identifier that the system assembles automatically when the owner creates a staff account.

Two guiding principles apply throughout:

- **Zero-trust tenant assignment**: clinic ownership, clinic membership, and route access are always derived from authenticated server context — never from request body values or client-selected portal paths.
- **Unambiguous identifier resolution**: the two login paths are distinguished by detecting whether the suffix after `@` in the login identifier matches a known clinic slug in the database.

---

## Clarifications

### Session 2026-04-05

**From the clinic onboarding & staff creation review:**

- Q: When a clinic owner creates a staff member, should the owner assign branches during creation, auto-assign all branches, or leave branch assignment for later? → A: Owner selects one or more branches during staff creation.
- Q: Must a staff member created with a temporary password change it on first login? → A: Yes, force password change on first login.
- Q: Should admins be able to reject pending clinic requests, or is rejection out of scope? → A: Add a reject action that moves the clinic to a terminal rejected state with no resubmission.
- Q: Should the public registration endpoint have rate limiting to prevent spam and enumeration? → A: Yes, apply a per-IP rate limit (e.g., 5 requests per 15 minutes).
- Q: Should the new manual staff creation flow replace or coexist with the existing invite-based flow? → A: Replace it — remove or deprecate the existing invite endpoint.

**From the dual authentication merge:**

- Q: How should staff authenticate if they have no email address? → A: Staff log in using a composite `username@clinic-slug` identifier, where the clinic slug is auto-appended by the system during staff creation.
- Q: How is the clinic slug generated? → A: Automatically derived from the clinic name at clinic creation time; immutable after creation.
- Q: Should email be required for staff accounts? → A: Email is optional for staff. Only clinic owners and platform admins require an email address.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guest Requests Clinic Registration (Priority: P1)

A prospective clinic owner visits the public registration page, enters clinic and owner details, and submits a request for platform approval. The system records the clinic and owner in a pending state and clearly communicates that login is unavailable until approval is granted.

**Why this priority**: This is the entry point for all new clinic onboarding. Without it, the approval workflow and owner activation flow cannot occur.

**Independent Test**: Can be fully tested by submitting the registration form and confirming that a pending clinic record and a pending clinic-owner record are created, that no active session is issued, and that the UI shows a pending-review confirmation state.

**Acceptance Scenarios**:

1. **Given** a guest provides all required clinic and owner details, **When** they submit the registration request, **Then** the system creates a clinic in a pending state, creates a clinic-owner user in a pending state, and returns a success response that states approval is required before login.
2. **Given** a guest submits a clinic tax identifier or owner email that already exists, **When** the request is processed, **Then** the system rejects the request with field-level validation errors and does not create duplicate records.
3. **Given** a clinic registration request has been submitted successfully, **When** the owner immediately attempts to log in, **Then** the system blocks access because the owner account is still pending.

---

### User Story 2 - Platform Admin Approves a Pending Clinic (Priority: P1)

A platform administrator opens the clinic approval queue, reviews pending registration requests, and approves a clinic. Approval activates both the clinic and its owner so the owner can log in and begin managing staff.

**Why this priority**: Approval is the control point that prevents unreviewed clinics from entering the platform while still enabling self-service requests.

**Independent Test**: Can be fully tested by creating a pending clinic request, viewing it in the admin clinic list, approving it, and verifying that both clinic and owner transition to an active state.

**Acceptance Scenarios**:

1. **Given** a pending clinic request exists, **When** a platform administrator approves it, **Then** the clinic becomes active, the clinic owner becomes active, and the request no longer appears as pending.
2. **Given** an already active clinic is selected for approval, **When** the administrator attempts to approve it again, **Then** the system returns a clear no-op or conflict response and does not duplicate side effects.
3. **Given** a non-admin user attempts to call the clinic approval action, **When** the request reaches the backend, **Then** the system denies it.
4. **Given** a pending clinic request exists, **When** a platform administrator rejects it with an optional reason, **Then** the clinic transitions to a terminal rejected state, the associated owner account is deactivated, and the request is no longer actionable.
5. **Given** a rejected clinic, **When** any user attempts to approve or reject it again, **Then** the system returns a conflict response indicating the clinic is already in a terminal state.

---

### User Story 3 - Clinic Slug Is Established for Each Clinic (Priority: P1)

Each clinic has a unique, URL-friendly short name (the slug) that feeds the staff username system. The slug is derived automatically from the clinic name at registration time and is immutable after creation. Every staff login identifier includes this slug as its domain suffix.

**Why this priority**: All staff username lookups depend on the slug being stable and unique per clinic. It must exist before any staff account can be created or authenticated.

**Independent Test**: Can be fully tested by registering a clinic, confirming a slug is auto-generated from the clinic name, creating one staff member, and verifying the stored staff username contains that slug.

**Acceptance Scenarios**:

1. **Given** a clinic registration request with clinic name `Happy Paws`, **When** the clinic is created, **Then** a URL-friendly slug such as `happy-paws` is automatically generated and stored without requiring any input from the requester.
2. **Given** two clinics with similar names that would produce the same slug after normalisation, **When** the second clinic is created, **Then** the system generates a unique variant (e.g., by appending a short disambiguator) without failing.
3. **Given** a clinic with an established slug, **When** any user or admin attempts to change the slug, **Then** the system rejects the mutation.

---

### User Story 4 - Clinic Owner Creates Staff with a Username (Priority: P1)

An approved clinic owner opens the staff creation form, fills in the staff member's name, role, branch assignments, and a temporary password. Instead of an email field, the form shows a username prefix field with a read-only `@<clinic-slug>` suffix appended as a visual indicator. The owner types a prefix such as `somchai` and sees the full login identifier `somchai@happy-paws` before submitting. The system stores this as the staff member's login identifier.

**Why this priority**: Staff creation is the first operational task after onboarding and is now the only provisioning path. Without it, no staff can access the clinic portal.

**Independent Test**: Can be fully tested by logging in as an approved clinic owner, creating a staff member with prefix `somchai` in a clinic with slug `happy-paws`, confirming the stored username is `somchai@happy-paws`, and logging in with that identifier.

**Acceptance Scenarios**:

1. **Given** a clinic owner with a clinic slug of `happy-paws`, **When** they enter username prefix `somchai` and submit the staff creation form, **Then** the system creates an active staff account with full username `somchai@happy-paws` and returns the account without exposing a password hash.
2. **Given** an authenticated clinic owner includes a different `clinicId` in the request body, **When** the backend processes the request, **Then** the system ignores that value and assigns the staff account to the clinic resolved from the authenticated tenant context.
3. **Given** a clinic owner attempts to create a staff member with a username prefix that already exists in their clinic, **When** the request is processed, **Then** the system rejects it with a conflict error without creating a duplicate.
4. **Given** a non-owner clinic user attempts to create staff, **When** they submit the form or call the endpoint directly, **Then** the system denies the action.
5. **Given** a newly created staff member logs in with the temporary password, **When** authentication succeeds, **Then** the system flags the session as requiring a password change and redirects the user to a forced password-change screen before granting access to any clinic portal page.
6. **Given** the staff creation form is rendered, **When** the owner views the username field, **Then** the form displays the `@<clinic-slug>` suffix as a non-editable visual indicator of the final login identifier.

---

### User Story 5 - Clinic Staff Logs In via Username (Priority: P1)

A clinic staff member opens the login page and enters their composite username in the form `<username>@<clinic-slug>` along with their password. The system recognises this as a staff identifier, looks up the user by username, and creates an authenticated session.

**Why this priority**: Staff accounts have no email address. Without this login path, staff with no email cannot access the platform.

**Independent Test**: Can be fully tested by creating a staff account with no email, logging in with `<username>@<clinic-slug>`, and confirming session creation and redirect to `/clinic/dashboard`.

**Acceptance Scenarios**:

1. **Given** a clinic staff member with a valid `username@clinic-slug` identifier and correct password, **When** they submit the login form, **Then** the system creates a session and redirects them to the clinic dashboard.
2. **Given** a staff member enters only their username prefix without the `@clinic-slug` suffix, **When** they submit the form, **Then** the login fails with a clear message indicating the full identifier format is required.
3. **Given** a staff member enters a `username@nonexistent-slug`, **When** the request is processed, **Then** the system returns a generic invalid-credentials error without revealing whether the slug exists.
4. **Given** a clinic owner with a valid email enters their email in the identifier field, **When** they submit the login form, **Then** the system routes them through the email authentication path and grants a session normally.
5. **Given** a staff member's account is inactive, **When** they attempt to log in with a valid username, **Then** access is denied.

---

### User Story 6 - Portal Separation Is Enforced by Role (Priority: P1)

Authenticated users are only allowed to access the portal that matches their role. Platform administrators can use admin routes only. Clinic owners and clinic staff can use clinic routes only. Pending users cannot access protected portals at all.

**Why this priority**: The onboarding and staff flows are only safe if route access remains aligned with authenticated role and status.

**Independent Test**: Can be fully tested by signing in as each relevant role and verifying redirect behavior for `/admin/*` and `/clinic/*` paths, including blocked access for pending users.

**Acceptance Scenarios**:

1. **Given** an authenticated `SUPER_ADMIN`, **When** they navigate to an admin route, **Then** the route renders normally.
2. **Given** an authenticated clinic role (`CLINIC_OWNER`, `VET`, `ASSISTANT`, `CASHIER`, or `STAFF`), **When** they navigate to an admin route, **Then** the system blocks access and redirects them to the clinic portal.
3. **Given** a pending user, **When** they attempt to log in or access a protected route, **Then** the system denies access and clears or withholds session state.
4. **Given** an unauthenticated visitor, **When** they access a protected admin or clinic route, **Then** the system redirects them to the login page before protected content is rendered.

---

### Edge Cases

- A guest submits a clinic registration request with a tax ID already used by an archived, suspended, or active clinic.
- A guest submits a registration request for an email address already assigned to any existing user record.
- A platform admin opens the clinic list while multiple requests are pending and one request is approved by another admin concurrently.
- A clinic owner refreshes the staff page after a successful create and must not see duplicate success submissions from the browser.
- A clinic owner attempts to create a staff member with a role that is not allowed for clinic-created users.
- A pending clinic owner's account becomes active while they still have an older failed login form open; the next login attempt should succeed without requiring manual data migration.
- A staff user bookmarks an admin URL and attempts to access it directly after login.
- A request body includes `clinicId`, `status`, or `role` fields that the caller is not authorized to control.
- A staff member who was created via the old invite flow and has an email-based account attempts to log in — the email path must still resolve them without modification.
- A clinic owner whose clinic does not yet have a slug attempts to create staff — the system must reject the action with a clear error rather than creating a malformed username.
- A username prefix contains characters that are invalid for a URL-friendly identifier (spaces, slashes, special characters) — the system must validate and reject these at creation time.
- Two clinics have the same slug prefix after normalisation — the slug uniqueness constraint must prevent this at the database level.
- A username prefix is identical to the local part of an existing user's email address — the system must still distinguish the two lookup paths unambiguously.
- A platform admin attempts to log in using `admin@<any-clinic-slug>` format — the system must resolve them through the email path rather than the username path because their record has an `email` value, not a `username` value.

## Requirements *(mandatory)*

### Functional Requirements

#### Registration and Approval Lifecycle

- **FR-001**: The system MUST provide a public clinic registration request flow that captures clinic details and the initial clinic-owner account details.
- **FR-002**: The system MUST create both the clinic and the initial clinic-owner user in a pending state when a registration request is submitted successfully.
- **FR-003**: The system MUST prevent pending clinic-owner accounts from authenticating until an explicit approval action activates both the clinic and the owner account.
- **FR-004**: The system MUST provide an approval action that only platform administrators can execute.
- **FR-005**: The approval action MUST activate the target clinic and its initial clinic-owner account in a single logical operation.
- **FR-005a**: The system MUST provide a rejection action that only platform administrators can execute. The rejection action MUST transition the clinic to a terminal `REJECTED` state and deactivate the associated clinic-owner account.
- **FR-005b**: A rejected clinic MUST NOT be approvable or rejectable again. Resubmission requires a new registration request.
- **FR-006**: The system MUST reject duplicate registration requests that would conflict with existing clinic identifiers or existing user email addresses.
- **FR-006a**: The public registration endpoint MUST enforce a per-IP rate limit (e.g., 5 requests per 15-minute window). Requests exceeding the limit MUST receive a `429 Too Many Requests` response without creating any records.

#### Authentication and Status Enforcement

- **FR-007**: The login flow MUST reject users whose account status is pending, invited, inactive, or locked.
- **FR-008**: The login response for rejected accounts MUST not create a session and MUST return a clear error message appropriate for a blocked account state.
- **FR-009**: The authenticated session payload MUST include the user's role, user status, and clinic membership context needed for downstream authorization.
- **FR-010**: Protected backend operations MUST use authenticated session or tenant context to resolve the caller's clinic membership and authorization level.

#### Login Identifier Resolution

- **FR-007a**: The login endpoint MUST accept a single `identifier` field that can hold either an email address or a composite username of the form `<prefix>@<clinic-slug>`.
- **FR-007b**: The system MUST distinguish the two identifier formats by checking whether the portion after the last `@` matches a known clinic slug in the database. If it matches, the identifier resolves through the username path; otherwise it resolves through the email path.
- **FR-007c**: If the identifier resolves as an email, the system MUST look up the user by email. If it resolves as a `username@clinic-slug`, the system MUST look up the user by matching the full username against users whose clinic carries that slug.
- **FR-007d**: If neither lookup finds a matching user, the system MUST return a generic `401` response that does not reveal which part of the identifier was unmatched or whether the clinic slug exists.
- **FR-007e**: Platform admins and clinic owners who authenticate via the email path MUST continue to receive a session and be routed to their role-appropriate portal as before.
- **FR-007f**: The login page MUST replace the email-specific input with a single identifier field labelled "Email or Staff Username" (or equivalent localised label). Client-side validation MUST NOT restrict the input to RFC-5322 email format alone.
- **FR-007g**: The login page MUST display a short helper text or placeholder explaining that clinic staff should use the `username@clinic-slug` format.

#### Clinic Slug

- **FR-010a**: Every clinic MUST have a unique, immutable, URL-friendly slug composed of lowercase letters, digits, and hyphens only.
- **FR-010b**: When a clinic is created (including via the public registration request), the system MUST automatically generate a slug from the clinic name by lowercasing, replacing spaces and special characters with hyphens, and ensuring uniqueness against existing slugs without requiring any input from the requester.
- **FR-010c**: The clinic slug MUST be exposed in clinic data responses so the staff creation form can display the full username suffix (`@<clinic-slug>`) to the owner.
- **FR-010d**: The clinic slug MUST be enforced as unique platform-wide at the database level.

#### Clinic Staff Provisioning

- **FR-011**: The system MUST provide a clinic-owner-only staff creation action that accepts staff profile fields and a manually entered temporary password.
- **FR-012**: Staff accounts created through this flow MUST be active immediately on successful creation.
- **FR-013**: The staff creation flow MUST assign the new staff account to the clinic derived from the authenticated clinic owner's tenant context.
- **FR-014**: The staff creation flow MUST ignore any `clinicId` value supplied by the client.
- **FR-015**: The staff creation flow MUST restrict assignable roles to clinic-level staff roles and MUST prevent creation of platform-admin users.
- **FR-016**: The staff creation response MUST return the created user record without exposing password hashes or other secrets.
- **FR-016a**: The staff creation flow MUST require the owner to assign at least one branch to the new staff member at creation time. The selectable branches MUST be limited to branches within the owner's clinic.
- **FR-016b**: Staff accounts created with a temporary password MUST be flagged to force a password change on first login. The system MUST redirect the user to a password-change screen before granting access to any protected portal page.
- **FR-016c**: After the forced password change is completed, the must-change flag MUST be cleared and the user MUST proceed to their role-appropriate dashboard without a second login.
- **FR-016d**: The existing `POST /api/v1/clinic/staff/invite` endpoint MUST be removed or deprecated as part of this feature. The manual staff creation endpoint (`POST /api/v1/clinic/staff`) is the sole provisioning path for clinic staff going forward.
- **FR-011a**: The staff creation endpoint MUST accept a `usernamePrefix` field in place of an email address.
- **FR-011b**: The system MUST concatenate `usernamePrefix + '@' + clinic.slug` to produce the full username stored on the staff user record.
- **FR-011c**: The full username MUST be globally unique at the database level.
- **FR-011d**: The staff creation endpoint MUST validate that `usernamePrefix` contains only URL-safe characters (lowercase letters, digits, hyphens, underscores) and is between 2 and 30 characters long.
- **FR-011e**: Email is optional for staff accounts. Staff accounts may be created without an email address.

#### Backwards Compatibility

- **FR-033**: Existing staff accounts that have an email address stored MUST continue to be reachable via the email login path until they are explicitly migrated or deactivated.
- **FR-034**: No existing active or invited user records MUST be deleted or invalidated as a result of this schema change.

#### Route and Portal Separation

- **FR-017**: All routes under `/admin/*` and `/clinic/*` MUST require an authenticated session.
- **FR-018**: Only `SUPER_ADMIN` users may access `/admin/*` routes.
- **FR-019**: All approved clinic roles may access `/clinic/*` routes according to their authenticated session.
- **FR-020**: Clinic staff roles MUST be blocked from `/admin/*` routes even if they manually enter the URL.
- **FR-021**: Pending users MUST be blocked from both admin and clinic portals.
- **FR-022**: Route protection MUST redirect unauthenticated users to the login page and redirect authenticated users to the portal that matches their role.

#### UI Requirements

- **FR-023**: The public registration page MUST include fields for clinic name, tax identifier, address or contact details, clinic-owner name, clinic-owner email, and clinic-owner password.
- **FR-024**: The public registration page MUST present inline validation for required fields, duplicate values, and password policy failures.
- **FR-025**: After successful registration request submission, the page MUST show a non-authenticated confirmation state that explains the request is pending admin approval.
- **FR-026**: The admin clinic list page MUST display pending clinic requests distinctly from already active clinics.
- **FR-027**: The admin clinic list page MUST provide an approve action for each pending request and surface success or failure feedback without requiring the user to infer status changes.
- **FR-027a**: The admin clinic list page MUST provide a reject action for each pending request. The reject action MUST accept an optional reason and surface success or failure feedback.
- **FR-028**: The clinic staff page MUST provide a manual staff creation form with fields for staff name, username prefix, role, temporary password, branch assignment (one or more branches), and any required contact details.
- **FR-028a**: The username prefix field MUST display a non-editable `@<clinic-slug>` suffix so the owner can preview the full login identifier before submission. The form MUST validate the prefix inline (min/max length, allowed characters).
- **FR-028b**: The form MUST display the complete computed username (e.g., `somchai@happy-paws`) in a summary or confirmation area before or after submission so the owner can communicate it to the staff member.
- **FR-028c**: The branch selector in the staff creation form MUST only display branches belonging to the owner's clinic and MUST require at least one selection before submission.
- **FR-029**: The clinic staff page MUST disable submission while a create request is in flight and MUST show field-level validation feedback when input is invalid.
- **FR-030**: The clinic staff page MUST show enough information after creation for the owner to confirm which staff member was created and which temporary password policy applies.

#### Auditability and Safety

- **FR-031**: The system MUST record auditable create and approve actions for clinic registration requests, clinic approval, and staff creation.
- **FR-032**: The approval and staff-creation flows MUST be idempotent or conflict-safe enough to prevent duplicate account creation from repeated submissions.

### Data & API Structures

#### Data Model Changes

- `Clinic` gains a `slug` field: unique, non-nullable, generated at create time, immutable.
- `Clinic` gains a `PENDING` and `REJECTED` status value in addition to its existing operational states.
- `User.email` becomes optional (nullable). Existing email values are preserved.
- `User` gains a `username` field: optional, globally unique when present. Staff accounts are identified by `username`; owners and admins continue to be identified by `email`.
- `User` gains a `PENDING` status value so clinic owners can be blocked from login until approval.
- Login identifier lookup uses the `email` field when the full identifier contains no `@`-suffix matching a known clinic slug; uses `username` when the suffix resolves to a known clinic slug.

#### `POST /api/v1/auth/login`

**Purpose**: Authenticate a user by email or staff username.

**Request Body**:

```json
{
  "identifier": "string",
  "password":   "string"
}
```

The `identifier` field accepts both `user@example.com` and `somchai@happy-paws` formats. The backend resolves which lookup path to use based on whether the `@` suffix matches a known clinic slug.

**Success Response `200 OK`**: Returns `AuthProfile` shape with session cookie — unchanged from prior authentication spec.

**Error Responses**:

- `401 Unauthorized` — identifier not found, password incorrect, or account is inactive/locked/pending
- `400 Bad Request` — missing or empty fields

#### Login Identifier Resolution Logic

```
identifier = <input value>.trim().toLowerCase()

if identifier contains '@':
    suffix = part after last '@'
    prefix = part before last '@'

    clinic = lookup clinic where slug == suffix
    if clinic found:
        user = lookup user where username == identifier AND clinicId == clinic.id
        → username-based authentication path
    else:
        user = lookup user where email == identifier
        → email-based authentication path
else:
    user = lookup user where email == identifier
    → email-based authentication path
```

This ensures platform admins whose email domain matches a clinic slug still resolve correctly because their record has an `email` value, not a `username` value.

---

#### `POST /api/v1/auth/register-request`

**Purpose**: Publicly submit a clinic registration request.

**Request Body**:

```json
{
  "clinicName": "string",
  "taxId": "string",
  "address": {
    "line1": "string",
    "line2": "string",
    "district": "string",
    "province": "string",
    "postalCode": "string"
  },
  "ownerName": "string",
  "ownerEmail": "string",
  "password": "string",
  "phone": "string"
}
```

**Success Response `201 Created`**:

```json
{
  "clinicId": "string",
  "ownerUserId": "string",
  "clinicStatus": "PENDING",
  "ownerStatus": "PENDING",
  "message": "Your clinic registration request has been submitted for review."
}
```

**Error Responses**:

- `400 Bad Request` for invalid or incomplete fields
- `409 Conflict` for duplicate tax ID or owner email
- `429 Too Many Requests` if per-IP rate limit is exceeded

A clinic `slug` is automatically derived from `clinicName` server-side during creation. No slug field is accepted in the request body. No authenticated session or login cookie is created by this endpoint.

---

#### `PATCH /api/v1/admin/clinics/:id/approve`

**Purpose**: Approve a pending clinic request as a platform administrator.

**Request Body**:

```json
{
  "note": "string"
}
```

The note is optional and intended for internal audit context.

**Success Response `200 OK`**:

```json
{
  "clinicId": "string",
  "clinicStatus": "ACTIVE",
  "ownerUserId": "string",
  "ownerStatus": "ACTIVE",
  "approvedAt": "ISO-8601 datetime"
}
```

**Error Responses**:

- `403 Forbidden` if caller is not a platform administrator
- `404 Not Found` if clinic does not exist
- `409 Conflict` if clinic is not in an approvable state

---

#### `PATCH /api/v1/admin/clinics/:id/reject`

**Purpose**: Reject a pending clinic request as a platform administrator.

**Request Body**:

```json
{
  "reason": "string"
}
```

The reason is optional and intended for internal audit context.

**Success Response `200 OK`**:

```json
{
  "clinicId": "string",
  "clinicStatus": "REJECTED",
  "ownerUserId": "string",
  "ownerStatus": "INACTIVE",
  "rejectedAt": "ISO-8601 datetime"
}
```

**Error Responses**:

- `403 Forbidden` if caller is not a platform administrator
- `404 Not Found` if clinic does not exist
- `409 Conflict` if clinic is not in a rejectable (pending) state

---

#### `GET /api/v1/admin/clinics`

**Purpose**: Display clinic requests and operational clinics in the admin portal.

**List Item Shape**:

```json
{
  "id": "string",
  "name": "string",
  "slug": "string",
  "taxId": "string",
  "status": "PENDING | ACTIVE | SUSPENDED | ARCHIVED | REJECTED",
  "owner": {
    "id": "string",
    "name": "string",
    "email": "string",
    "status": "PENDING | ACTIVE | INACTIVE | LOCKED | INVITED"
  },
  "createdAt": "ISO-8601 datetime"
}
```

Pending clinics MUST be distinguishable in the response so the UI can render approval actions without guessing.

---

#### `POST /api/v1/clinic/staff`

**Purpose**: Create a clinic staff user directly from the clinic portal.

**Request Body**:

```json
{
  "name":              "string",
  "usernamePrefix":    "string",
  "role":              "VET | ASSISTANT | CASHIER | STAFF",
  "temporaryPassword": "string",
  "phone":             "string",
  "branchIds":         ["string"]
}
```

`email` is removed from the staff creation payload. The `clinicId` field is ignored if present. The `branchIds` array MUST contain at least one branch ID; the backend MUST validate that all supplied branch IDs belong to the owner's clinic.

**Success Response `201 Created`**:

```json
{
  "id":               "string",
  "username":         "string",
  "name":             "string",
  "role":             "VET | ASSISTANT | CASHIER | STAFF",
  "status":           "ACTIVE",
  "clinicId":         "string",
  "branches":         [{"id": "string", "name": "string"}],
  "mustChangePassword": true,
  "createdAt":        "ISO-8601 datetime"
}
```

**Error Responses**:

- `400 Bad Request` — invalid username prefix format or password policy failure
- `403 Forbidden` — caller is not a clinic owner
- `409 Conflict` — full username already exists

---

#### `GET /api/v1/clinic/staff`

**Purpose**: List staff members in the authenticated owner's clinic.

**List Item Shape**:

```json
{
  "id":       "string",
  "username": "string",
  "name":     "string",
  "role":     "string",
  "status":   "string"
}
```

The `email` field is replaced by `username` in the staff list response. Staff accounts created before this feature may still have a `username` value derived from migration or may show `null` if not yet migrated.

---

#### Route Protection Matrix

| Session state | Role | Allowed portal | Blocked portal behavior |
| --- | --- | --- | --- |
| Unauthenticated | N/A | None | Redirect to login |
| Authenticated | SUPER_ADMIN | `/admin/*` | Redirect from `/clinic/*` to admin landing page |
| Authenticated | CLINIC_OWNER | `/clinic/*` | Redirect from `/admin/*` to clinic landing page |
| Authenticated | VET / ASSISTANT / CASHIER / STAFF | `/clinic/*` | Redirect from `/admin/*` to clinic landing page |
| Authenticated but pending | Any | None | Deny login or clear session and redirect to login |

### Key Entities *(include if feature involves data)*

- **Clinic Registration Request**: The initial onboarding record represented by a clinic in a pending state plus an associated clinic-owner user in a pending state. It captures the information needed for review and approval.
- **Clinic**: The tenant root for all clinic-owned data. This feature expands clinic lifecycle behaviour to include a pre-approval pending state and a terminal rejected state.
- **Clinic Slug**: A unique, URL-friendly short identifier for a clinic. Automatically derived from the clinic name at creation time. Immutable after creation. Forms the domain portion of every staff username within the clinic.
- **Clinic Owner**: The first privileged user created during onboarding. The owner remains unable to log in until approval activates both the owner and clinic. Owners always have an email address and log in via the email path.
- **Clinic Staff User**: A user created by a clinic owner after approval. Staff accounts carry a `username` in the form `prefix@clinic-slug` and do not require an email address.
- **Staff Username**: The full login identifier for a clinic staff user, composed of `<usernamePrefix>@<clinic-slug>`. Globally unique. Stored in the `username` field on the user record.
- **Username Prefix**: The portion of a staff username before the `@`. Chosen by the clinic owner at staff creation time. Must be URL-safe (lowercase letters, digits, hyphens, underscores) and unique within the clinic.
- **Identifier**: The unified login field presented to all users on the login screen. Accepts both email format (for owners and admins) and full staff username format (for clinic staff).
- **Approval Decision**: The administrative action that transitions a registration request from pending to active and unlocks clinic access.
- **Portal Access Context**: The authenticated combination of user role, user status, and clinic membership used to determine whether a request may enter `/admin/*` or `/clinic/*`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A guest can submit a complete clinic registration request in under 5 minutes without administrator assistance.
- **SC-002**: 100% of pending clinic-owner accounts are blocked from successful login until an approval action activates the request.
- **SC-003**: Platform administrators can identify and approve pending clinic requests from the clinic management screen without navigating to a separate detail workflow for the standard approval case.
- **SC-004**: Clinic owners can create a staff account from the clinic portal in under 2 minutes, including manual entry of a username prefix and a temporary password.
- **SC-005**: 100% of attempts by clinic staff roles to access admin routes are denied or redirected to the clinic portal.
- **SC-006**: 100% of successful staff-creation requests result in the new user being attached to the authenticated owner's clinic, regardless of any client-supplied clinic identifier.
- **SC-007**: A clinic staff member with no email address can log in using `username@clinic-slug` format in under 30 seconds.
- **SC-008**: A clinic owner can create a new staff member and see the full computed username (`usernamePrefix@clinic-slug`) before leaving the creation form.
- **SC-009**: 100% of existing email-authenticated users continue to log in successfully without any credential change.
- **SC-010**: 100% of login attempts using an unrecognised `username@nonexistent-slug` receive a generic `401` response — the slug's existence is not distinguishable from the error.
- **SC-011**: Duplicate username creation within the same clinic is rejected 100% of the time at the database or service layer.
- **SC-012**: A clinic slug is automatically generated for every new clinic without requiring manual input from the requester or the platform administrator.

## Assumptions

- Existing authentication infrastructure, password hashing, session handling, and audit logging will be reused rather than replaced.
- The existing invite-based staff creation endpoint (`POST /api/v1/clinic/staff/invite`) will be removed or deprecated and replaced by the new manual creation endpoint. Any existing `INVITED`-status users created before this feature ships are unaffected; they retain their status and can still be managed through administrative means.
- The current clinic owner registration flow does not need email-based verification or invitation emails for this slice.
- The first clinic owner created during public registration is the only account activated by the admin approval action; additional clinic staff are created later by the owner.
- The staff-creation form may live in the existing clinic staff screen and does not require a separate wizard.
- Rejection, suspension, and resubmission flows: rejection is included (terminal `REJECTED` state) but resubmission after rejection requires a brand-new registration request and is not an explicit flow in this slice.
- The admin clinic list remains the primary review surface; a dedicated approval detail page is optional for later work, not required for this slice.
- The slug generation algorithm does not need to be user-facing or configurable in this slice; a deterministic server-side derivation from the clinic name at creation time is sufficient.
- Platform admins do not have a clinic slug as their email domain, so the login resolution logic does not create ambiguity for any existing admin accounts.
- Clinic owners always have an email address; the optional-email change only applies to staff-role accounts.
- Existing staff users who were created via the old invite flow and have email-based accounts are not migrated in this slice — they continue to log in via email until explicitly updated.
- The login identifier field change is a label and validation change on the frontend; no new page or wizard is required.
- The `@` separator between username prefix and clinic slug is the canonical format; there is no alternative separator or format variant.
