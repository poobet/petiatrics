# Design Specification: Dynamic Custom Roles & Page-Action Permissions

**Date:** 2026-07-11  
**Status:** Draft  
**Scope:** Full-stack — Prisma DB schema, TypeScript types, NestJS backend guards, Next.js frontend

---

## 1. Background & Motivation

The current system uses a static `Role` enum (`CLINIC_OWNER`, `VET`, `CASHIER`, `STAFF`, `ASSISTANT`, `CUSTOMER`, `SUPER_ADMIN`) baked into Prisma, TypeScript types, NestJS decorators, and Next.js navigation. This prevents clinics from creating their own job-specific roles (e.g., "Senior Nurse", "Lab Technician", "Intern") and assigning granular page/action-level access.

### Goals
- Allow each clinic to define its own set of named roles
- Each role maps to a set of `(Page, Action)` permissions stored in the database
- `CLINIC_OWNER` role is immutable, undeletable, and always has full access (enforced at code level, not UI)
- A role that has active users assigned cannot be deleted (block-on-delete)
- `SUPER_ADMIN` and `CUSTOMER` remain as system-level roles outside the clinic role system

---

## 2. Decision Record

| Question | Decision |
|---|---|
| Page/Action master stored where? | In the database (`PageMaster` + `ActionMaster` tables), seeded by system |
| Role system approach | Fully dynamic — `ClinicRole` table replaces `Role` enum for clinic staff |
| Clinic Owner lock | `isSystem=true`, `isDeletable=false`, always full-access enforced in code |
| Delete role with active users | Blocked — 400 error until all users are reassigned |
| Permission storage model | Fully normalized junction table (`ClinicRolePermission`) |

---

## 3. Database Schema Changes

### 3.1 New Tables

#### `PageMaster` — System-seeded page registry
```prisma
model PageMaster {
  id          String         @id @default(uuid())
  code        String         @unique  // e.g. "PATIENTS", "INVENTORY", "BILLING"
  name        String                  // Human label e.g. "Patients"
  description String?
  sortOrder   Int            @default(0)
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  actions     ActionMaster[]
  permissions ClinicRolePermission[]

  @@map("page_masters")
}
```

#### `ActionMaster` — System-seeded action registry
```prisma
model ActionMaster {
  id          String         @id @default(uuid())
  pageId      String
  code        String         @unique  // e.g. "PATIENT:VIEW", "INVENTORY:ADD"
  name        String                  // Human label e.g. "View Patients"
  description String?
  sortOrder   Int            @default(0)
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  page        PageMaster     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  permissions ClinicRolePermission[]

  @@index([pageId])
  @@map("action_masters")
}
```

#### `ClinicRole` — Clinic-scoped custom roles
```prisma
model ClinicRole {
  id          String   @id @default(uuid())
  clinicId    String?  // null = system-level (SUPER_ADMIN, CUSTOMER)
  code        String   // e.g. "CLINIC_OWNER", "VET", "CUSTOM_NURSE"
  name        String   // Display name e.g. "Head Nurse"
  isSystem    Boolean  @default(false)   // true = seeded by system, code is reserved
  isDeletable Boolean  @default(true)    // false = cannot be deleted (CLINIC_OWNER)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  clinic      Clinic?  @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  users       User[]   @relation("UserClinicRole")
  permissions ClinicRolePermission[]

  @@unique([clinicId, code])
  @@index([clinicId])
  @@map("clinic_roles")
}
```

#### `ClinicRolePermission` — Junction table: Role x Page x Action
```prisma
model ClinicRolePermission {
  id        String        @id @default(uuid())
  roleId    String
  pageId    String
  actionId  String?       // null = page-view access only (no specific action)
  createdAt DateTime      @default(now())

  role      ClinicRole    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  page      PageMaster    @relation(fields: [pageId], references: [id], onDelete: Cascade)
  action    ActionMaster? @relation(fields: [actionId], references: [id], onDelete: SetNull)

  @@unique([roleId, pageId, actionId])
  @@index([roleId])
  @@index([pageId])
  @@index([actionId])
  @@map("clinic_role_permissions")
}
```

### 3.2 Modified Tables

#### `User` — Replace `role` enum with `roleId` FK

```prisma
// BEFORE
model User {
  role Role
}

// AFTER
model User {
  roleId     String
  systemRole String? // "SUPER_ADMIN" | "CUSTOMER" | null (for clinic staff)
  role       ClinicRole @relation("UserClinicRole", fields: [roleId], references: [id])
}
```

`systemRole` is a plain `String?` field (not Prisma enum) to support two system-level identity checks (`SUPER_ADMIN` can access all clinics, `CUSTOMER` is blocked from staff routes) without being scoped to a clinic. Clinic staff will have `systemRole = null`.

### 3.3 Remove Prisma `enum Role`
The Prisma `enum Role` is **removed** from `schema.prisma`. System-level access is handled via `User.systemRole` field.

---

## 4. Seed Data — PageMaster & ActionMaster

These records are seeded by the system and are not editable by clinics:

| Page Code | Page Name | Action Codes |
|---|---|---|
| `PATIENTS` | Patients | `PATIENT:VIEW`, `PATIENT:EDIT` |
| `VISITS` | Visits & Vaccinations | `VISIT:VIEW`, `VISIT:ADD`, `VISIT:EDIT`, `VACCINATION:ADD` |
| `INVENTORY` | Inventory | `INVENTORY:VIEW`, `INVENTORY:ADD`, `INVENTORY:EDIT`, `INVENTORY:DELETE` |
| `BILLING` | Billing | `BILLING:VIEW`, `BILLING:ADD`, `BILLING:EDIT`, `BILLING:VOID` |
| `PROCUREMENT` | Procurement | `PROCUREMENT:VIEW`, `PROCUREMENT:CREATE_PO`, `PROCUREMENT:APPROVE_PO`, `PROCUREMENT:CREATE_GR` |
| `SETTINGS` | Settings | `SETTINGS:MANAGE` |

### System Roles Seeded Per Clinic (on clinic creation)

| Role Code | isDeletable | isSystem | Default Permissions |
|---|---|---|---|
| `CLINIC_OWNER` | **false** | true | ALL (bypassed in code) |
| `VET` | true | true | PATIENTS all, VISITS all, INVENTORY:VIEW |
| `CASHIER` | true | true | PATIENTS:VIEW, BILLING all |
| `STAFF` | true | true | PATIENTS:VIEW, INVENTORY:VIEW, BILLING:VIEW |
| `ASSISTANT` | true | true | PATIENTS:VIEW, VISITS:VIEW, INVENTORY:VIEW |

---

## 5. TypeScript Types (`packages/types`)

### 5.1 `enums.ts` — Remove `Role` enum, add system role constants
```typescript
// Remove Role enum entirely.
// Replace with:

export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;
export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

// Reserved role codes that clinics cannot delete or rename
export const SYSTEM_ROLE_CODES = [
  'CLINIC_OWNER', 'VET', 'CASHIER', 'STAFF', 'ASSISTANT',
] as const;
```

### 5.2 `api.ts` — Update `UserContext` & `AuthProfile`
```typescript
export interface UserContext {
  userId: string;
  clinicId: string | null;
  clinicName: string | null;
  clinicSlug: string | null;
  roleId: string;            // FK to ClinicRole.id
  roleCode: string;          // e.g. "CLINIC_OWNER", "VET", "CUSTOM_NURSE"
  roleName: string;          // Display name e.g. "Head Nurse"
  systemRole: string | null; // "SUPER_ADMIN" | "CUSTOMER" | null
  permissions: string[];     // action codes e.g. ["PATIENT:VIEW", "INVENTORY:ADD"]
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  preferredLocale: Locale;
  authorizedBranches: BranchSummary[];
  businessPartnerId?: string | null;
  currencyCode?: string | null;
  issuedAt?: number;
}

export interface AuthProfile {
  id: string;
  name?: string;
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  roleId: string;
  roleCode: string;
  roleName: string;
  systemRole: string | null;
  permissions: string[];
  clinicName: string | null;
  clinicSlug?: string | null;
  branches: BranchSummary[];
  preferredLocale: Locale;
  businessPartnerId?: string | null;
  currencyCode?: string | null;
}
```

### 5.3 `permissions.ts` — Add Procurement permissions
```typescript
export const PERMISSIONS = {
  // ... existing permissions ...
  PROCUREMENT_VIEW: 'PROCUREMENT:VIEW',
  PROCUREMENT_CREATE_PO: 'PROCUREMENT:CREATE_PO',
  PROCUREMENT_APPROVE_PO: 'PROCUREMENT:APPROVE_PO',
  PROCUREMENT_CREATE_GR: 'PROCUREMENT:CREATE_GR',
} as const;
```

---

## 6. Backend (NestJS) Changes

### 6.1 Auth Service — Permission Resolution at Login
```
Login flow:
1. Find User, join ClinicRole (with permissions)
2. IF user.systemRole === 'SUPER_ADMIN':
     permissions = ALL action codes (loaded from ActionMaster at startup)
3. ELSE IF user.roleCode === 'CLINIC_OWNER':
     permissions = ALL action codes for that clinic
4. ELSE:
     Load ClinicRolePermission where roleId = user.roleId
     Collect ActionMaster.code for each permission row
5. Store { roleId, roleCode, roleName, systemRole, permissions } in Redis session
```

### 6.2 Guard Migration: `@Roles()` → `@Permissions()`

All `@Roles()` decorators across all controllers are replaced with `@Permissions()`:

```typescript
// BEFORE
@Roles(Role.CLINIC_OWNER, Role.VET)
@Get()
listProducts() {}

// AFTER
@Permissions('INVENTORY:VIEW')
@Get()
listProducts() {}
```

Two guards replace the old `RolesGuard`:
- **`SystemRoleGuard`** — runs first; short-circuits for `SUPER_ADMIN` (bypass all) and blocks `CUSTOMER` from clinic routes
- **`PermissionsGuard`** — checks `user.permissions[]` against required permission from `@Permissions()` metadata

### 6.3 CLINIC_OWNER bypass
In `PermissionsGuard`:
```typescript
if (user.roleCode === 'CLINIC_OWNER') return true; // full access
```

### 6.4 New Role Management Endpoints

All routes require `SETTINGS:MANAGE` permission.

| Method | Path | Description |
|---|---|---|
| `GET` | `/clinic/roles` | List clinic's roles |
| `POST` | `/clinic/roles` | Create custom role |
| `PATCH` | `/clinic/roles/:id` | Rename role |
| `DELETE` | `/clinic/roles/:id` | Delete (block if users exist or isDeletable=false) |
| `GET` | `/clinic/roles/:id/permissions` | Get role's permissions |
| `PUT` | `/clinic/roles/:id/permissions` | Replace full permission set |
| `GET` | `/clinic/pages` | List PageMaster + ActionMaster (for UI) |

### 6.5 Delete Safety Check (Service Layer)
```typescript
async deleteRole(clinicId: string, roleId: string) {
  const role = await prisma.clinicRole.findFirst({
    where: { id: roleId, clinicId },
  });
  if (!role) throw new NotFoundException();
  if (!role.isDeletable) {
    throw new BadRequestException('System roles cannot be deleted.');
  }
  const userCount = await prisma.user.count({ where: { roleId } });
  if (userCount > 0) {
    throw new BadRequestException(
      `Cannot delete: ${userCount} user(s) still assigned. Reassign them first.`
    );
  }
  await prisma.clinicRole.delete({ where: { id: roleId } });
}
```

---

## 7. Frontend (Next.js) Changes

### 7.1 Sidebar Navigation — Permission-based filtering
```typescript
// BEFORE
{ label: 'Settings', roles: ['CLINIC_OWNER', 'SUPER_ADMIN'] }

// AFTER  
{ label: 'Settings', requiredPermission: 'SETTINGS:MANAGE' }
```

`app-shell.tsx` filters nav items by checking `user.permissions.includes(item.requiredPermission)`. SUPER_ADMIN and CLINIC_OWNER always pass (checked via `user.systemRole` or `user.roleCode`).

### 7.2 Roles Settings Page — Full CRUD UI
Route: `/clinic/settings/roles`

- **Left panel:** Scrollable list of roles. System roles show a 🔒 icon. "Create Role" button at bottom.
- **Right panel:** Permission matrix table — rows = Pages, columns = Actions (checkboxes).
- Checking/unchecking rebuilds the permissions array and sends `PUT /clinic/roles/:id/permissions`.
- **Delete Role:** Confirmation dialog. Error toast if users still assigned.
- **Create Role:** Modal with role name input → creates via `POST /clinic/roles` → selects new role in left panel.

### 7.3 Staff Form — Dynamic Role Dropdown
Staff invite and edit forms fetch roles from `GET /clinic/roles` to populate the role `<Select>` instead of using hardcoded enum values.

---

## 8. Migration Strategy

> [!IMPORTANT]
> `Role` enum is referenced in 40+ files across the codebase. This must be a carefully staged migration — do NOT attempt all changes in one commit.

### Phase 1 — Database (Non-breaking)
1. Add `PageMaster`, `ActionMaster`, `ClinicRole`, `ClinicRolePermission` tables
2. Add `User.roleId` (nullable) and `User.systemRole` columns
3. Run seed migration: populate PageMaster/ActionMaster, create ClinicRole per clinic, set `User.roleId` from current `User.role` enum value
4. Make `User.roleId` non-nullable
5. Drop old `User.role` enum column
6. Drop Prisma `enum Role`

### Phase 2 — Backend (Breaking but contained)
1. Update `AuthService` login flow
2. Add `SystemRoleGuard` and new `PermissionsGuard`
3. Replace all `@Roles()` with `@Permissions()` across controllers
4. Add role management CRUD module + endpoints
5. Update `packages/types` (remove `Role` enum, update `UserContext`)

### Phase 3 — Frontend
1. Update all `user.role` references in `apps/web` to `user.roleCode` / `user.systemRole`
2. Migrate sidebar nav filtering
3. Replace roles settings page with dynamic CRUD UI
4. Update staff form role dropdown

### Phase 4 — Cleanup
1. Remove `Role` enum from `packages/types/src/enums.ts`
2. Update E2E tests
3. Remove `ClinicRolePermission` table (old one from current schema)

---

## 9. Data Integrity Rules

1. `ClinicRole.isDeletable = false` cannot be deleted via API (checked in service)
2. Roles with active users cannot be deleted (checked in service)
3. `systemRole === 'SUPER_ADMIN'` bypasses all permission checks
4. `roleCode === 'CLINIC_OWNER'` bypasses all clinic permission checks
5. `systemRole === 'CUSTOMER'` is blocked from all `/clinic/*` routes
6. Deleting an `ActionMaster` cascades to `ClinicRolePermission` (DB-level)
7. Deleting a `ClinicRole` cascades to `ClinicRolePermission` (DB-level)

---

## 10. Verification Plan

### Automated Tests
```bash
npm run test --workspace=apps/api       # Unit + integration tests
npm run test:e2e --workspace=apps/web   # Playwright E2E tests
```

### Manual Verification Checklist
- [ ] Login as `CLINIC_OWNER` → all pages accessible, no 403 errors
- [ ] Create custom role "Intern" → assign only `PATIENT:VIEW`
- [ ] Invite user with "Intern" role → login → verify only Patients page visible
- [ ] Verify Edit/Delete buttons hidden from "Intern" user
- [ ] Try to delete "Intern" role while user assigned → verify 400 error with user count
- [ ] Reassign user → delete "Intern" role → verify success
- [ ] Try to delete "Clinic Owner" role → verify 400 error (isDeletable=false)
- [ ] Login as `SUPER_ADMIN` → verify access to all clinic pages
