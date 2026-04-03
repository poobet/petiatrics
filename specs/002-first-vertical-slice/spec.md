# Feature Specification: First Vertical Slice — Auth, Session Management, Role-Based Routing & Branch Context

**Feature Branch**: `002-first-vertical-slice`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "First Vertical Slice: Auth, Session Management, Role-Based Routing, Branch Context"

## Overview

This vertical slice establishes the foundational architecture of the Petiatrics platform. It covers four tightly integrated capabilities: secure user authentication, server-side session management, role-based route protection, and per-request branch context injection. Completing this slice establishes the boilerplate and architectural standard for all subsequent feature development.

The guiding principle is **zero-trust tenant isolation**: the backend never trusts tenant identifiers (`clinic_id`, `branch_id`) sent from the client payload. All tenant context is derived exclusively from the authenticated server-side session.

---

## Clarifications

### Session 2026-03-31

- Q: Which roles map to which portal route groups? → A: `SUPER_ADMIN` maps to `/admin`; all other roles (`CLINIC_OWNER`, `VET`, `ASSISTANT`, `CASHIER`, `STAFF`) map to `/clinic`; `/pet-owner` portal is out of scope for this slice.
- Q: Should this slice implement password policy and account lockout? → A: Bcrypt hashing + password policy enforcement (8+ chars, 1 uppercase, 1 number) on registration/seed; account lockout deferred to a later slice.
- Q: Should the system implement return-URL redirect after login? → A: No. Always redirect to the role-default dashboard after login; no return-URL support in this slice.
- Q: What should the role-appropriate dashboard render in this slice? → A: Minimal placeholder page showing user name, role, clinic name, active branch name, and a logout button — no domain content.
- Q: Which role names are the canonical enum values? → A: The blueprint enum: `SUPER_ADMIN`, `CLINIC_OWNER`, `VET`, `ASSISTANT`, `CASHIER`, `STAFF`. These are the DB-stored values; display labels for the UI are a separate concern.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Clinic Staff Logs In Securely (Priority: P1)

A clinic staff member (vet, receptionist, cashier, or owner) navigates to the Petiatrics login page, enters their registered email and password, and is signed in. The system creates a secure session and redirects the user to the dashboard appropriate for their role. A session indicator persists as long as they remain active.

**Why this priority**: Every other story in this slice depends on a user being authenticated. Without a working login flow there is no session, no routing, and no branch context.

**Independent Test**: Can be fully tested by submitting valid credentials on the `/login` page and verifying that the browser receives a secure cookie and the user lands on the correct role-based dashboard.

**Acceptance Scenarios**:

1. **Given** a registered clinic user with valid credentials, **When** they submit the login form, **Then** a secure session is created server-side, an HttpOnly session cookie is set on the browser, and the user is redirected to their role-appropriate dashboard.
2. **Given** a user who enters an incorrect password, **When** they submit the login form, **Then** the page displays a clear, non-revealing error message (e.g., "Invalid email or password") and no session cookie is set.
3. **Given** a user whose account has been deactivated, **When** they attempt to log in, **Then** access is denied with a message indicating the account is inactive.
4. **Given** a successful login, **When** the session is inspected server-side, **Then** it contains the user's ID, clinic ID, role, and the list of branch IDs they are authorized to access — none of which are derived from the client request body.

---

### User Story 2 — Protected Routes Redirect Unauthenticated Visitors (Priority: P1)

A visitor (or a user whose session has expired) attempts to navigate directly to a protected page such as the clinic dashboard, inventory screen, or admin panel. The system prevents access and immediately redirects them to the login page.

**Why this priority**: Route protection is the enforcement layer for all authenticated features. Its absence would expose the entire application to unauthorized access.

**Independent Test**: Can be fully tested by clearing browser cookies and navigating to `/clinic/dashboard`, verifying an immediate redirect to `/login` without any protected content being rendered.

**Acceptance Scenarios**:

1. **Given** a user with no session cookie, **When** they navigate to any protected route (e.g., `/clinic/dashboard`, `/admin`, `/pet-owner/profile`), **Then** they are immediately redirected to `/login` before any protected page content is rendered.
2. **Given** a user with an expired session cookie, **When** they navigate to a protected route, **Then** they are redirected to `/login`.
3. **Given** an authenticated user with the `VET` role, **When** they attempt to navigate to the admin portal, **Then** they are redirected to their own role-appropriate dashboard.
4. **Given** an authenticated user, **When** they navigate to a protected route that matches their role, **Then** the page renders normally without any redirect.

---

### User Story 3 — Branch Selector Adapts to User's Access Profile (Priority: P2)

After logging in, a multi-branch clinic user sees a branch selector in the top navigation that lets them switch between the branches they are authorized to access. A single-branch user sees no selector — they are automatically placed in their only branch. All subsequent data requests from either user type automatically carry the correct branch context without any manual action.

**Why this priority**: Branch context drives all transactional data (inventory, billing, appointments). The selector must correctly default and auto-inject context before any domain features are built on top.

**Independent Test**: Can be fully tested with two seed accounts — one with access to a single branch and one with access to multiple branches — verifying selector visibility and that outbound API calls include the correct `x-active-branch` value.

**Acceptance Scenarios**:

1. **Given** a user authorized for exactly one branch, **When** they reach their dashboard, **Then** the branch switcher widget is not rendered and the active branch is automatically set to that single branch.
2. **Given** a user authorized for two or more branches, **When** they reach their dashboard, **Then** a branch switcher dropdown is displayed showing all authorized branches, with the first branch selected by default.
3. **Given** a user authorized for multiple branches who selects a different branch from the dropdown, **When** the selection is made, **Then** the active branch in the application state updates immediately and all subsequent API calls carry the updated branch identifier in the `x-active-branch` request header.
4. **Given** any authenticated user making an API request, **When** the request is dispatched, **Then** it automatically includes the current active branch identifier without requiring the calling developer to specify it manually.
5. **Given** a user attempts to pass an unauthorized branch identifier in an API request, **When** the backend validates the request, **Then** access is denied with a `403 Forbidden` response.

---

### User Story 4 — User Logs Out and Session Is Invalidated (Priority: P2)

A clinic staff member chooses to log out of the platform. The system destroys their server-side session and clears all client-side state, ensuring no further authenticated requests can be made using the now-invalidated session identifier.

**Why this priority**: Logout is the essential counterpart to login and is required for security compliance in a multi-user clinical environment.

**Independent Test**: Can be fully tested by logging in, logging out, and then attempting to navigate to a protected route — verifying redirect to `/login` and confirming the session no longer exists server-side.

**Acceptance Scenarios**:

1. **Given** an authenticated user who initiates logout, **When** the logout action completes, **Then** the server-side session is destroyed, the session cookie is cleared from the browser, and the user is redirected to `/login`.
2. **Given** a session that has been logged out, **When** the old session cookie value is replayed in a subsequent request, **Then** the server returns `401 Unauthorized` and does not serve authenticated content.
3. **Given** a user who logs out, **When** they inspect application state, **Then** all in-memory user profile, branch list, and active branch data has been cleared.

---

### Edge Cases

- What happens when a user's session expires mid-session while they are actively browsing? The next protected API call returns `401`, and the UI redirects them to `/login` without data loss warnings.
- What happens when a clinic has no branches configured? The login should succeed but the user should see a meaningful empty state rather than an unhandled error.
- What happens if the session store becomes unavailable? All authenticated requests should fail gracefully with a `503 Service Unavailable` rather than exposing unprotected data.
- What happens if a user belonging to a suspended clinic attempts to log in? Access is denied with a clear message. Existing sessions for that clinic are invalidated.
- What happens if `clinic_id` is included in the login request body or a subsequent POST body? The backend silently ignores the field and resolves tenant context from the session only.
- What happens if both `x-active-branch` header and a `branch_id` body field are present in a request? The header is the authoritative source; the body field is ignored.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication

- **FR-001**: The system MUST authenticate users via email address and password.
- **FR-001a**: Passwords MUST be hashed using bcrypt before storage. The system MUST enforce a password policy (minimum 8 characters, at least 1 uppercase letter, at least 1 number) when passwords are set during seeding or account creation.
- **FR-002**: The system MUST reject login attempts where the email does not exist, the password is incorrect, or the account is inactive, responding with a non-revealing generic error message.
- **FR-003**: Upon successful authentication, the system MUST create a server-side session containing the user's ID, clinic ID, role, and authorized branch IDs.
- **FR-004**: The session identifier MUST be delivered to the client as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- **FR-005**: The login response body MUST return a non-sensitive user profile payload (user ID, email, role, and array of authorized branch objects with ID and name) sufficient for the frontend to render the UI without additional requests.
- **FR-006**: Sessions MUST have a server-enforced time-to-live (TTL) of 24 hours from creation.

#### Session Management

- **FR-007**: All protected API endpoints MUST validate an incoming session cookie on every request. Absent or expired session cookies MUST result in a `401 Unauthorized` response.
- **FR-008**: The logout endpoint MUST destroy the server-side session and instruct the client to clear the session cookie.
- **FR-009**: The `clinic_id` resolved during a request MUST be derived exclusively from the server-side session. Any `clinic_id` value present in the request body or query parameters MUST be ignored.

#### Branch Context

- **FR-010**: The system MUST accept an `x-active-branch` request header on all authenticated API calls as the active branch indicator.
- **FR-011**: The backend MUST validate that the branch ID in `x-active-branch` is contained within the user's list of authorized branch IDs stored in the session.
- **FR-012**: If `x-active-branch` references a branch the user is not authorized for, the system MUST return `403 Forbidden`.
- **FR-013**: For endpoints that require branch context, an absent `x-active-branch` header MUST result in a `403 Forbidden` response.
- **FR-014**: When the branch is validated, the request context MUST be enriched with both `clinicId` and `activeBranchId` for use by downstream service logic.

#### Route Protection

- **FR-015**: All routes under `/admin`, `/clinic`, and `/pet-owner` path groups MUST be protected and require a valid session cookie. Requests without a valid cookie MUST be redirected to `/login` before any page content is rendered. After successful login, the user is always redirected to their role-default dashboard (no return-URL preservation).
- **FR-016**: Users MUST only be able to access the route group that corresponds to their role. The mapping is: `SUPER_ADMIN` → `/admin`; all other roles (`CLINIC_OWNER`, `VET`, `ASSISTANT`, `CASHIER`, `STAFF`) → `/clinic`. The `/pet-owner` portal is out of scope for this slice. Accessing a mismatched portal MUST redirect the user to their correct dashboard.
- **FR-017**: Route protection MUST be enforced at the edge (middleware layer) before any server-side rendering or data fetching occurs.

#### UI — Login Page

- **FR-018**: The login page MUST provide an email input field, a password input field, and a submit button.
- **FR-019**: The login form MUST display inline validation errors for empty fields before submission.
- **FR-020**: The login page MUST display a loading state (disabled button and/or spinner) while the authentication request is in-flight.
- **FR-021**: On authentication failure, the form MUST display an error message without clearing the email field.

#### UI — Top Navigation & Branch Selector

- **FR-022**: The global top navigation MUST display the authenticated user's name and role.
- **FR-023**: If the user is authorized for exactly one branch, no branch selector MUST be rendered in the navigation.
- **FR-024**: If the user is authorized for two or more branches, a branch selector dropdown MUST be rendered in the navigation, defaulting to the first branch in the authorized list (or a previously saved preference).
- **FR-025**: Selecting a different branch from the dropdown MUST immediately update the active branch in global application state.
- **FR-026**: The navigation MUST provide a logout action that initiates the logout flow.

#### API Client

- **FR-027**: All outbound API requests from the frontend MUST automatically include the session cookie (credentials: include).
- **FR-028**: All outbound API requests from the frontend MUST automatically include the `x-active-branch` header populated from global application state, whenever an active branch is set.
- **FR-029**: On receiving a `401` response from any API call, the frontend MUST clear application state and redirect the user to `/login`.

#### UI — Placeholder Dashboard

- **FR-030**: Each portal route group (`/admin`, `/clinic`) MUST have a placeholder dashboard page that displays the authenticated user's name, role, clinic name, and active branch name. No domain-specific content (patients, appointments, inventory) is rendered in this slice. The page MUST include a logout button and, for multi-branch users, the branch selector in the top navigation.

---

### Data & API Structures

#### `POST /api/auth/login`

**Request Body**:
```
{
  email:    string  // required, user email address
  password: string  // required, plaintext password (sent over HTTPS only)
}
```

**Success Response `200 OK`**:
```
{
  id:       string         // user UUID
  email:    string         // user's email address
  role:     Role           // enum: SUPER_ADMIN | CLINIC_OWNER | VET | ASSISTANT | CASHIER | STAFF
  clinicName: string      // human-readable clinic name (for dashboard display)
  branches: Array<{
    id:   string           // branch UUID
    name: string           // human-readable branch name
  }>
}
```
Sets `HttpOnly; Secure; SameSite=Strict` cookie: `sessionId=<opaque_token>`

**Error Responses**:
- `401 Unauthorized` — invalid credentials or inactive account
- `400 Bad Request` — missing or malformed fields

---

#### `POST /api/auth/logout`

No request body required. Requires valid session cookie.

**Success Response `204 No Content`** — session destroyed, `Set-Cookie` header clears the session cookie.

---

#### `GET /api/auth/me`

Requires valid session cookie. Returns the current user's profile for client-side session restoration on page reload.

**Success Response `200 OK`**: Same shape as the login success response.

---

#### `GET /api/inventory/test` *(Verification Endpoint)*

Requires valid session cookie and `x-active-branch` header.

**Success Response `200 OK`**:
```
{
  message:        string  // "Branch context verified"
  clinicId:       string  // resolved from session
  activeBranchId: string  // resolved from x-active-branch header after validation
}
```
- `401` if session is absent or expired
- `403` if `x-active-branch` is missing or unauthorized

---

#### Session Payload (Server-Side Store)

Keyed as `session:{sessionId}`, stored with a 24-hour TTL:
```
{
  userId:            string    // user UUID
  clinicId:          string    // tenant UUID — never sourced from client
  role:              Role      // user's role enum value
  authorizedBranches: string[] // array of authorized branch UUIDs
}
```

---

### Key Entities

- **Clinic**: The top-level tenant. Each clinic has a unique identity, a status (active or suspended), and owns all branches and users within it. A user belongs to exactly one clinic.
- **Branch**: A physical location or operational unit within a clinic. A user may be authorized to access one or more branches within their clinic. Branch access determines the scope of all transactional data (inventory, appointments, billing).
- **User**: A person who can authenticate to the platform. Each user has a single role that determines their access level and portal. A user has access to at least one branch within their clinic.
- **UserBranch**: The mapping between a user and a branch. This determines which branches appear in the user's branch selector and which branch IDs are permitted in the `x-active-branch` header.
- **Session**: A server-side record that links a cryptographically opaque session token (stored as a browser cookie) to a user's identity, tenant context, role, and authorized branch list. Sessions expire after 24 hours of inactivity.
- **Role**: An enumerated privilege level assigned to each user. Canonical DB values: `SUPER_ADMIN`, `CLINIC_OWNER`, `VET`, `ASSISTANT`, `CASHIER`, `STAFF`. These are the authoritative enum identifiers stored in the database; UI display labels (e.g., "Clinic Owner", "Veterinarian") are a presentation concern. Role determines which portal route group the user may access.
- **ActiveBranch** (UI State): The branch currently selected in the frontend application state. All outbound API requests use this value to populate the `x-active-branch` header.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid credentials can complete the login flow and reach their role-specific dashboard in under 3 seconds under normal network conditions.
- **SC-002**: 100% of requests to protected routes without a valid session are redirected to `/login` — zero protected content is rendered without authentication.
- **SC-003**: 100% of authenticated API requests automatically carry the correct active branch identifier without requiring explicit per-request configuration by the calling developer.
- **SC-004**: Any attempt to send an unauthorized branch ID in a request is rejected with `403 Forbidden` in 100% of cases — zero unauthorized cross-branch data leakage.
- **SC-005**: Any attempt to supply a `clinic_id` in a request body is silently ignored in 100% of cases — tenant context is always derived from the server-side session.
- **SC-006**: A user with a single authorized branch never sees a branch selector in the navigation — the branch context is set automatically in 100% of such cases.
- **SC-007**: The login, session validation, and logout flows remain functional under a load of at least 100 concurrent user sessions.
- **SC-008**: After logout, replaying the session cookie value against a protected endpoint returns `401 Unauthorized` in 100% of attempts — no post-logout session reuse is possible.

---

## Assumptions

- All users of this vertical slice are internal clinic staff (not patients/pet owners); pet-owner portal authentication can be deferred to a later slice.
- Password reset / forgot-password flow is out of scope for this slice.
- User account registration (self-service sign-up) is out of scope; users are created via seeding or a future admin tool.
- OAuth2 / SSO integration is out of scope; email + password is the only authentication method for this slice.
- Account lockout after failed login attempts is deferred to a later slice; this slice does not track failed attempt counters or enforce temporary lockout.
- The platform is accessed exclusively via HTTPS in all environments; `Secure` cookie attribute is always valid.
- The session store (Redis) is treated as an internal infrastructure dependency and is assumed to be available. Resilience patterns (fallback, circuit breaker) are deferred to a later infrastructure slice.
- A user's role is a single, fixed value — there is no multi-role per user in this slice.
- Branch preference persistence across page reloads (e.g., saving the last selected branch in `localStorage`) is a desirable behavior but is considered a low-priority enhancement rather than a hard requirement in this slice.
- The `SUPER_ADMIN` role manages clinics at a platform level and has its own `/admin` portal; the scope of admin portal screens beyond routing is deferred to a future slice.
- Prisma migrations and database seeding for at least one clinic, two branches, and one user per role are required as part of the definition of done to enable acceptance testing.
