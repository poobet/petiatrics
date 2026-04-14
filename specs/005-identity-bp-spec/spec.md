# Feature Specification: Identity & Business Partner Architecture

**Feature Branch**: `005-identity-bp-spec`  
**Created**: April 14, 2026  
**Status**: Draft  
**Input**: User description: "Create a detailed technical specification at d:\Deaw\petiatrics\documents\4-identity-and-bp.md for all . Focus on UI requirements, Data/API structures, and Acceptance Criteria."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clinic Login & Branch Selection (Priority: P1)

As a clinic staff member (Vet, Cashier, or Admin), I need to log in securely and select my active branch so that my actions apply to the right clinic location and inventory.

**Why this priority**: Required for all subsequent interactions; establishes the Zero-Trust session and tenant context.

**Independent Test**: Can be fully tested by logging in via UI, observing the session creation, and verifying standard API requests include the `x-active-branch` header.

**Acceptance Scenarios**:

1. **Given** valid credentials, **When** I submit the login form, **Then** the system creates a Redis-backed session (HttpOnly cookie) and returns my authorized branches.
2. **Given** a successful login, **When** I select an active branch, **Then** the UI globally sets the `x-active-branch` header for all subsequent API requests.
3. **Given** an active session, **When** I select a branch I am not authorized for, **Then** the backend rejects the request (Tenant Isolation).

---

### User Story 2 - Business Partner Management (Priority: P1)

As a clinic owner or admin, I need to manage Business Partners (Customers, Staff, Vets, Suppliers) in a unified interface so that I can easily assign roles, add extensions (e.g., Vet licenses, Supplier tax IDs), and link system Users.

**Why this priority**: Core master data. No billing, procurement, or medical records can exist without Business Partners.

**Independent Test**: Can be tested by creating various BP types (Customer without login, Vet with login and license) independently of the procurement/sales flows.

**Acceptance Scenarios**:

1. **Given** the Business Partner creation UI, **When** I create a standard Customer, **Then** a `BusinessPartner` record is created without a linked `User` account.
2. **Given** an existing BusinessPartner, **When** I assign the "Vet" role and provide a license number, **Then** a `BpVet` extension is created and linked.
3. **Given** a BusinessPartner intended to access the system, **When** I assign system access, **Then** a `User` identity is linked to the BP, enabling login capabilities.

---

### Edge Cases

- What happens when a user attempts to access the API with an expired or revoked Redis session? (System must return 401 and redirect to login).
- How does the system handle a BusinessPartner whose linked User identity is deactivated? (The BP remains intact for historical records, but login is prevented).
- What happens if a request is missing the `x-active-branch` header? (Backend should reject with 400/403 unless the endpoint is specifically for branch selection).
- What happens when a user's account is locked due to failed login attempts? (System must return 403 with a message indicating the lockout duration; the lock auto-expires after 15 minutes).

## Clarifications

### Session 2026-04-14

- Q: Which roles may create/edit vs. view Business Partners? → A: SUPER_ADMIN, CLINIC_OWNER & STAFF can create/edit; VET and CASHIER have read-only access.
- Q: What session lifetime and idle timeout should be used? → A: 12-hour absolute TTL with 1-hour idle timeout.
- Q: What password policy and brute-force protection should be enforced? → A: Min 8 chars (upper+lower+digit+special), lock after 5 failed attempts for 15 min.
- Q: What deletion strategy should be used for Business Partners? → A: Soft delete only (isActive flag); BP data always retained for referential integrity.
- Q: What is explicitly out of scope for this feature? → A: Procurement (PO/GR), Sales/Billing (AR), Payments, ItemMaster, Warehouse — all deferred to later features.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST use secure, stateful sessions backed by Redis via HttpOnly cookies (No JWTs).
- **FR-002**: Frontend UI MUST enforce users to select an "Active Branch" upon login if they have multiple branches.
- **FR-003**: Frontend API client MUST inject the `x-active-branch` header on all protected requests.
- **FR-004**: Backend MUST derive `clinicId` strictly from the Redis session, never from client payloads.
- **FR-005**: Backend MUST validate the `x-active-branch` header against the user's `authorizedBranches` array in Redis.
- **FR-006**: System MUST store all human/corporate actors in a single unified `BusinessPartner` model.
- **FR-007**: System MUST strictly separate the `User` (login credentials) from `BusinessPartner` (entity data).
- **FR-008**: UI MUST provide distinct forms/flows depending on the BP role extension being added (`BpVet`, `BpSupplier`).
- **FR-009**: Only users with role `SUPER_ADMIN`, `CLINIC_OWNER`, or `STAFF` MUST be permitted to create or edit Business Partners. Roles `VET` and `CASHIER` MUST have read-only access to BP data.
- **FR-010**: Redis sessions MUST have a 12-hour absolute TTL and a 1-hour sliding idle timeout. Sessions exceeding either limit MUST be invalidated, returning HTTP 401.
- **FR-011**: Passwords MUST be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character. After 5 consecutive failed login attempts, the account MUST be locked for 15 minutes.
- **FR-012**: Business Partners MUST NOT be hard-deleted. Deactivation MUST use a soft-delete `isActive` flag. Deactivated BPs MUST remain queryable for historical document references but MUST be excluded from active selection lists.

### Key Entities *(include if feature involves data)*

- **Clinic**: Represents the top-level tenant organization.
- **Branch**: Represents physical locations within a Clinic.
- **User**: Stores login credentials (`loginEmail`, `passwordHash`, `role`), strictly linked to a `BusinessPartner`.
- **BusinessPartner**: Universal entity for all human/corporate actors (`type`, `name`, `clinicId`, `isActive`). Soft-delete only; never hard-deleted.
- **BpVet**: 1-to-1 extension for Vets, containing `licenseNumber` and `whtRate`.
- **BpSupplier**: 1-to-1 extension for Suppliers, containing `taxId` and `creditTermDays`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of authenticated API requests are validated against Redis sessions (Zero-Trust).
- **SC-002**: Changes to user access or session revocation take effect across the system immediately (< 1 second).
- **SC-003**: All Business Partner creation flows complete successfully via API without data duplication.
- **SC-004**: Cross-branch data leakage is 0%; a user can never access data for a branch they are not authorized for, as proven by automated tenant isolation tests.

## Assumptions

- We assume Redis infrastructure is highly available to support session checks on every request.
- We assume standard customers do not require self-service portal access for v1 (hence no `User` record creation required for standard customers by default).
- UI structures for `BusinessPartner` forms can dynamically render fields based on the selected BP Type (e.g., showing tax info only for Suppliers).

## Out of Scope

- **Procurement (AP)**: Purchase Orders, Goods Receipts, Vendor Bills — deferred to a later feature.
- **Sales & Billing (AR)**: Invoices, Document Partners, Invoice Line Tax — deferred to a later feature.
- **Payments & Allocations**: Payment processing and allocation across documents — deferred to a later feature.
- **ItemMaster & Warehouse**: Product catalog and inventory management — deferred to a later feature.
- **Self-service customer portal**: Pet owners do not log in for v1.
