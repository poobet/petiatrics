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

As a clinic owner or admin, I need to manage Business Partners (Customers, Staff, Vets, Suppliers) in a unified interface so that I can assign Infor LN roles, record Thai tax compliance details, add type-specific extensions (e.g., Vet licenses), and optionally link a system User account.

**Why this priority**: Core master data. No billing, procurement, or medical records can exist without Business Partners.

**Independent Test**: Can be tested by creating various BP types (Customer without login, Vet with login and license) independently of the procurement/sales flows.

**Acceptance Scenarios**:

1. **Given** the Business Partner creation UI, **When** I create a standard Customer, **Then** a `BusinessPartner` record is created with Thai compliance fields available (`taxId`, `isHeadOffice`, address) and no linked `User` account required.
2. **Given** an existing BusinessPartner, **When** I assign the "Vet" type and provide a license number, **Then** a `BpVet` extension is created and linked.
3. **Given** a corporate Business Partner, **When** I set `isHeadOffice = false` and provide a `branchCode`, **Then** the system records the branch identity for use on tax invoices.
4. **Given** a Business Partner, **When** I select Infor LN roles (e.g., AR Sold-To and AP Buy-From), **Then** those roles are recorded in `BpRoleActive` and the BP can act in both AR and AP capacities.
5. **Given** a BusinessPartner intended to access the system, **When** I assign system access, **Then** a `User` identity is linked to the BP, enabling login capabilities.

---

### Edge Cases

- What happens when a user attempts to access the API with an expired or revoked Redis session? (System must return 401 and redirect to login).
- How does the system handle a BusinessPartner whose linked User identity is deactivated? (The BP remains intact for historical records, but login is prevented).
- What happens if a request is missing the `x-active-branch` header? (Backend should reject with 400/403 unless the endpoint is specifically for branch selection).
- What happens when a user's account is locked due to failed login attempts? (System must return 403 with a message indicating the lockout duration; the lock auto-expires after 15 minutes).

## Clarifications

### Session 2026-04-14

- Q: Which roles may create/edit vs. view Business Partners? → A: SUPER_ADMIN, CLINIC_OWNER & STAFF can create/edit; VET, CASHIER, and ASSISTANT have read-only access.
- Q: What session lifetime and idle timeout should be used? → A: 12-hour absolute TTL with 1-hour idle timeout.
- Q: What password policy and brute-force protection should be enforced? → A: Min 8 chars (upper+lower+digit+special), lock after 5 failed attempts for 15 min.
- Q: What deletion strategy should be used for Business Partners? → A: Strict soft delete only (`isActive` flag). BP data MUST ALWAYS be retained to maintain referential integrity. No user, regardless of role, may perform a hard delete.
- Q: What is explicitly out of scope for this feature? → A: Procurement (PO/GR), Sales/Billing (AR), Payments, ItemMaster, Warehouse — all deferred to later features.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST use secure, stateful sessions backed by Redis via HttpOnly cookies (No JWTs).
- **FR-002**: Frontend UI MUST enforce users to select an "Active Branch" upon login if they have multiple branches.
- **FR-003**: Frontend API client MUST inject the `x-active-branch` header on all protected requests.
- **FR-004**: Backend MUST derive `clinicId` strictly from the Redis session, never from client payloads.
- **FR-005**: Backend MUST validate the `x-active-branch` header against the user's `authorizedBranches` array in Redis.
- **FR-006**: System MUST store all human/corporate actors in a single unified `BusinessPartner` core table, regardless of their operational context (AR customer, AP supplier, staff, vet).
- **FR-007**: System MUST strictly separate the `User` (login credentials) from `BusinessPartner` (entity data). A BP may exist without a `User`; a `User` MUST always be linked to a `BP`.
- **FR-008**: UI MUST expose Thai compliance fields (`taxId`, `isHeadOffice`, `branchCode`, structured address, `defaultVatCodeId`, `defaultWhtCodeId`, `creditTermDays`) for ALL Business Partner types. Type-specific extension fields (e.g., Vet license number) MUST be displayed conditionally based on the selected `type`.
- **FR-013**: System MUST allow assignment of one or more of the 8 Infor LN roles (`AR_SOLD_TO`, `AR_SHIP_TO`, `AR_INVOICE_TO`, `AR_PAY_BY`, `AP_BUY_FROM`, `AP_SHIP_FROM`, `AP_INVOICE_FROM`, `AP_PAY_TO`) to a Business Partner via the `BpRoleActive` junction table. A single BP MAY hold multiple roles simultaneously.
- **FR-014**: System MUST support a `parentBpId` relationship on `BusinessPartner` to link branch entities to a Headquarter BP within the same clinic. This is used to model corporate group hierarchies for tax invoice purposes.
- **FR-009**: Only users with role `SUPER_ADMIN`, `CLINIC_OWNER`, or `STAFF` MUST be permitted to create or edit Business Partners. Roles `VET` and `CASHIER` MUST have read-only access to BP data.
- **FR-010**: Redis sessions MUST have a 12-hour absolute TTL and a 1-hour sliding idle timeout. Sessions exceeding either limit MUST be invalidated, returning HTTP 401.
- **FR-011**: Passwords MUST be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character. After 5 consecutive failed login attempts, the account MUST be locked for 15 minutes.
- **FR-012**: Business Partners MUST NOT be hard-deleted. Deactivation MUST use a **strict soft-delete** `isActive` flag. Deactivated BPs MUST remain queryable for historical document references but MUST be excluded from active selection lists. Data integrity must be strictly maintained.
- **FR-015**: The `ASSISTANT` role MUST have read-only access to Business Partner data, identical to the `CASHIER` role restriction defined in FR-009. `ASSISTANT` users MUST NOT be permitted to create, edit, or deactivate Business Partners.

### Business & Tax Logic

#### Universal Thai Compliance Core

All Business Partners — regardless of type — carry the following Thai Revenue Department (RD) compliance fields directly on the core `BusinessPartner` table. This allows the clinic to issue legally compliant full tax invoices to any corporate partner:

| Field | Description |
|---|---|
| `taxId` | 13-digit Thai Taxpayer Identification Number (TIN). |
| `isHeadOffice` | `true` if this BP record represents the head office; `false` for branch offices. |
| `branchCode` | 5-digit branch code assigned by the RD, required when `isHeadOffice = false`. |
| `addressLine1`, `subDistrict`, `district`, `province`, `zipcode` | Structured Thai address for tax document printing. |
| `creditTermDays` | Payment credit terms (days). Applies to both AR (collection from customers) and AP (payment to suppliers), so it is a core BP field, not extension-specific. |

#### Infor LN 8-Role Framework

A Business Partner may simultaneously serve multiple operational contexts. Roles are NOT exclusive types — they are assignments tracked in the `BpRoleActive` junction table:

| Side | Role | Meaning |
|---|---|---|
| AR | `AR_SOLD_TO` | Customer who places the order. |
| AR | `AR_SHIP_TO` | Physical delivery address for shipments. |
| AR | `AR_INVOICE_TO` | Legal entity that receives the tax invoice. |
| AR | `AR_PAY_BY` | Legal entity responsible for payment. |
| AP | `AP_BUY_FROM` | Vendor the clinic orders from. |
| AP | `AP_SHIP_FROM` | Vendor's shipping origin. |
| AP | `AP_INVOICE_FROM` | Vendor who issues the tax invoice to the clinic. |
| AP | `AP_PAY_TO` | Bank account or entity that receives payment from the clinic. |

A single `BusinessPartner` may hold any combination of these 8 roles. For example, a vet who also sells medical supplies would hold `AR_INVOICE_TO`, `AP_BUY_FROM`, and `AP_INVOICE_FROM` simultaneously.

#### BP Hierarchy (`parentBpId`)

A `BusinessPartner` may reference another BP within the same clinic as its `parentBpId`. This models corporate group structures: one BP record represents the Headquarter (`isHeadOffice = true`) and subordinate branch BPs (`isHeadOffice = false`, with `branchCode`) link to it. This hierarchy is used for grouping on tax documents and reporting; it does not affect access control.

#### Tax Master & VAT Inference Logic

> **Breaking Change**: The `isVatRegistered` boolean field on `BusinessPartner` is **DEPRECATED and REMOVED**.

The system uses a global, system-seeded `TaxCode` reference table. Each `TaxCode` record has an `isVatType` flag distinguishing VAT codes (e.g., `VAT7`, `VAT0`) from WHT codes (e.g., `WHT3`, `WHT1`).

**Inference Rule**: A Business Partner is considered VAT-registered if and only if their `defaultVatCodeId` resolves to a `TaxCode` record where `isVatType = true`. This inference is computed at read time and MUST NOT be stored as a persisted field.

A BP may have two default tax code references:
- `defaultVatCodeId` → the VAT code applied when this BP appears on a sales document.
- `defaultWhtCodeId` → the WHT code applied when this BP appears as a payee on an AP document.

These defaults serve as starting values on document creation; they do not override item-level tax rules.

#### Item-Level VAT Applicability (Deferred)

Runtime VAT calculation on invoices (e.g., separating VAT-exempt medical services from VAT7 pet food) is driven entirely by the `ItemMaster`, NOT by the customer's `defaultVatCodeId`. The BP's default VAT code is a profile annotation only — it does not bypass per-item tax categorisation.

**This runtime billing calculation is deferred to a future phase.** No invoice-line tax logic is in scope here.

#### Soft-Delete & Data Retention

See **FR-012**. Hard deletes are forbidden at the application layer for all roles. Deactivated records remain fully queryable for historical financial document references (AR invoices, AP bills) but are excluded from all active selection lists.

### Key Entities *(include if feature involves data)*

- **Clinic**: Top-level tenant organisation. All data is scoped to a Clinic.
- **Branch**: Physical location within a Clinic. Users are assigned to one or more branches; the active branch drives data scoping.
- **User**: Login identity (`email`/`username`, `passwordHash`, `role`). Always linked 1-to-1 with a `BusinessPartner`. A BP may exist without a User, but every User must have a BP.
- **BusinessPartner**: The universal core entity for every human or corporate actor in the system. Key fields:
  - `type` — Classifies the BP operationally (`CUSTOMER`, `STAFF`, `VET`, `SUPPLIER`, `OTHER`).
  - `taxId`, `isHeadOffice`, `branchCode` — Thai RD compliance identity.
  - `addressLine1`, `subDistrict`, `district`, `province`, `zipcode` — Structured Thai address for tax document printing.
  - `defaultVatCodeId`, `defaultWhtCodeId` — FK references to `TaxCode`; drive VAT inference and AP WHT defaults.
  - `creditTermDays` — Core payment terms field (applies to both AR and AP).
  - `parentBpId` — Optional self-referential FK for linking branch BPs to a Headquarter BP.
  - `isActive` — Soft-delete flag. `false` = deactivated; record is retained forever.
- **TaxCode**: Global, system-seeded reference table. Columns: `code` (e.g., `VAT7`), `description`, `rate`, `isVatType` (`true` for VAT codes, `false` for WHT codes). Not tenant-scoped; shared across all clinics.
- **BpRoleActive**: Junction table. One row per `(businessPartnerId, role)` pair. Tracks which of the 8 Infor LN roles a BP is active for. A BP may hold zero or many roles.
- **BpVet**: 1-to-1 extension table for `type = VET`. Contains `licenseNumber` (required for Vet BPs). The legacy `whtRate` field on this extension is superseded by `defaultWhtCodeId` on the core BP.
- **BpSupplier**: 1-to-1 extension table for `type = SUPPLIER`. Now contains only vendor-classification metadata (`vendorGroupId`). Standard financial fields (`taxId`, `creditTermDays`) have moved to the core `BusinessPartner` table and are no longer supplier-exclusive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of authenticated API requests are validated against Redis sessions (Zero-Trust).
- **SC-002**: Changes to user access or session revocation take effect across the system immediately (< 1 second).
- **SC-003**: All Business Partner creation flows complete successfully via API without data duplication.
- **SC-004**: Cross-branch data leakage is 0%; a user can never access data for a branch they are not authorized for, as proven by automated tenant isolation tests.

## Assumptions

- We assume Redis infrastructure is highly available to support session checks on every request.
- We assume standard customers do not require self-service portal access for v1 (hence no `User` record creation required for standard customers by default).
- Thai compliance fields (`taxId`, address) are optional for all BP types; the UI renders them universally but does not enforce them unless required by a specific workflow (e.g., tax invoice generation — deferred).
- The `TaxCode` reference table is seeded by system migration and is not user-editable in v1. UI dropdowns for `defaultVatCodeId` and `defaultWhtCodeId` read from this table via API.
- For v1, `parentBpId` hierarchy is recorded but no UI for hierarchical reporting or group rollup is in scope.

## Out of Scope

- **Procurement (AP)**: Purchase Orders, Goods Receipts, Vendor Bills — deferred to a later feature.
- **Sales & Billing (AR)**: Invoices, Document Partners, Invoice Line Tax — deferred to a later feature.
- **Runtime Invoice VAT Calculation**: Per-line VAT/WHT computation driven by `ItemMaster` tax categorisation — explicitly deferred. BP `defaultVatCodeId` is a profile annotation only in v1.
- **Payments & Allocations**: Payment processing and allocation across documents — deferred to a later feature.
- **ItemMaster & Warehouse**: Product catalog and inventory management — deferred to a later feature.
- **TaxCode Administration UI**: Creating or editing `TaxCode` records is a system-admin concern; no UI for this in v1.
- **BP Hierarchy Reporting**: Group-level rollup or consolidated reporting across a Headquarter and its branches — deferred.
- **Self-service customer portal**: Pet owners do not log in for v1.
