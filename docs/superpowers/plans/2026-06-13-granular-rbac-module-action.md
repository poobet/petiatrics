# Granular RBAC — MODULE:ACTION Permissions + Dedicated Settings Sub-Menu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all system permissions to a `MODULE:ACTION` naming convention, expose a dedicated `/clinic/settings/roles` page for role permission management, surface it as a Settings sub-menu in the sidebar, and wire action-level checks (ADD, EDIT, DELETE) into the frontend UI to conditionally render/disable buttons.

**Architecture:** The permission string format changes from `VIEW_PATIENTS` to `PATIENT:VIEW`, `EDIT_PATIENTS` to `PATIENT:EDIT`, etc. A shared `PERMISSIONS` constant in `@petiatrics/types` provides the canonical list. Backend controllers swap their `@Permissions()` strings. Frontend pages read `user.permissions` from the Zustand session store to show/hide action buttons. A new `usePermission(perm)` hook centralises the check.

**Tech Stack:** NestJS (backend), Next.js 15 App Router (frontend), Zustand (session store), `@petiatrics/types` (shared types), Prisma (database), TailwindCSS + shadcn/ui components.

---

## Permission String Map (Old to New)

| Old | New |
|---|---|
| `VIEW_PATIENTS` | `PATIENT:VIEW` |
| `EDIT_PATIENTS` | `PATIENT:EDIT` |
| `MANAGE_VISITS` | `VISIT:VIEW`, `VISIT:ADD`, `VISIT:EDIT` |
| `MANAGE_VACCINATIONS` | `VACCINATION:ADD` |
| `VIEW_INVENTORY` | `INVENTORY:VIEW` |
| `MANAGE_INVENTORY` | `INVENTORY:ADD`, `INVENTORY:EDIT`, `INVENTORY:DELETE` |
| `VIEW_BILLING` | `BILLING:VIEW` |
| `MANAGE_BILLING` | `BILLING:ADD`, `BILLING:EDIT`, `BILLING:VOID` |
| `MANAGE_SETTINGS` | `SETTINGS:MANAGE` |

---

## Task 1: Canonical Permission Constants in @petiatrics/types

**Files:**
- Create: `packages/types/src/permissions.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Create `packages/types/src/permissions.ts`**

```typescript
export const PERMISSIONS = {
  PATIENT_VIEW: 'PATIENT:VIEW',
  PATIENT_EDIT: 'PATIENT:EDIT',
  VISIT_VIEW: 'VISIT:VIEW',
  VISIT_ADD: 'VISIT:ADD',
  VISIT_EDIT: 'VISIT:EDIT',
  VACCINATION_ADD: 'VACCINATION:ADD',
  INVENTORY_VIEW: 'INVENTORY:VIEW',
  INVENTORY_ADD: 'INVENTORY:ADD',
  INVENTORY_EDIT: 'INVENTORY:EDIT',
  INVENTORY_DELETE: 'INVENTORY:DELETE',
  BILLING_VIEW: 'BILLING:VIEW',
  BILLING_ADD: 'BILLING:ADD',
  BILLING_EDIT: 'BILLING:EDIT',
  BILLING_VOID: 'BILLING:VOID',
  SETTINGS_MANAGE: 'SETTINGS:MANAGE',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
```

- [ ] **Step 2: Add export to `packages/types/src/index.ts`**

Add `export * from './permissions';` to index.ts.

- [ ] **Step 3: Rebuild types and commit**

```bash
npx turbo run build --filter=@petiatrics/types
git add packages/types
git commit -m "feat(types): add canonical PERMISSIONS MODULE:ACTION constants"
```

---

## Task 2: Backend — DEFAULT_ROLE_PERMISSIONS + Controller Decorators

**Files:**
- Modify: `apps/api/src/modules/identity/services/auth.service.ts`
- Modify: `apps/api/src/modules/clinical/controllers/patient.controller.ts`
- Modify: `apps/api/src/modules/clinical/controllers/visit.controller.ts`
- Modify: `apps/api/src/modules/clinical/controllers/vaccination.controller.ts`
- Modify: `apps/api/src/modules/inventory/controllers/product.controller.ts`
- Modify: `apps/api/src/modules/inventory/controllers/stock.controller.ts`
- Modify: `apps/api/src/modules/billing/controllers/invoice.controller.ts`
- Modify: `apps/api/src/modules/identity/controllers/staff.controller.ts`
- Modify: `apps/api/src/modules/identity/services/auth.service.spec.ts`
- Modify: `apps/api/src/modules/identity/services/user.service.spec.ts`

- [ ] **Step 1: Update DEFAULT_ROLE_PERMISSIONS in auth.service.ts**

Replace the existing block (lines 15-37) with the new MODULE:ACTION format:

```typescript
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.SUPER_ADMIN]: [
    'PATIENT:VIEW', 'PATIENT:EDIT',
    'VISIT:VIEW', 'VISIT:ADD', 'VISIT:EDIT', 'VACCINATION:ADD',
    'INVENTORY:VIEW', 'INVENTORY:ADD', 'INVENTORY:EDIT', 'INVENTORY:DELETE',
    'BILLING:VIEW', 'BILLING:ADD', 'BILLING:EDIT', 'BILLING:VOID',
    'SETTINGS:MANAGE',
  ],
  [Role.CLINIC_OWNER]: [
    'PATIENT:VIEW', 'PATIENT:EDIT',
    'VISIT:VIEW', 'VISIT:ADD', 'VISIT:EDIT', 'VACCINATION:ADD',
    'INVENTORY:VIEW', 'INVENTORY:ADD', 'INVENTORY:EDIT', 'INVENTORY:DELETE',
    'BILLING:VIEW', 'BILLING:ADD', 'BILLING:EDIT', 'BILLING:VOID',
    'SETTINGS:MANAGE',
  ],
  [Role.VET]: [
    'PATIENT:VIEW', 'PATIENT:EDIT',
    'VISIT:VIEW', 'VISIT:ADD', 'VISIT:EDIT', 'VACCINATION:ADD',
    'INVENTORY:VIEW',
  ],
  [Role.ASSISTANT]: ['PATIENT:VIEW', 'VISIT:VIEW', 'INVENTORY:VIEW', 'BILLING:VIEW'],
  [Role.STAFF]: ['PATIENT:VIEW', 'INVENTORY:VIEW', 'BILLING:VIEW'],
  [Role.CASHIER]: ['PATIENT:VIEW', 'BILLING:VIEW', 'BILLING:ADD', 'BILLING:EDIT', 'BILLING:VOID'],
  [Role.CUSTOMER]: [],
};
```

- [ ] **Step 2: Update patient.controller.ts**

```typescript
@Post()     @Permissions('PATIENT:EDIT')    // create
@Get()      @Permissions('PATIENT:VIEW')    // list
@Get(':id') @Permissions('PATIENT:VIEW')    // findOne
@Patch(':id') @Permissions('PATIENT:EDIT') // update
```

- [ ] **Step 3: Update visit.controller.ts**

Move from class-level `@Permissions('MANAGE_VISITS')` to method-level:
```typescript
// GET methods  -> @Permissions('VISIT:VIEW')
// POST methods -> @Permissions('VISIT:ADD')
// PATCH methods -> @Permissions('VISIT:EDIT')
```

- [ ] **Step 4: Update vaccination.controller.ts**

Replace class-level `@Permissions('MANAGE_VACCINATIONS')` with `@Permissions('VACCINATION:ADD')` on each write method.

- [ ] **Step 5: Update product.controller.ts**

```typescript
@Post()              -> @Permissions('INVENTORY:ADD')
@Get() / @Get('*')   -> @Permissions('INVENTORY:VIEW')
@Patch(':id')        -> @Permissions('INVENTORY:EDIT')
@Patch(':id/deactivate') -> @Permissions('INVENTORY:DELETE')
```

- [ ] **Step 6: Update stock.controller.ts**

```typescript
@Post('stock/replenish')    -> @Permissions('INVENTORY:ADD')
@Get('stock/movements')     -> @Permissions('INVENTORY:VIEW')
@Get('*balances*')          -> @Permissions('INVENTORY:VIEW')
@Post('stock-movements')    -> @Permissions('INVENTORY:ADD')
```

- [ ] **Step 7: Update invoice.controller.ts**

```typescript
@Post()            -> @Permissions('BILLING:ADD')
@Get() / @Get(':id') -> @Permissions('BILLING:VIEW')
@Patch(':id/issue') -> @Permissions('BILLING:EDIT')
@Patch(':id/pay')   -> @Permissions('BILLING:EDIT')
@Delete(':id')      -> @Permissions('BILLING:VOID')
```

- [ ] **Step 8: Update staff.controller.ts**

Add `@Permissions('SETTINGS:MANAGE')` to the `updateRolePermissions` endpoint (PUT /clinic/staff/roles/:role/permissions).

- [ ] **Step 9: Update auth.service.spec.ts**

Update any `expect(profile.permissions).toContain(...)` assertions:
```typescript
// Before: 'VIEW_PATIENTS'  After: 'PATIENT:VIEW'
// Before: 'MANAGE_BILLING' After: 'BILLING:ADD' (or the specific needed one)
```

- [ ] **Step 10: Update user.service.spec.ts**

Update `updateRolePermissions` test mock data from `'VIEW_PATIENTS'` to `'PATIENT:VIEW'`.

- [ ] **Step 11: Run tests and commit**

```bash
npx turbo run test --filter=@petiatrics/api
git add apps/api
git commit -m "feat(rbac): migrate all @Permissions decorators to MODULE:ACTION format"
```

Expected: `Test Suites: 14 passed, 14 total`

---

## Task 3: Frontend — usePermission Hook + app-shell Settings Sub-Menu

**Files:**
- Create: `apps/web/lib/use-permission.ts`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/th.json`
- Modify: `apps/web/app/(clinic)/clinic/staff/staff-client.tsx`

- [ ] **Step 1: Create `apps/web/lib/use-permission.ts`**

```typescript
'use client';

import { useSessionStore } from './session-store';

export function usePermission(permission: string): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return (user.permissions ?? []).includes(permission);
}

export function usePermissions(permissions: string[]): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const userPerms = user.permissions ?? [];
  return permissions.every((p) => userPerms.includes(p));
}
```

- [ ] **Step 2: Update NavKey type in app-shell.tsx**

```typescript
type NavKey = 'dashboard' | 'appointments' | 'patients' | 'clients' | 'medicalRecords'
  | 'inventory' | 'products' | 'stockLedger' | 'goodsReceipt' | 'goodsIssue' | 'adjustments'
  | 'billing' | 'staff' | 'businessPartners' | 'audit' | 'mobileApp'
  | 'settings' | 'settingsGeneral' | 'rolePermissions';
```

- [ ] **Step 3: Add Shield to lucide-react imports in app-shell.tsx**

Add `Shield` to the existing `import { ..., Shield } from 'lucide-react';` line.

- [ ] **Step 4: Replace NAV_ITEMS settings entry + update permission strings**

Replace the full NAV_ITEMS array with the updated version using new permission strings and settings sub-menu:

```typescript
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/clinic/dashboard', icon: LayoutDashboard },
  { key: 'appointments', href: '/clinic/appointments', icon: Calendar },
  { key: 'patients', href: '/clinic/patients', icon: PawPrint, requiredPermission: 'PATIENT:VIEW' },
  { key: 'clients', href: '/clients', icon: Users },
  { key: 'medicalRecords', href: '/medical-records', icon: FileText, requiredPermission: 'PATIENT:VIEW' },
  {
    key: 'inventory',
    icon: Package,
    subItems: [
      { key: 'products', href: '/clinic/inventory/products', icon: Package, requiredPermission: 'INVENTORY:VIEW' },
      { key: 'stockLedger', href: '/clinic/inventory/stock-ledger', icon: Archive, requiredPermission: 'INVENTORY:VIEW' },
      { key: 'goodsReceipt', href: '/clinic/inventory/receipt', icon: Boxes, requiredPermission: 'INVENTORY:ADD' },
      { key: 'goodsIssue', href: '/clinic/inventory/issue', icon: Archive, requiredPermission: 'INVENTORY:ADD' },
      { key: 'adjustments', href: '/clinic/inventory/adjustments', icon: Boxes, requiredPermission: 'INVENTORY:EDIT' },
    ],
  },
  { key: 'billing', href: '/clinic/billing', icon: CreditCard, requiredPermission: 'BILLING:VIEW' },
  { key: 'staff', href: '/clinic/staff', icon: UserCog, roles: ['CLINIC_OWNER', 'SUPER_ADMIN'] },
  { key: 'businessPartners', href: '/clinic/business-partners', icon: Briefcase, roles: ['CLINIC_OWNER', 'SUPER_ADMIN', 'STAFF'] },
  { key: 'audit', href: '/clinic/audit', icon: ClipboardList, roles: ['CLINIC_OWNER', 'SUPER_ADMIN'] },
  {
    key: 'settings',
    icon: Settings,
    subItems: [
      { key: 'settingsGeneral', href: '/clinic/settings', icon: Settings },
      { key: 'rolePermissions', href: '/clinic/settings/roles', icon: Shield, requiredPermission: 'SETTINGS:MANAGE' },
    ],
  },
];
```

- [ ] **Step 5: Add translation keys**

In `apps/web/messages/en.json` under "nav":
```json
"settingsGeneral": "General",
"rolePermissions": "Roles & Permissions"
```

In `apps/web/messages/th.json` under "nav":
```json
"settingsGeneral": "ทั่วไป",
"rolePermissions": "บทบาท & สิทธิ์"
```

- [ ] **Step 6: Remove Manage Role Permissions dialog from staff-client.tsx**

Remove from `staff-client.tsx`:
- All state related to role permissions dialog: `rolePermissionsOpen`, `selectedRole`, `rolePermissionsList`, `loadingRolePermissions`, `selectedPermissions`, `updatingPermissions`
- The `fetchRolePermissions` and `handleSaveRolePermissions` functions
- The `DEFAULT_ROLE_PERMISSIONS` constant
- The `useEffect` that syncs `selectedPermissions` with `selectedRole`
- The `<Button>` that opens the dialog and the full `<Dialog>` JSX block for role permissions
- The `Shield` lucide-react import (if no longer used elsewhere in the file)

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/use-permission.ts apps/web/components/layout/app-shell.tsx apps/web/messages apps/web/app/(clinic)/clinic/staff/staff-client.tsx
git commit -m "feat(rbac): usePermission hook + Settings sub-menu with Roles & Permissions link"
```

---

## Task 4: New /clinic/settings/roles Page

**Files:**
- Create: `apps/web/app/(clinic)/clinic/settings/roles/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/settings/roles/roles-client.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
// apps/web/app/(clinic)/clinic/settings/roles/page.tsx
import type { Metadata } from 'next';
import RolesClient from './roles-client';

export const metadata: Metadata = { title: 'Roles & Permissions | Petiatrics' };

export default function RolesPage() {
  return <RolesClient />;
}
```

- [ ] **Step 2: Create roles-client.tsx**

Full client component with:
- Role selector dropdown (VET, ASSISTANT, CASHIER, STAFF, CLINIC_OWNER)
- Permission matrix grouped by: Patients, Visits & Vaccinations, Inventory, Billing, Settings
- Each permission card is a clickable checkbox with label + description
- "Custom Override Active" badge when clinic has a saved override for the selected role
- Sticky save bar at bottom with success feedback
- On mount: fetches GET /clinic/staff/role-permissions and populates checkboxes from saved overrides or defaults
- On save: calls PUT /clinic/staff/roles/:role/permissions

The `DEFAULT_ROLE_PERMISSIONS` constant in this file must mirror `DEFAULT_ROLE_PERMISSIONS` in `auth.service.ts`:
```typescript
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  CLINIC_OWNER: ['PATIENT:VIEW','PATIENT:EDIT','VISIT:VIEW','VISIT:ADD','VISIT:EDIT','VACCINATION:ADD','INVENTORY:VIEW','INVENTORY:ADD','INVENTORY:EDIT','INVENTORY:DELETE','BILLING:VIEW','BILLING:ADD','BILLING:EDIT','BILLING:VOID','SETTINGS:MANAGE'],
  VET: ['PATIENT:VIEW','PATIENT:EDIT','VISIT:VIEW','VISIT:ADD','VISIT:EDIT','VACCINATION:ADD','INVENTORY:VIEW'],
  ASSISTANT: ['PATIENT:VIEW','VISIT:VIEW','INVENTORY:VIEW','BILLING:VIEW'],
  STAFF: ['PATIENT:VIEW','INVENTORY:VIEW','BILLING:VIEW'],
  CASHIER: ['PATIENT:VIEW','BILLING:VIEW','BILLING:ADD','BILLING:EDIT','BILLING:VOID'],
};
```

The `PERMISSION_GROUPS` constant:
```typescript
const PERMISSION_GROUPS = [
  { title: 'Patients', permissions: [
    { id: 'PATIENT:VIEW', label: 'View Patients', desc: 'Search and read patient profiles.' },
    { id: 'PATIENT:EDIT', label: 'Add / Edit Patients', desc: 'Create and update patient records.' },
  ]},
  { title: 'Visits & Vaccinations', permissions: [
    { id: 'VISIT:VIEW', label: 'View Visits', desc: 'Read SOAP visit notes.' },
    { id: 'VISIT:ADD', label: 'Create Visits', desc: 'Open new visit/SOAP notes.' },
    { id: 'VISIT:EDIT', label: 'Edit Visits', desc: 'Update and finalize visit notes.' },
    { id: 'VACCINATION:ADD', label: 'Log Vaccinations', desc: 'Record vaccination events.' },
  ]},
  { title: 'Inventory', permissions: [
    { id: 'INVENTORY:VIEW', label: 'View Inventory', desc: 'View stock, products, and ledger.' },
    { id: 'INVENTORY:ADD', label: 'Add Stock', desc: 'Receive goods and post new movements.' },
    { id: 'INVENTORY:EDIT', label: 'Edit Products', desc: 'Update product details and adjustments.' },
    { id: 'INVENTORY:DELETE', label: 'Deactivate Items', desc: 'Deactivate products from active catalog.' },
  ]},
  { title: 'Billing', permissions: [
    { id: 'BILLING:VIEW', label: 'View Billing', desc: 'Read invoices and payment history.' },
    { id: 'BILLING:ADD', label: 'Create Invoices', desc: 'Create draft invoices.' },
    { id: 'BILLING:EDIT', label: 'Process Payments', desc: 'Mark invoices as issued or paid.' },
    { id: 'BILLING:VOID', label: 'Void Invoices', desc: 'Void an invoice (destructive).' },
  ]},
  { title: 'Settings', permissions: [
    { id: 'SETTINGS:MANAGE', label: 'Manage Settings', desc: 'Manage clinic settings and role permissions.' },
  ]},
];
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(clinic)/clinic/settings/roles
git commit -m "feat(rbac): dedicated /clinic/settings/roles Role Permission Matrix page"
```

---

## Task 5: Frontend — Action-Level Button Guards

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx`
- Modify: `apps/web/app/(clinic)/clinic/patients/patients-client.tsx`

- [ ] **Step 1: Guard Inventory action buttons**

In `inventory-client.tsx`, import `usePermission`:
```typescript
import { usePermission } from '@/lib/use-permission';
```

Add inside the component:
```typescript
const canAddInventory = usePermission('INVENTORY:ADD');
const canEditInventory = usePermission('INVENTORY:EDIT');
```

Wrap action buttons:
```tsx
{canAddInventory && (
  <Link href="/clinic/inventory/replenish" className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
    Replenish Stock
  </Link>
)}
{canEditInventory && (
  <button onClick={() => setImportOpen(true)} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
    Import CSV / XLSX
  </button>
)}
{canAddInventory && (
  <Link href="/clinic/inventory/products/new" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
    + Add Item
  </Link>
)}
```

Pass optional deactivate handler to ItemTable:
```tsx
<ItemTable
  items={filteredItems}
  lowStockIds={lowStockIds}
  onDeactivate={canEditInventory ? handleDeactivate : undefined}
/>
```

If ItemTable's `onDeactivate` prop is not yet optional, update its props type:
```typescript
// In components/inventory/item-table.tsx
interface Props {
  items: ItemSummaryResponse[];
  lowStockIds: Set<string>;
  onDeactivate?: (id: string) => void; // optional
}
// Then conditionally render the deactivate button: {onDeactivate && <button onClick={() => onDeactivate(item.id)}>Deactivate</button>}
```

- [ ] **Step 2: Guard Patient action buttons**

In `patients-client.tsx`, import and use:
```typescript
import { usePermission } from '@/lib/use-permission';
// ...
const canAddPatient = usePermission('PATIENT:EDIT');
// ...
{canAddPatient && <Button onClick={() => setShowAdd(true)}>+ Add Patient</Button>}
```

- [ ] **Step 3: Build and commit**

```bash
npx turbo run build --filter=@petiatrics/web
git add apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx apps/web/app/(clinic)/clinic/patients/patients-client.tsx
git commit -m "feat(rbac): action-level button guards using MODULE:ACTION permissions"
```

Expected: All 34+ routes compiled successfully.

---

## Verification Plan

### Automated Tests

```bash
npx turbo run test --filter=@petiatrics/api
```
Expected: 14 suites, 129+ tests, all passing.

### Manual Verification

1. **Settings sub-menu** — log in as CLINIC_OWNER. Confirm "Settings" expands to "General" and "Roles & Permissions".
2. **Roles page** — navigate to `/clinic/settings/roles`. Confirm role selector, permission groups, save bar render.
3. **VET permission gate** — select VET, uncheck INVENTORY:VIEW, save. Log in as VET, confirm Inventory sidebar items are hidden.
4. **Inventory ADD guard** — log in as ASSISTANT (no INVENTORY:ADD). Confirm "+ Add Item" and "Replenish Stock" are absent.
5. **Patient ADD guard** — log in as ASSISTANT (no PATIENT:EDIT). Confirm "+ Add Patient" button is hidden.
6. **SUPER_ADMIN bypass** — SUPER_ADMIN sees all buttons regardless of permissions.
