# API Contracts: Clinic Onboarding, Staff Creation, and Dual Authentication

All endpoints follow the existing `{ data, meta, error }` envelope format enforced by `EnvelopeInterceptor`. The `data` field contains the payload described below. Error responses use the `{ error: { code, message, details? } }` shape.

Base path: `/api/v1`

---

## Public Endpoints (no session required)

### POST /auth/register-request

Submit a new clinic registration request.

**Rate limit**: 5 requests per 15 minutes per IP address (stacks with the global 100 req/min limit).

**Request body**:
```json
{
  "clinicName":  "string (required, 2–100 chars)",
  "taxId":       "string (required, unique)",
  "address": {
    "line1":     "string (required)",
    "line2":     "string (optional)",
    "district":  "string (required)",
    "province":  "string (required)",
    "postalCode": "string (required)"
  },
  "ownerName":   "string (required)",
  "ownerEmail":  "string (required, valid email format)",
  "password":    "string (required, min 8 chars, 1 uppercase, 1 digit)",
  "phone":       "string (optional)"
}
```

**Response 201**:
```json
{
  "clinicId":    "uuid",
  "ownerUserId": "uuid",
  "clinicStatus": "PENDING",
  "ownerStatus":  "PENDING",
  "message":     "Your clinic registration request has been submitted for review."
}
```

**Error responses**:

| Status | Code                  | Trigger                                   |
|--------|-----------------------|-------------------------------------------|
| 400    | `VALIDATION_ERROR`    | Missing or invalid fields                 |
| 409    | `CONFLICT`            | Duplicate taxId or ownerEmail             |
| 429    | `THROTTLE_ERROR`      | Per-IP rate limit exceeded                |

**Side effects**:
- Creates one `Clinic` row with `status = PENDING`, auto-generated `slug`.
- Creates one `User` row with `role = CLINIC_OWNER`, `status = PENDING`, email, password hash.
- No session cookie is issued.
- Audit event emitted: `entity=clinics, operation=create`.

---

### POST /auth/login (updated)

Authenticate a user by email or staff username.

**Request body**:
```json
{
  "identifier": "string (required) — email OR username@clinic-slug",
  "password":   "string (required)"
}
```

The `identifier` field replaces the previous `email` field. Resolution logic:
1. Trim and lowercase the input.
2. If the input contains `@`, extract the suffix after the last `@`.
3. Query the `Clinic` table for `slug = suffix`.
4. If found → look up user by `username = identifier` scoped to that clinic's ID (username path).
5. If not found → look up user by `email = identifier` (email path).
6. If the input contains no `@` → look up by `email`.
7. If no user found in either path → return 401 with a generic message.

**Response 200**: `AuthProfile` + session cookie (unchanged from spec 002).

```json
{
  "id":                  "uuid",
  "email":               "string | null",
  "username":            "string | null",
  "role":                "SUPER_ADMIN | CLINIC_OWNER | VET | ASSISTANT | CASHIER | STAFF",
  "clinicName":          "string | null",
  "branches":            [{"id": "uuid", "name": "string"}],
  "preferredLocale":     "TH | EN",
  "mustChangePassword":  false
}
```

**Error responses**:

| Status | Code                  | Trigger                                              |
|--------|-----------------------|------------------------------------------------------|
| 400    | `VALIDATION_ERROR`    | Missing or empty fields                              |
| 401    | `UNAUTHORIZED`        | Invalid identifier or password; account blocked      |

**Blocked account behaviour**: Accounts with `status = PENDING | INACTIVE | LOCKED` receive a `401`. The message distinguishes lockout from inactive but never reveals whether the identifier was found.

---

## Authenticated Endpoints — Admin (SUPER_ADMIN role required)

### GET /admin/clinics (updated)

List all clinics including PENDING and REJECTED.

**Response 200** (array of):
```json
{
  "id":     "uuid",
  "name":   "string",
  "slug":   "string",
  "taxId":  "string",
  "status": "PENDING | ACTIVE | SUSPENDED | ARCHIVED | REJECTED",
  "owner": {
    "id":     "uuid",
    "name":   "string",
    "email":  "string",
    "status": "PENDING | ACTIVE | INACTIVE | LOCKED | INVITED"
  },
  "createdAt": "ISO-8601 datetime"
}
```

---

### PATCH /admin/clinics/:id/approve

Approve a pending clinic registration request.

**Request body** (optional):
```json
{ "note": "string (optional, internal audit context)" }
```

**Response 200**:
```json
{
  "clinicId":    "uuid",
  "clinicStatus": "ACTIVE",
  "ownerUserId": "uuid",
  "ownerStatus":  "ACTIVE",
  "approvedAt":  "ISO-8601 datetime"
}
```

**Error responses**:

| Status | Code        | Trigger                              |
|--------|-------------|--------------------------------------|
| 403    | `FORBIDDEN` | Caller is not SUPER_ADMIN            |
| 404    | `NOT_FOUND` | Clinic does not exist                |
| 409    | `CONFLICT`  | Clinic is not in PENDING state       |

**Side effects**:
- Updates `Clinic.status = ACTIVE` and owner `User.status = ACTIVE` in a single Prisma transaction.
- Audit event: `entity=clinics, operation=status_change`.

---

### PATCH /admin/clinics/:id/reject

Reject a pending clinic registration request (terminal action).

**Request body** (optional):
```json
{ "reason": "string (optional, internal audit context)" }
```

**Response 200**:
```json
{
  "clinicId":    "uuid",
  "clinicStatus": "REJECTED",
  "ownerUserId": "uuid",
  "ownerStatus":  "INACTIVE",
  "rejectedAt":  "ISO-8601 datetime"
}
```

**Error responses**:

| Status | Code        | Trigger                              |
|--------|-------------|--------------------------------------|
| 403    | `FORBIDDEN` | Caller is not SUPER_ADMIN            |
| 404    | `NOT_FOUND` | Clinic does not exist                |
| 409    | `CONFLICT`  | Clinic is not in PENDING state       |

**Side effects**:
- Updates `Clinic.status = REJECTED` and owner `User.status = INACTIVE` in a single Prisma transaction.
- Audit event: `entity=clinics, operation=status_change`.

---

## Authenticated Endpoints — Clinic Owner (CLINIC_OWNER role required)

### POST /clinic/staff (replaces /clinic/staff/invite)

Create a new clinic staff member.

**Request body**:
```json
{
  "name":              "string (required, 1–100 chars)",
  "usernamePrefix":    "string (required, 2–30 chars, [a-z0-9_-] only)",
  "role":              "VET | ASSISTANT | CASHIER | STAFF",
  "temporaryPassword": "string (required, must pass password policy)",
  "phone":             "string (optional)",
  "branchIds":         ["uuid", "..."] 
}
```

`clinicId` is ignored if present in the body. All `branchIds` must belong to the authenticated owner's clinic.

The full username stored on the user record is computed as: `{usernamePrefix}@{clinic.slug}`.

**Response 201**:
```json
{
  "id":                 "uuid",
  "username":           "string (e.g. somchai@happy-paws)",
  "name":               "string",
  "role":               "VET | ASSISTANT | CASHIER | STAFF",
  "status":             "ACTIVE",
  "clinicId":           "uuid",
  "branches":           [{"id": "uuid", "name": "string"}],
  "mustChangePassword": true,
  "createdAt":          "ISO-8601 datetime"
}
```

**Error responses**:

| Status | Code               | Trigger                                      |
|--------|--------------------|----------------------------------------------|
| 400    | `VALIDATION_ERROR` | Invalid prefix format or password policy fail |
| 403    | `FORBIDDEN`        | Caller is not CLINIC_OWNER                   |
| 409    | `CONFLICT`         | Username already exists                      |

**Side effects**:
- Creates one `User` row with `status = ACTIVE`, `mustChangePassword = true`, no email.
- Creates one or more `UserBranch` join rows.
- Audit event: `entity=users, operation=create`.

---

### GET /clinic/staff (updated)

List all staff in the authenticated owner's clinic.

**Response 200** (array of):
```json
{
  "id":       "uuid",
  "username": "string | null",
  "name":     "string",
  "role":     "string",
  "status":   "string"
}
```

`username` may be null for staff created before this feature (backwards compatibility).

---

## Authenticated Endpoints — Any Clinic Role

### POST /auth/change-password

Clear the `mustChangePassword` flag after completing a forced password change.

**Request body**:
```json
{
  "newPassword":     "string (required, must pass password policy)",
  "confirmPassword": "string (required, must match newPassword)"
}
```

**Response 200**: Updated `AuthProfile` with `mustChangePassword: false`.

**Error responses**:

| Status | Code               | Trigger                         |
|--------|--------------------|---------------------------------|
| 400    | `VALIDATION_ERROR` | Password policy failure or mismatch |
| 401    | `UNAUTHORIZED`     | No valid session                |

**Side effects**:
- Updates `User.passwordHash` and sets `User.mustChangePassword = false`.
- Invalidates all existing sessions for this user.
- Audit event: `entity=users, operation=update`.

---

## Route Protection Summary

| Route                              | Auth required | Role required    | Notes                                    |
|------------------------------------|---------------|------------------|------------------------------------------|
| `POST /auth/register-request`      | No            | None             | Public + per-IP throttle                 |
| `POST /auth/login`                 | No            | None             | Public                                   |
| `POST /auth/logout`                | Yes           | Any              |                                          |
| `GET /auth/me`                     | Yes           | Any              |                                          |
| `POST /auth/change-password`       | Yes           | Any clinic role  | Only valid when `mustChangePassword=true` |
| `GET /admin/clinics`               | Yes           | SUPER_ADMIN      |                                          |
| `PATCH /admin/clinics/:id/approve` | Yes           | SUPER_ADMIN      |                                          |
| `PATCH /admin/clinics/:id/reject`  | Yes           | SUPER_ADMIN      |                                          |
| `POST /clinic/staff`               | Yes           | CLINIC_OWNER     | Replaces `/clinic/staff/invite`          |
| `GET /clinic/staff`                | Yes           | CLINIC_OWNER     |                                          |
