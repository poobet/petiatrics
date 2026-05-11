# Clinic Onboarding and Staff Creation Technical Specification

This document mirrors the formal feature specification in `specs/003-clinic-onboarding-staff/spec.md` and focuses on the UI requirements, data and API structures, and acceptance criteria for the next implementation slice.

## Scope

- Flow A: Guests submit a clinic registration request that creates a pending clinic and a pending clinic-owner account.
- Flow B: Platform admins review pending clinic requests and approve them, activating both the clinic and the initial owner.
- Flow C: Approved clinic owners manually create staff accounts with temporary passwords and without email invites.
- Routing: Strict role-based separation is enforced between the `(admin)` and `(clinic)` portals, and pending users remain blocked from access.

## UI Requirements

### Public Registration Page

- Location: `apps/web/app/(auth)/register/page.tsx`
- Required fields: clinic name, tax ID, address or contact details, owner name, owner email, password, and phone.
- Behavior:
	- inline validation for required fields and invalid formats
	- duplicate-value feedback for existing tax IDs and emails
	- disabled submit state while request is in progress
	- post-submit confirmation state explaining that admin approval is required before login

### Admin Clinic Approval Page

- Location: `apps/web/app/(admin)/admin/clinics/page.tsx`
- Required capabilities:
	- render pending clinics distinctly from active clinics
	- show clinic and owner summary data needed for quick approval
	- provide an explicit approve action per pending clinic
	- refresh status or update the row in place after approval
	- show success and failure feedback clearly

### Clinic Staff Creation Page

- Location: `apps/web/app/(clinic)/clinic/staff/page.tsx` or the existing client component
- Required fields: staff name, email, role, temporary password, and any mandatory contact fields
- Behavior:
	- clinic ID is never editable in the UI
	- form submission is blocked while in flight
	- role options are limited to clinic-scoped staff roles
	- success state confirms the created account and resulting role/status
	- validation errors surface inline

### Middleware and Portal Routing

- Location: `apps/web/middleware.ts`
- Required behavior:
	- unauthenticated requests to `/admin/*` and `/clinic/*` redirect to login
	- `SUPER_ADMIN` users may enter `/admin/*` only
	- clinic roles (`CLINIC_OWNER`, `VET`, `ASSISTANT`, `CASHIER`, `STAFF`) may enter `/clinic/*` only
	- clinic staff users attempting `/admin/*` are redirected back to the clinic portal
	- pending users do not get an authenticated portal session

## Data and API Structures

### Data Model Changes

- `Clinic.status` needs a `PENDING` state so requests can exist before approval.
- `User.status` needs a `PENDING` state so clinic owners created from public registration cannot log in until approval.
- Approval transitions both clinic and owner from `PENDING` to `ACTIVE`.
- Manual staff creation creates clinic staff directly as `ACTIVE`.

### Public Registration Endpoint

- Endpoint: `POST /api/v1/auth/register-request`
- Contract:

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

- Success response:

```json
{
	"clinicId": "string",
	"ownerUserId": "string",
	"clinicStatus": "PENDING",
	"ownerStatus": "PENDING",
	"message": "Your clinic registration request has been submitted for review."
}
```

- Validation:
	- reject duplicates on tax ID and owner email
	- do not create a login session

### Admin Approval Endpoint

- Endpoint: `PATCH /api/v1/admin/clinics/:id/approve`
- Success response:

```json
{
	"clinicId": "string",
	"clinicStatus": "ACTIVE",
	"ownerUserId": "string",
	"ownerStatus": "ACTIVE",
	"approvedAt": "ISO-8601 datetime"
}
```

- Constraints:
	- super-admin only
	- reject repeated approval attempts for non-pending clinics

### Clinic Staff Creation Endpoint

- Endpoint: `POST /api/v1/clinic/staff`
- Contract:

```json
{
	"name": "string",
	"email": "string",
	"role": "VET | ASSISTANT | CASHIER | STAFF",
	"temporaryPassword": "string",
	"phone": "string",
	"clinicId": "string"
}
```

- Success response:

```json
{
	"id": "string",
	"name": "string",
	"email": "string",
	"role": "VET | ASSISTANT | CASHIER | STAFF",
	"status": "ACTIVE",
	"clinicId": "string",
	"createdAt": "ISO-8601 datetime"
}
```

- Security rule:
	- ignore any `clinicId` in the request body and derive clinic membership from authenticated tenant context or session only

### Route Protection Matrix

| Session state | Role | Allowed portal | Blocked portal behavior |
| --- | --- | --- | --- |
| Unauthenticated | N/A | None | Redirect to login |
| Authenticated | SUPER_ADMIN | `/admin/*` | Redirect from `/clinic/*` to admin landing page |
| Authenticated | CLINIC_OWNER | `/clinic/*` | Redirect from `/admin/*` to clinic landing page |
| Authenticated | VET / ASSISTANT / CASHIER / STAFF | `/clinic/*` | Redirect from `/admin/*` to clinic landing page |
| Authenticated but pending | Any | None | Deny login or clear session and redirect to login |

## Acceptance Criteria

1. A guest can submit a complete clinic registration request and receives a pending-review confirmation without being logged in.
2. A submitted registration request creates a pending clinic and a pending clinic-owner user.
3. A pending clinic owner cannot log in until an admin approves the clinic.
4. A super admin can approve a pending clinic from the admin clinic list, and approval activates both the clinic and the owner.
5. A clinic owner can create an active staff account manually from the clinic portal using a temporary password.
6. The backend ignores any client-supplied `clinicId` when creating staff and derives the clinic from authenticated context.
7. Clinic staff roles cannot access `(admin)` routes.
8. Unauthenticated users cannot access protected admin or clinic routes.

## Implementation Sequence

1. Extend clinic and user lifecycle states to represent pending registration.
2. Add the public registration request endpoint and validation rules.
3. Add the admin approval action and expose pending clinics in the admin list.
4. Replace invite-based clinic staff creation with manual-password staff creation.
5. Update login and middleware behavior to block pending users and enforce portal separation.
6. Add or update verification coverage for tenant derivation, pending-login blocking, and admin-route denial for clinic staff.