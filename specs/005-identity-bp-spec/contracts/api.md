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

## Reference Data Endpoints

### GET /reference/tax-codes

Return all active `TaxCode` records. This endpoint serves the VAT and WHT dropdown selectors in the BP form. No clinic scoping — `TaxCode` is a global system-seeded table.

**Authorization**: authenticated session required; all clinic roles may read.

**Response 200**:

```json
[
  {
    "id": "uuid",
    "code": "VAT7",
    "description": "Standard VAT 7%",
    "rate": 7.0,
    "isVatType": true,
    "isZeroRated": false,
    "type": "VAT"
  },
  {
    "id": "uuid",
    "code": "VAT0",
    "description": "Zero-rated VAT (exports)",
    "rate": 0.0,
    "isVatType": true,
    "isZeroRated": true,
    "type": "VAT"
  },
  {
    "id": "uuid",
    "code": "WHT3",
    "description": "Withholding Tax 3%",
    "rate": 3.0,
    "isVatType": false,
    "isZeroRated": false,
    "type": "WHT"
  }
]
```

**Notes**:

- Items with `isVatType = true` populate the **Default VAT Code** selector.
- Items with `isVatType = false` populate the **Default WHT Code** selector.
- Items with `isZeroRated = true` indicate zero-rated or exempt VAT categories.

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
| `type` | `CUSTOMER \| STAFF \| VET \| SUPPLIER \| OTHER` | optional filter |
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
    "taxId": "1234567890123",
    "isHeadOffice": true,
    "branchCode": null,
    "addressLine1": "123 Sukhumvit Rd",
    "subDistrict": "Khlong Toei",
    "district": "Khlong Toei",
    "province": "Bangkok",
    "zipcode": "10110",
    "parentBpId": null,
    "defaultVatCodeId": "uuid",
    "defaultWhtCodeId": "uuid",
    "defaultVatCode": {
      "id": "uuid",
      "code": "VAT7",
      "description": "Standard VAT 7%",
      "rate": 7.0,
      "isVatType": true,
      "isZeroRated": false,
      "type": "VAT"
    },
    "defaultWhtCode": {
      "id": "uuid",
      "code": "WHT3",
      "description": "Withholding Tax 3%",
      "rate": 3.0,
      "isVatType": false,
      "isZeroRated": false,
      "type": "WHT"
    },
    "isVatRegistered": true,
    "creditTermDays": 30,
    "activeRoles": ["AR_SOLD_TO", "AP_BUY_FROM"],
    "isActive": true,
    "user": {
      "id": "uuid",
      "role": "VET",
      "email": "somchai@clinic.co.th",
      "username": null
    },
    "vet": {
      "licenseNumber": "VET-12345"
    },
    "supplier": null,
    "createdAt": "ISO-8601 datetime",
    "updatedAt": "ISO-8601 datetime"
  }
]
```

**Authorization**:

- `SUPER_ADMIN`, `CLINIC_OWNER`, `STAFF`, `VET`, `CASHIER`, and `ASSISTANT` may view
- inactive rows only appear for management-capable callers when explicitly requested

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
  "taxId": "0105551234567",
  "isHeadOffice": false,
  "branchCode": "00001",
  "addressLine1": "99 Rama IV Rd",
  "subDistrict": "Si Phraya",
  "district": "Bang Rak",
  "province": "Bangkok",
  "zipcode": "10500",
  "parentBpId": "uuid",
  "defaultVatCodeId": "uuid",
  "defaultWhtCodeId": "uuid",
  "defaultVatCode": {
    "id": "uuid",
    "code": "VAT7",
    "description": "Standard VAT 7%",
    "rate": 7.0,
    "isVatType": true,
    "isZeroRated": false,
    "type": "VAT"
  },
  "defaultWhtCode": {
    "id": "uuid",
    "code": "WHT3",
    "description": "Withholding Tax 3%",
    "rate": 3.0,
    "isVatType": false,
    "isZeroRated": false,
    "type": "WHT"
  },
  "isVatRegistered": true,
  "creditTermDays": 30,
  "activeRoles": ["AP_BUY_FROM", "AP_INVOICE_FROM"],
  "isActive": false,
  "user": null,
  "vet": null,
  "supplier": {
    "vendorGroupId": "VG-MED"
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
  "taxId": "1234567890123",
  "isHeadOffice": true,
  "branchCode": null,
  "addressLine1": "123 Sukhumvit Rd",
  "subDistrict": "Khlong Toei",
  "district": "Khlong Toei",
  "province": "Bangkok",
  "zipcode": "10110",
  "parentBpId": null,
  "defaultVatCodeId": "uuid",
  "defaultWhtCodeId": "uuid",
  "creditTermDays": 0,
  "activeRoles": ["AR_SOLD_TO"],
  "linkUserId": null,
  "vet": {
    "licenseNumber": "VET-12345"
  },
  "supplier": null
}
```

**Conditional validation**:

- `vet` object required when `type = VET`; `licenseNumber` is mandatory within it
- `supplier` object required when `type = SUPPLIER`
- `branchCode` must be provided when `isHeadOffice = false`
- `parentBpId` must reference a BP within the same clinic
- `defaultVatCodeId` / `defaultWhtCodeId` must reference active global `TaxCode` records
- `linkUserId` optional; if supplied must belong to the same clinic and not already be linked to another BP

**Response 201**:

```json
{
  "id": "uuid",
  "clinicId": "uuid",
  "type": "VET",
  "name": "Dr. Somchai",
  "taxId": "1234567890123",
  "isHeadOffice": true,
  "branchCode": null,
  "addressLine1": "123 Sukhumvit Rd",
  "subDistrict": "Khlong Toei",
  "district": "Khlong Toei",
  "province": "Bangkok",
  "zipcode": "10110",
  "parentBpId": null,
  "defaultVatCodeId": "uuid",
  "defaultWhtCodeId": "uuid",
  "defaultVatCode": {
    "id": "uuid",
    "code": "VAT7",
    "description": "Standard VAT 7%",
    "rate": 7.0,
    "isVatType": true,
    "isZeroRated": false,
    "type": "VAT"
  },
  "defaultWhtCode": {
    "id": "uuid",
    "code": "WHT3",
    "description": "Withholding Tax 3%",
    "rate": 3.0,
    "isVatType": false,
    "isZeroRated": false,
    "type": "WHT"
  },
  "isVatRegistered": true,
  "creditTermDays": 0,
  "activeRoles": ["AR_SOLD_TO"],
  "isActive": true,
  "user": null,
  "vet": {
    "licenseNumber": "VET-12345"
  },
  "supplier": null,
  "createdAt": "ISO-8601 datetime",
  "updatedAt": "ISO-8601 datetime"
}
```

**Error responses**:

| Status | Code | Trigger |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid or missing required fields |
| 403 | `FORBIDDEN` | Caller cannot create/edit BPs |
| 409 | `CONFLICT` | Vet license or user linkage already exists |

---

### PATCH /clinic/business-partners/:id

Update an active Business Partner. All fields are optional; only fields present in the request body are updated.

**Authorization**:

- allowed: `SUPER_ADMIN`, `CLINIC_OWNER`, `STAFF`
- denied: `VET`, `CASHIER`, `ASSISTANT`

**Request body** (example — partial update):

```json
{
  "name": "Dr. Somchai Boonmee",
  "defaultWhtCodeId": "uuid",
  "activeRoles": ["AR_SOLD_TO", "AP_BUY_FROM"],
  "vet": {
    "licenseNumber": "VET-12345"
  }
}
```

**Rules**:

- `type` cannot change once created
- `activeRoles` when present replaces the full set of active roles atomically (deleteMany + createMany)
- `activeRoles: []` clears all active roles
- supplying `vet: null` removes the VET extension record (allowed only if BP is being re-classified — type is immutable so this is an edge case)
- inactive BP rows cannot be edited until reactivated

**Response 200**:

Same shape as `GET /clinic/business-partners/:id`.

---

### PATCH /clinic/business-partners/:id/deactivate

Soft-delete a Business Partner by setting `isActive = false`.

**Authorization**:

- allowed: `SUPER_ADMIN`, `CLINIC_OWNER`

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