# API Contracts: Item Master ERP Foundation

All endpoints follow the existing `{ data, meta, error }` response envelope.

Base path: `/api/v1`

All clinic item endpoints require:

- authenticated Redis-backed session
- valid `x-active-branch` header on protected clinic requests
- clinic ownership derived from server session context, never from request payloads

---

## Item Master Endpoints

### GET /inventory/products

Return clinic-scoped items for the current clinic.

**Query parameters**:

| Name | Type | Notes |
|------|------|------|
| `search` | `string` | Matches code and name |
| `itemType` | `STOCKED_GOOD \| SERVICE` | Optional filter |
| `categoryId` | `string` | Optional clinic category filter |
| `includeInactive` | `boolean` | Optional management-only filter |
| `controlledSubstance` | `boolean` | Optional medical flag filter |

**Response 200**:

```json
[
  {
    "id": "uuid",
    "code": "MED-001",
    "name": "Amoxicillin 250 mg",
    "itemType": "STOCKED_GOOD",
    "category": {
      "id": "uuid",
      "name": "Medicine"
    },
    "baseUnit": {
      "id": "uuid",
      "name": "Piece",
      "symbol": "pc"
    },
    "standardCost": 12.5,
    "baseSellingPrice": 20.0,
    "isTaxInclusive": false,
    "defaultTaxCode": {
      "id": "uuid",
      "code": "VAT7",
      "rate": 7.0,
      "type": "VAT"
    },
    "isControlledSubstance": false,
    "requiresBatchAndExpiryTracking": true,
    "defaultSupplier": {
      "id": "uuid",
      "name": "Thai Vet Supply Co."
    },
    "isActive": true
  }
]
```

---

### GET /inventory/products/:id

Return one clinic-scoped item including units, pricing, and clinic-specific flags.

**Response 200**:

```json
{
  "id": "uuid",
  "code": "CONSULT-STD",
  "name": "Standard Consultation",
  "itemType": "SERVICE",
  "category": {
    "id": "uuid",
    "name": "Consultation"
  },
  "baseUnit": {
    "id": "uuid",
    "name": "Visit",
    "symbol": "visit"
  },
  "conversions": [],
  "standardCost": 0,
  "baseSellingPrice": 500,
  "isTaxInclusive": true,
  "defaultTaxCode": {
    "id": "uuid",
    "code": "VAT7",
    "rate": 7.0,
    "type": "VAT"
  },
  "genericName": null,
  "isControlledSubstance": false,
  "requiresBatchAndExpiryTracking": false,
  "defaultSupplier": null,
  "defaultDoctorFee": 200,
  "quantity": 0,
  "reorderThreshold": 0,
  "isActive": true,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

**Error responses**:

| Status | Code | Trigger |
|--------|------|---------|
| 404 | `NOT_FOUND` | Item not found in current clinic |
| 403 | `FORBIDDEN` | Caller lacks access |

---

### POST /inventory/products

Create a clinic-owned item.

**Request body**:

```json
{
  "code": "MED-001",
  "name": "Amoxicillin 250 mg",
  "itemType": "STOCKED_GOOD",
  "categoryId": "uuid",
  "baseUnitId": "uuid",
  "conversions": [
    {
      "unitId": "uuid",
      "ratioToBase": 10
    }
  ],
  "standardCost": 12.5,
  "baseSellingPrice": 20,
  "isTaxInclusive": false,
  "defaultTaxCodeId": "uuid",
  "genericName": "Amoxicillin",
  "isControlledSubstance": false,
  "requiresBatchAndExpiryTracking": true,
  "defaultSupplierId": "uuid",
  "defaultDoctorFee": null,
  "reorderThreshold": 50
}
```

**Response 201**:

- Returns the full item detail shape used by `GET /inventory/products/:id`.

**Validation rules**:

- `code` is normalized before uniqueness checks.
- `itemType = SERVICE` cannot submit stock-only settings beyond compatibility defaults.
- `isTaxInclusive` affects downstream billing behavior only; no tax amount is calculated in this endpoint.
- `defaultTaxCodeId` must reference an active global `TaxCode` row.
- `defaultSupplierId` must reference a same-clinic supplier-capable BP.
- each conversion ratio must be positive and each alternate unit must be unique within the item payload.

**Error responses**:

| Status | Code | Trigger |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields, invalid conversion, cross-clinic supplier, inactive tax code |
| 409 | `CONFLICT` | Duplicate normalized item code within clinic |

---

### PATCH /inventory/products/:id

Update an existing clinic-owned item.

**Request body**:

Same shape as create, but fields are partial except where business rules require a consistent aggregate.

**Response 200**:

- Returns the full updated item detail shape.

**Audit requirement**:

- This endpoint must emit an audit event for `entity = Product` or the finalized item entity name used by the implementation.

---

### PATCH /inventory/products/:id/deactivate

Soft-deactivate an item so it no longer appears in active selectors.

**Request body**: none

**Response 200**:

```json
{
  "id": "uuid",
  "isActive": false
}
```

**Rules**:

- Deactivation preserves historical references.
- Inactive items remain retrievable for management/detail screens where authorized.

---

## Reference Endpoints

### GET /reference/tax-codes

Existing global endpoint reused for item tax selection.

---

### GET /inventory/reference/categories

Return active clinic-scoped item categories.

**Response 200**:

```json
[
  {
    "id": "uuid",
    "name": "Medicine",
    "code": "MED",
    "revenueGlCode": null,
    "expenseGlCode": null,
    "isActive": true
  }
]
```

---

### GET /inventory/reference/units

Return active clinic-scoped units of measure.

**Response 200**:

```json
[
  {
    "id": "uuid",
    "name": "Piece",
    "symbol": "pc",
    "isActive": true
  },
  {
    "id": "uuid",
    "name": "Box",
    "symbol": "bx",
    "isActive": true
  }
]
```

---

## Downstream Billing Rule Documentation

The item master persists pricing strategy but does not calculate invoice tax.

- If `isTaxInclusive = false`, downstream billing must add the current referenced `TaxCode.rate` on top of `baseSellingPrice`.
- If `isTaxInclusive = true`, downstream billing must treat `baseSellingPrice` as the grand total and reverse-calculate the tax portion using the current referenced `TaxCode.rate`.
- Because the item stores a `TaxCode` reference rather than a tax percentage snapshot, statutory VAT rate changes flow automatically through future billing calculations.
