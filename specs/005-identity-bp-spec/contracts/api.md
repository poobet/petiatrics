# API Contracts: Identity & Business Partner Architecture

All endpoints follow the existing `{ data, meta, error }` envelope returned by the API interceptors. The payloads below describe the contents of `data`.

Base path: `/api/v1`

---

## Auth and Session Implications

### POST /auth/login (existing endpoint, updated constraints)

Authenticate a user and create a Redis-backed session.

**Request body**:

```json
{
  "identifier": "string",
  "password": "string"
}
```

**Updated rules**:

- passwords must meet the server-side policy when set or changed
- accounts lock after 5 failed attempts for 15 minutes
- successful sessions expire after 12 hours absolute or 1 hour idle, whichever comes first

**Response 200**:

```json
{
  "id": "uuid",
  "email": "string | null",
  "username": "string | null",
  "role": "SUPER_ADMIN | CLINIC_OWNER | VET | ASSISTANT | CASHIER | STAFF",
  "clinicId": "uuid | null",
  "branches": [{ "id": "uuid", "name": "string" }],
  "authorizedBranches": ["uuid"],
  "preferredLocale": "TH | EN",
  "businessPartnerId": "uuid | null"
}
```

**Error responses**:

| Status | Code | Trigger |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | Missing credentials |
| 401 | `UNAUTHORIZED` | Invalid credentials or expired session on follow-up requests |
| 403 | `ACCOUNT_LOCKED` | Account locked after repeated failed attempts |

---

## Business Partner Endpoints

All BP endpoints require:

- authenticated session cookie
- valid `x-active-branch` header
- clinic context derived from session, never from request body

### GET /clinic/business-partners

List active Business Partners for the caller's clinic.

**Query parameters**:

| Name | Type | Notes |
|------|------|------|
| `type` | `CUSTOMER | STAFF | VET | SUPPLIER | OTHER` | optional filter |
| `search` | `string` | optional name search |
| `includeInactive` | `boolean` | optional, ignored unless caller has management access |

**Response 200**:

```json
[
  {
    "id": "uuid",
    "clinicId": "uuid",
    "type": "VET",
    "name": "Dr. Somchai",
    "isActive": true,
    "user": {
      "id": "uuid",
      "role": "VET",
      "email": "string | null",
      "username": "string | null"
    },
    "vet": {
      "licenseNumber": "VET-12345",
      "whtRate": 3.0
    },
    "supplier": null,
    "createdAt": "ISO-8601 datetime",
    "updatedAt": "ISO-8601 datetime"
  }
]
```

**Authorization**:

- `SUPER_ADMIN`, `CLINIC_OWNER`, `STAFF`, `VET`, `CASHIER`, and `ASSISTANT` may view
- inactive rows should only appear for management-capable callers when explicitly requested

---

### GET /clinic/business-partners/:id

Return a single Business Partner, including inactive records for authorized management users.

**Response 200**:

```json
{
  "id": "uuid",
  "clinicId": "uuid",
  "type": "SUPPLIER",
  "name": "Thai Vet Supply Co.",
  "isActive": false,
  "user": null,
  "vet": null,
  "supplier": {
    "taxId": "0105551234567",
    "creditTermDays": 30
  },
  "createdAt": "ISO-8601 datetime",
  "updatedAt": "ISO-8601 datetime"
}
```

**Error responses**:

| Status | Code | Trigger |
|--------|------|---------|
| 403 | `FORBIDDEN` | Caller lacks clinic access |
| 404 | `NOT_FOUND` | BP not found in caller clinic |

---

### POST /clinic/business-partners

Create a Business Partner.

**Authorization**:

- allowed: `SUPER_ADMIN`, `CLINIC_OWNER`, `STAFF`
- denied: `VET`, `CASHIER`, `ASSISTANT`

**Request body**:

```json
{
  "type": "VET",
  "name": "Dr. Somchai",
  "linkUserId": null,
  "vet": {
    "licenseNumber": "VET-12345",
    "whtRate": 3.0
  },
  "supplier": null
}
```

**Conditional validation**:

- `vet` object required when `type = VET`
- `supplier` object required when `type = SUPPLIER`
- `linkUserId` optional, but if supplied must belong to the same clinic and not already be linked to another BP

**Response 201**:

```json
{
  "id": "uuid",
  "clinicId": "uuid",
  "type": "VET",
  "name": "Dr. Somchai",
  "isActive": true,
  "user": null,
  "vet": {
    "licenseNumber": "VET-12345",
    "whtRate": 3.0
  },
  "supplier": null,
  "createdAt": "ISO-8601 datetime",
  "updatedAt": "ISO-8601 datetime"
}
```

**Error responses**:

| Status | Code | Trigger |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid type-specific payload |
| 403 | `FORBIDDEN` | Caller cannot create/edit BPs |
| 409 | `CONFLICT` | Vet license or user linkage already exists |

---

### PATCH /clinic/business-partners/:id

Update an active Business Partner.

**Authorization**:

- allowed: `SUPER_ADMIN`, `CLINIC_OWNER`, `STAFF`

**Request body**:

```json
{
  "name": "Dr. Somchai Boonmee",
  "vet": {
    "licenseNumber": "VET-12345",
    "whtRate": 3.0
  }
}
```

**Rules**:

- type cannot change once created in this slice
- inactive BP rows cannot be edited until reactivated by a future feature or admin workflow

**Response 200**:

Same shape as `GET /clinic/business-partners/:id`.

---

### PATCH /clinic/business-partners/:id/deactivate

Soft-delete a Business Partner by setting `isActive = false`.

**Authorization**:

- allowed: `SUPER_ADMIN`, `CLINIC_OWNER`
- optional future allowance for `STAFF` can be added later, but is not included in this plan by default

**Request body**:

```json
{}
```

**Response 200**:

```json
{
  "id": "uuid",
  "isActive": false,
  "updatedAt": "ISO-8601 datetime"
}
```

**Error responses**:

| Status | Code | Trigger |
|--------|------|---------|
| 403 | `FORBIDDEN` | Caller lacks deactivation rights |
| 404 | `NOT_FOUND` | BP not found in caller clinic |
| 409 | `CONFLICT` | BP already inactive |

---

## Behavioural Guarantees

### Tenant isolation

- `clinicId` is never accepted from BP payloads
- all reads and writes are filtered by the session-derived clinic context
- `x-active-branch` is still required and validated even though BP data is clinic-scoped

### Session and lockout handling

- missing or expired session returns `401`
- account lockout returns `403` with lockout context suitable for UI messaging
- branch header missing or invalid returns `400` or `403` according to the existing guard behaviour

### Audit expectations

- create, update, and deactivate operations should emit audit records via existing audit infrastructure