# API Contract: Stock & Inventory Movements (v1)

**Feature**: 008-inventory-management
**Base path**: `/api/v1/inventory`
**Auth**: Session cookie required on all routes
**Tenant**: `clinicId` derived from server-side session — never accepted from client

---

## Endpoints

### Stock Balances

#### `GET /inventory/stock-balances`
List stock balances for the clinic. Staff sees their branch only; Manager/Admin can query any branch.

**Query params**:
- `branchId` (optional, Manager/Admin only)
- `productId` (optional)
- `lowStock` (boolean, optional) — filter to items at/below reorder point
- `page`, `limit`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "branchId": "uuid",
      "branchName": "Main Branch",
      "productId": "uuid",
      "productName": "Amoxicillin 500mg",
      "sku": "AMX-500",
      "lotNumber": "LOT-2026-042",
      "expiryDate": "2027-03-31T00:00:00Z",
      "quantity": 45.000,
      "reorderPoint": 10,
      "status": "IN_STOCK"
    }
  ],
  "total": 120,
  "page": 1,
  "limit": 50
}
```

**Status enum**: `IN_STOCK | LOW_STOCK | OUT_OF_STOCK | EXPIRED`

---

#### `GET /inventory/stock-balances/lots/:productId`
Returns all lots for a product in the current branch, ordered FEFO (expiryDate ASC).

**Response 200**:
```json
{
  "data": [
    {
      "lotNumber": "LOT-2025-001",
      "expiryDate": "2025-12-31T00:00:00Z",
      "quantity": 3.000,
      "isExpired": true,
      "isFefo": true
    },
    {
      "lotNumber": "LOT-2026-042",
      "expiryDate": "2027-03-31T00:00:00Z",
      "quantity": 45.000,
      "isExpired": false,
      "isFefo": false
    }
  ]
}
```

---

### Stock Movements

#### `POST /inventory/stock-movements`
Create a Goods Receipt (GOODS_RECEIPT) or Goods Issue (GOODS_ISSUE).

**Roles**: STAFF, MANAGER, ADMIN

**Request body**:
```json
{
  "movementType": "GOODS_RECEIPT | GOODS_ISSUE",
  "branchId": "uuid",
  "productId": "uuid",
  "quantity": 50,
  "lotNumber": "LOT-2026-042",
  "expiryDate": "2027-03-31T00:00:00Z",
  "referenceId": "PO-00456",
  "overrideReason": "optional — required if deviating from FEFO or issuing expired lot"
}
```

**Validation**:
- `quantity > 0` for RECEIPT; `quantity > 0` (server negates) for ISSUE
- `lotNumber` + `expiryDate` required if `requiresBatchAndExpiryTracking = true` on RECEIPT
- `overrideReason` required if issuing from non-FEFO or expired lot
- Balance check: after ISSUE, balance must remain >= 0; 409 if insufficient

**Response 201**:
```json
{
  "id": "uuid",
  "status": "COMMITTED",
  "newBalance": 95.000
}
```

**Response 409** (insufficient stock or optimistic lock conflict):
```json
{ "error": "INSUFFICIENT_STOCK", "available": 3.000 }
```

---

#### `POST /inventory/stock-adjustments`
Submit a Stock Adjustment for Manager approval.

**Roles**: MANAGER, ADMIN

**Request body**:
```json
{
  "branchId": "uuid",
  "productId": "uuid",
  "lotNumber": "LOT-2026-042",
  "physicalCount": 38,
  "notes": "Physical count after quarterly audit"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "status": "PENDING_APPROVAL",
  "currentBalance": 45.000,
  "proposedBalance": 38.000,
  "variance": -7.000
}
```

---

#### `PATCH /inventory/stock-adjustments/:id/approve`
Approve a pending adjustment, committing the balance change.

**Roles**: MANAGER, ADMIN

**Response 200**:
```json
{ "id": "uuid", "status": "COMMITTED", "newBalance": 38.000 }
```

---

#### `PATCH /inventory/stock-adjustments/:id/reject`
Reject a pending adjustment.

**Roles**: MANAGER, ADMIN

**Request body**:
```json
{ "rejectionReason": "Count discrepancy traced to mis-scan; re-count required." }
```

**Response 200**:
```json
{ "id": "uuid", "status": "REJECTED" }
```

---

#### `GET /inventory/stock-movements`
Audit log query.

**Roles**: MANAGER, ADMIN

**Query params**: `branchId`, `productId`, `movementType`, `status`, `from` (ISO date), `to` (ISO date), `page`, `limit`

**Response 200**: paginated list of StockMovement records with actor name, lot info, override reason.

---

### Alerts

#### `GET /inventory/alerts/low-stock`
List active Low Stock alerts.

**Roles**: STAFF (branch-scoped), MANAGER, ADMIN

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Amoxicillin 500mg",
      "branchId": "uuid",
      "branchName": "Main Branch",
      "currentQuantity": 3.000,
      "reorderPoint": 10,
      "preferredSupplierId": "uuid",
      "preferredSupplierName": "PharmaCo Ltd.",
      "triggeredAt": "2026-06-01T09:23:00Z"
    }
  ]
}
```
