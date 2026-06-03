# Design Specification: Parent-Child Product Bundling

This document specifies the design for the Parent-Child Product Bundling (Accessories) feature in the Petiatrics platform.

## Goal

Provide a way to link parent items to child items (accessories) with a quantity ratio. When a parent item is selected during medical Visit Record (Prescription) or Billing (Invoice) creation, the configured child items are automatically added to the list of items as independent lines, allowing the user to modify or delete them.

---

## 1. Database Schema

We introduce a new table `ProductAccessory` to model the self-referencing many-to-many relationship of products in [schema.prisma](file:///d:/Deaw/petiatrics/packages/database/prisma/schema.prisma).

### prisma.schema additions:

```prisma
model Product {
  id                             String    @id @default(uuid())
  // ... existing fields ...

  // Relationships
  parentProductAccessories       ProductAccessory[] @relation("ParentProductRelations")
  childProductAccessories        ProductAccessory[] @relation("ChildProductRelations")
}

model ProductAccessory {
  id              String   @id @default(uuid())
  parentProductId String
  childProductId  String
  quantityRatio   Decimal  @db.Decimal(10, 3) @default(1.0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  parentProduct   Product  @relation("ParentProductRelations", fields: [parentProductId], references: [id], onDelete: Cascade)
  childProduct    Product  @relation("ChildProductRelations", fields: [childProductId], references: [id], onDelete: Cascade)

  @@unique([parentProductId, childProductId])
  @@index([parentProductId])
  @@index([childProductId])
  @@map("product_accessories")
}
```

---

## 2. API Endpoints

### 2.1 GET `/api/v1/inventory/products/:id` (Product Detail)
Extend the returned payload to include the mapped accessories:
```json
{
  "id": "parent-id",
  "code": "MED-001",
  "name": "Metronidazole 125mg",
  "accessories": [
    {
      "id": "relation-id",
      "childProductId": "child-id",
      "name": "Needle 21G",
      "code": "NDL-001",
      "sku": "SKU-992",
      "itemType": "STOCKED_GOOD",
      "quantityRatio": 1.5
    }
  ]
}
```

### 2.2 POST `/api/v1/inventory/products` & PATCH `/api/v1/inventory/products/:id`
Allow sending `accessories` in the request body:
```json
{
  "code": "MED-001",
  "name": "Metronidazole 125mg",
  "accessories": [
    { "childProductId": "child-id-1", "quantityRatio": 1.0 },
    { "childProductId": "child-id-2", "quantityRatio": 2.0 }
  ]
}
```
* **Service Logic**:
  * On update/patch, delete existing `ProductAccessory` relations for `parentProductId = id`.
  * Create new relationships in `ProductAccessory` based on the payload.

---

## 3. Frontend UI Settings Tab

Add a new tab **"Accessories/Bundle"** in [ItemForm](file:///d:/Deaw/petiatrics/apps/web/components/inventory/item-form.tsx):
* **Tab Visibility**: Visible only in edit mode (`isEdit = true`).
* **Features**:
  * **Search & Add**: Includes `ItemSearchCombobox` to search for items of type `STOCKED_GOOD` or `SERVICE` (excluding the product itself and already added accessories). Adds them with a default ratio of `1.0`.
  * **Editable Multiplier**: A table listing added accessories showing Name, SKU, and a number input for `Quantity Multiplier` (`quantityRatio`).
  * **Delete Button**: Standard delete/trash icon to remove the accessory link.

---

## 4. UI Forms Auto-Population Behavior

### 4.1 Visit Record / Prescription Form ([new/page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/%28clinic%29/clinic/patients/%5Bid%5D/visits/new/page.tsx))
* Replace the plain text input for "Drug name" with a searchable product combobox.
* When selecting a product, check if it has `accessories`.
* Automatically append child items to the `prescriptions` array with calculated quantities.

### 4.2 Billing / Invoice Form (Billing/Invoice Editor)
* When adding a product/service to the invoice, fetch its accessories.
* Automatically append the accessory items to the invoice line items list in the UI, calculating `qty = parentQty * quantityRatio`.
* Allow the user to manually override, modify quantity/price, or delete the accessory rows before saving.

---

## 5. Verification Plan

### 5.1 Backend Service Tests
* Test product creation with accessories.
* Test product updates (updating, removing, and adding accessories).
* Test cascade deletion (deleting parent product deletes accessory relations; deleting child product deletes accessory relations).

### 5.2 Frontend Component Tests
* Verify `AccessoriesTab` correctly lists accessories, allows changing quantity ratio, and deleting accessories.
* Verify `ItemSearchCombobox` filters out the parent item and duplicates.
