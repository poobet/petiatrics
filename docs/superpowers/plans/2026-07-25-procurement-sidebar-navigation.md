# Procurement Sidebar Navigation Sub-Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the procurement tabs into expandable sidebar sub-menu items under "การจัดซื้อ" (Procurement) with dedicated Next.js sub-routes.

**Architecture:** Update `NAV_ITEMS` in `app-shell.tsx` to include `procurement` sub-items (`purchaseOrders`, `goodsReceipt`, `purchaseInvoices`, `supplierPayments`). Create sub-route pages under `/clinic/procurement/` (`orders`, `receipts`, `invoices`, `payments`), redirecting the root `/clinic/procurement` route to `/orders`. Remove the horizontal top tab bar from `procurement-client.tsx` and drive active tab state via `initialTab` prop.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, `next-intl`.

---

### Task 1: Add i18n Translations for Sub-Menu Items

**Files:**
- Modify: `apps/web/messages/th.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add sub-menu label translations to `th.json`**

In `apps/web/messages/th.json`, add keys under `nav`:
```json
"purchaseOrders": "ใบสั่งซื้อ",
"goodsReceipt": "ใบรับสินค้า",
"purchaseInvoices": "ใบแจ้งหนี้ผู้ขาย",
"supplierPayments": "การชำระเงินผู้ขาย"
```

- [ ] **Step 2: Add sub-menu label translations to `en.json`**

In `apps/web/messages/en.json`, add keys under `nav`:
```json
"purchaseOrders": "Purchase Orders",
"goodsReceipt": "Goods Receipts",
"purchaseInvoices": "Purchase Invoices",
"supplierPayments": "Supplier Payments"
```

- [ ] **Step 3: Commit i18n changes**

```bash
git add apps/web/messages/th.json apps/web/messages/en.json
git commit -m "feat(procurement): add i18n translation keys for procurement sidebar sub-menu items"
```

---

### Task 2: Update Sidebar Navigation in `app-shell.tsx`

**Files:**
- Modify: `apps/web/components/layout/app-shell.tsx`

- [ ] **Step 1: Update `NAV_ITEMS` definition**

In `apps/web/components/layout/app-shell.tsx`, update the `procurement` entry in `NAV_ITEMS` to define `subItems`:

```typescript
  {
    key: 'procurement',
    icon: ClipboardList,
    subItems: [
      { key: 'purchaseOrders', href: '/clinic/procurement/orders', icon: FileText, requiredPermission: 'INVENTORY:VIEW' },
      { key: 'goodsReceipt', href: '/clinic/procurement/receipts', icon: Boxes, requiredPermission: 'INVENTORY:ADD' },
      { key: 'purchaseInvoices', href: '/clinic/procurement/invoices', icon: FileText, requiredPermission: 'INVENTORY:VIEW' },
      { key: 'supplierPayments', href: '/clinic/procurement/payments', icon: CreditCard, requiredPermission: 'INVENTORY:VIEW' },
    ],
  },
```

- [ ] **Step 2: Commit sidebar navigation update**

```bash
git add apps/web/components/layout/app-shell.tsx
git commit -m "feat(procurement): update app-shell sidebar to expand procurement sub-menu items"
```

---

### Task 3: Create Next.js Sub-Routes for Procurement Pages

**Files:**
- Create: `apps/web/app/(clinic)/clinic/procurement/orders/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/procurement/receipts/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/procurement/invoices/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/procurement/payments/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/procurement/page.tsx`

- [ ] **Step 1: Create `orders/page.tsx`**

```tsx
import ProcurementClient from '../procurement-client';

export default function PurchaseOrdersPage() {
  return <ProcurementClient initialTab="pos" />;
}
```

- [ ] **Step 2: Create `receipts/page.tsx`**

```tsx
import ProcurementClient from '../procurement-client';

export default function GoodsReceiptsPage() {
  return <ProcurementClient initialTab="grs" />;
}
```

- [ ] **Step 3: Create `invoices/page.tsx`**

```tsx
import ProcurementClient from '../procurement-client';

export default function PurchaseInvoicesPage() {
  return <ProcurementClient initialTab="invoices" />;
}
```

- [ ] **Step 4: Create `payments/page.tsx`**

```tsx
import ProcurementClient from '../procurement-client';

export default function SupplierPaymentsPage() {
  return <ProcurementClient initialTab="payments" />;
}
```

- [ ] **Step 5: Update `page.tsx` to redirect to `/clinic/procurement/orders`**

```tsx
import { redirect } from 'next/navigation';

export default function ProcurementPage() {
  redirect('/clinic/procurement/orders');
}
```

- [ ] **Step 6: Commit new sub-routes**

```bash
git add apps/web/app/\(clinic\)/clinic/procurement/
git commit -m "feat(procurement): add sub-route pages for procurement sub-menu items"
```

---

### Task 4: Refactor `procurement-client.tsx` Component

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/procurement/procurement-client.tsx`

- [ ] **Step 1: Update component interface to accept `initialTab`**

Add `ProcurementClientProps`:
```tsx
interface ProcurementClientProps {
  initialTab?: 'pos' | 'grs' | 'invoices' | 'payments';
}

export default function ProcurementClient({ initialTab = 'pos' }: ProcurementClientProps) {
  const [activeTab, setActiveTab] = useState<'pos' | 'grs' | 'invoices' | 'payments'>(initialTab);
```

- [ ] **Step 2: Remove horizontal top tab bar**

Delete the `<div className="border-b flex gap-6">` tab switching buttons block.

- [ ] **Step 3: Verify build and type check**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit refactored component**

```bash
git add apps/web/app/\(clinic\)/clinic/procurement/procurement-client.tsx
git commit -m "refactor(procurement): remove horizontal tabs and drive view via initialTab prop"
```
