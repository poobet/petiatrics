# Dynamic Custom Roles & Permissions — Plan B: Frontend UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dynamic Role Settings matrix UI, migrate staff role dropdown to use API-fetched roles, update app navigation sidebar filtering to use permissions, and clean up the legacy static `Role` enum.

**Architecture:** App shell navigation filters based on `user.permissions` instead of static role list (short-circuiting for `CLINIC_OWNER` and `SUPER_ADMIN`). Staff invite dropdown gets its options from `GET /clinic/roles`. Role settings page fetches roles and pages, rendering a list on the left and a page-action permission checkbox grid on the right.

**Tech Stack:** React, Next.js, Tailwind CSS, shadcn/ui (Radix), TypeScript

**Design Spec:** `docs/superpowers/specs/2026-07-11-dynamic-roles-permissions-design.md`

---

### Task 1: Migrate App Shell Sidebar Navigation

**Files:**
- Modify: `apps/web/components/layout/app-shell.tsx`

- [ ] **Step 1: Update NAV_ITEMS required permissions and roles**

Open `apps/web/components/layout/app-shell.tsx`. Update the `NAV_ITEMS` definition:
- Replace static role lists with permissions where possible.
- Update `canAccess` function to handle `roleCode` / `systemRole` and bypass permissions checks for CLINIC_OWNER / SUPER_ADMIN.

```typescript
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/clinic/dashboard', icon: LayoutDashboard },
  { key: 'appointments', href: '/clinic/appointments', icon: Calendar },
  { key: 'patients', href: '/clinic/patients', icon: PawPrint, requiredPermission: 'PATIENT:VIEW' },
  { key: 'clients', href: '/clinic/clients', icon: Users, requiredPermission: 'PATIENT:VIEW' },
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
  {
    key: 'staff',
    href: '/clinic/staff',
    icon: UserCog,
    requiredPermission: 'SETTINGS:MANAGE',
  },
  {
    key: 'businessPartners',
    href: '/clinic/business-partners',
    icon: Briefcase,
    // Accessible by anyone with a clinic profile (checked via no requiredPermission)
  },
  {
    key: 'audit',
    href: '/clinic/audit',
    icon: ClipboardList,
    requiredPermission: 'SETTINGS:MANAGE',
  },
  {
    key: 'settings',
    icon: Settings,
    subItems: [
      { key: 'settingsGeneral', href: '/clinic/settings', icon: Settings },
      {
        key: 'rolePermissions',
        href: '/clinic/settings/roles',
        icon: Shield,
        requiredPermission: 'SETTINGS:MANAGE',
      },
      {
        key: 'documentSequence',
        href: '/clinic/settings/document-sequence',
        icon: ClipboardList,
        requiredPermission: 'SETTINGS:MANAGE',
      },
    ],
  },
];
```

- [ ] **Step 2: Update `canAccess` implementation**

Replace the `canAccess` function (around line 159):

```typescript
  function canAccess(item: NavItem | SubNavItem): boolean {
    const isSuperAdmin = user.systemRole === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN';
    const isClinicOwner = user.roleCode === 'CLINIC_OWNER' || user.role === 'CLINIC_OWNER';

    // SUPER_ADMIN and CLINIC_OWNER bypass all menu restrictions
    if (isSuperAdmin || isClinicOwner) {
      return true;
    }

    // Role-based filtering fallback (if roles field is specified)
    if ('roles' in item && item.roles) {
      const activeRoleCode = user.roleCode ?? user.role;
      if (!item.roles.includes(activeRoleCode)) {
        return false;
      }
    }

    // Permission-based filtering
    if (item.requiredPermission) {
      const userPermissions = user.permissions || [];
      if (!userPermissions.includes(item.requiredPermission)) {
        return false;
      }
    }

    return true;
  }
```

- [ ] **Step 3: Build check**

Verify type safety of `app-shell.tsx`:
```bash
cd apps/web
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/app-shell.tsx
git commit -m "feat(web): update navigation filtering to check dynamic permissions in AppShell"
```

---

### Task 2: Populate Staff Role Select Dropdown Dynamically

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/staff/staff-client.tsx`

- [ ] **Step 1: Fetch roles list from API**

Open `apps/web/app/(clinic)/clinic/staff/staff-client.tsx`. Update the imports, component state, and fetch hook to load roles from `GET /api/v1/clinic/roles` inside a `useEffect` block.

```typescript
// Replace the hardcoded SELECT role list with dynamic roles:
const [roles, setRoles] = useState<{ id: string; code: string; name: string }[]>([]);

useEffect(() => {
  async function fetchRoles() {
    try {
      const res = await fetch('/api/v1/clinic/roles');
      if (res.ok) {
        const body = await res.json();
        if (body.data) setRoles(body.data);
      }
    } catch (err) {
      console.error('Failed to load clinic roles:', err);
    }
  }
  fetchRoles();
}, []);
```

- [ ] **Step 2: Update Select item mapping in Staff Modal**

Find where the Select input for role is rendered. Replace the hardcoded options with a loop over `roles`:

```typescript
<SelectContent>
  {roles.map((r) => (
    <SelectItem key={r.id} value={r.id}>
      {r.name}
    </SelectItem>
  ))}
</SelectContent>
```

- [ ] **Step 3: Update `updateRole` method**

Ensure role updates pass the `roleId` instead of legacy role enum strings.

- [ ] **Step 4: Build check**

Verify compilation:
```bash
cd apps/web
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(clinic)/clinic/staff/staff-client.tsx
git commit -m "feat(web): fetch and display staff roles dynamically from roles API"
```

---

### Task 3: Build Role Settings Matrix UI

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/settings/roles/roles-client.tsx`

- [ ] **Step 1: Replace static client with dynamic matrix editor**

Open `apps/web/app/(clinic)/clinic/settings/roles/roles-client.tsx` and write a fully-featured interface with a role selector list (left panel) and permission checkbox grid (right panel).

Features:
- Left panel shows all active roles, with lock icon for system-level roles (e.g. CLINIC_OWNER).
- Right panel renders a table of PageMasters (rows) and ActionMasters (columns).
- Checking a box puts/patches the permission list via `PUT /api/v1/clinic/roles/:id/permissions`.
- Creation of roles via Modal prompting for role name (`POST /api/v1/clinic/roles`).
- Deletion of roles (`DELETE /api/v1/clinic/roles/:id`) with 400 error toast handler if active users are assigned.

- [ ] **Step 2: Build check**

Verify compilation of Next.js web application.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(clinic)/clinic/settings/roles/roles-client.tsx
git commit -m "feat(web): build full role and page-action permissions grid editor UI"
```

---

### Task 4: Legacy Role Enum Cleanup

**Files:**
- Modify: `packages/types/src/enums.ts`
- Modify: `apps/api/src/modules/identity/services/user.service.ts`

- [ ] **Step 1: Check legacy Role enum references in backend**

Review and replace any remaining `Role.X` enum values in user creation logic. In `user.service.ts`, ensure created staff users are associated with the `roleId` corresponding to the custom role code instead of static checks.

- [ ] **Step 2: Remove `Role` enum from `packages/types/src/enums.ts`**

Once clean, completely remove `export enum Role { ... }` from enums.ts to prevent future static usage.

- [ ] **Step 3: Build & Final Verification**

```bash
npm run build
npm run test
npm run test:e2e
```

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/enums.ts apps/api/src/modules/identity/services/user.service.ts
git commit -m "cleanup: remove legacy static Role enum and finalize custom dynamic roles migration"
```
