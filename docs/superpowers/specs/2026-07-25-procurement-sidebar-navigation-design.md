# Design Specification: Procurement Sidebar Navigation Sub-Menu

**Date**: 2026-07-25  
**Topic**: Move Procurement tabs to Sidebar Sub-Menu items  
**Status**: Approved  

---

## 1. Overview & Objectives

Currently, the Procurement module (`/clinic/procurement`) displays four primary document workflows—Purchase Orders, Goods Receipts, Purchase Invoices, and Supplier Payments—within a single page using a top horizontal tab bar.

This specification details the refactoring to convert these tabs into distinct, expandable sub-menu items in the main sidebar navigation under "การจัดซื้อ" (Procurement). This improves navigation clarity, deep-linkability, and consistency with other modules like Inventory and Settings.

---

## 2. Navigation & Routing Architecture

### 2.1 Sidebar Navigation Structure (`app-shell.tsx`)

Update `NAV_ITEMS` in `apps/web/components/layout/app-shell.tsx` to configure `procurement` as an expandable parent menu with 4 sub-items:

```typescript
{
  key: 'procurement',
  icon: ClipboardList,
  subItems: [
    { key: 'purchaseOrders', href: '/clinic/procurement/orders', icon: FileText, requiredPermission: 'INVENTORY:VIEW' },
    { key: 'goodsReceipt', href: '/clinic/procurement/receipts', icon: Boxes, requiredPermission: 'INVENTORY:ADD' },
    { key: 'purchaseInvoices', href: '/clinic/procurement/invoices', icon: Receipt, requiredPermission: 'INVENTORY:VIEW' },
    { key: 'supplierPayments', href: '/clinic/procurement/payments', icon: CreditCard, requiredPermission: 'INVENTORY:VIEW' },
  ],
}
```

### 2.2 Route Structure (`apps/web/app/(clinic)/clinic/procurement/`)

Create dedicated sub-route page files under `apps/web/app/(clinic)/clinic/procurement/`:
- `orders/page.tsx` -> renders `<ProcurementClient initialTab="pos" />`
- `receipts/page.tsx` -> renders `<ProcurementClient initialTab="grs" />`
- `invoices/page.tsx` -> renders `<ProcurementClient initialTab="invoices" />`
- `payments/page.tsx` -> renders `<ProcurementClient initialTab="payments" />`
- `page.tsx` -> redirects to `/clinic/procurement/orders` via Next.js `redirect()`.

---

## 3. UI Component Modifications (`procurement-client.tsx`)

1. **Remove Horizontal Tab Bar**:
   Remove the `<div className="border-b flex gap-6">` tab switcher block from `ProcurementClient`.

2. **Active View Control**:
   - Accept `initialTab` prop (`'pos' | 'grs' | 'invoices' | 'payments'`).
   - Sync view state with the active sub-route page.

3. **Header & Action Buttons**:
   - Section header title and primary action buttons (e.g. *New Purchase Order*, *Receive Inbound Goods*, *New Purchase Invoice*, *Record Supplier Payment*) dynamically display based on `initialTab`.

---

## 4. Internationalization (`th.json` & `en.json`)

Add navigation labels under `nav`:

```json
"purchaseOrders": "ใบสั่งซื้อ",
"goodsReceipt": "ใบรับสินค้า",
"purchaseInvoices": "ใบแจ้งหนี้ผู้ขาย",
"supplierPayments": "การชำระเงินผู้ขาย"
```

---

## 5. Verification Plan

1. **Routing & Sidebar Navigation**:
   - Verify expanding "การจัดซื้อ" in sidebar displays 4 sub-items.
   - Verify clicking each sub-item navigates to `/clinic/procurement/orders`, `/receipts`, `/invoices`, `/payments`.
   - Verify `/clinic/procurement` redirects to `/clinic/procurement/orders`.
2. **Build & Type Checking**:
   - Run `npm run build` across monorepo to ensure zero TypeScript or build errors.
