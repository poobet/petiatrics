# Design Specification: Dynamic, UI-Configurable Permissions Matrix

This specification details the architecture and implementation design for introducing dynamic, granular permissions for clinic staff members in Petiatrics.

---

## 1. Database Schema changes (Postgres)

We will add a native string array (`permissions String[]`) directly to the `User` model in `schema.prisma`. 

```prisma
model User {
  id                  String     @id @default(uuid())
  clinicId            String?
  name                String     @default("")
  email               String?    @unique
  username            String?    @unique
  passwordHash        String
  role                Role
  status              UserStatus @default(PENDING)
  mustChangePassword  Boolean    @default(false)
  invitedBy           String?
  failedLoginAttempts Int        @default(0)
  lockedUntil         DateTime?
  preferredLocale     Locale     @default(TH)
  permissions         String[]   // <-- Granular permissions
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt
  
  clinic              Clinic?          @relation(fields: [clinicId], references: [id])
  businessPartners    BusinessPartner[]
  userBranches        UserBranch[]
  // ... other relations
}
```

### Base Permissions List
*   `VIEW_PATIENTS`: Access to search, view, and read patient profiles and records.
*   `EDIT_PATIENTS`: Create, update, and delete patient profiles.
*   `MANAGE_VISITS`: Create, update, and finalize SOAP visits and prescriptions.
*   `MANAGE_VACCINATIONS`: Administer and log vaccinations.
*   `VIEW_INVENTORY`: View stock balances, product catalog, and ledger.
*   `MANAGE_INVENTORY`: Perform stock adjustments, goods receipt, and write-offs.
*   `VIEW_BILLING`: Read invoices, payment history, and financial logs.
*   `MANAGE_BILLING`: Create, record payments, and void invoices.
*   `MANAGE_SETTINGS`: Manage clinic-wide settings, branches, and staff permission matrices.

---

## 2. Session Context & Authentication

We will extend `UserContext` and `AuthProfile` types in `packages/types/src/api.ts` to include `permissions: string[]`.

### Login Flow Update
1. Resolve the user from database during login.
2. If `user.permissions` is empty, fallback to the default role mappings:
   * `CLINIC_OWNER` / `SUPER_ADMIN` -> All system permissions.
   * `VET` -> `['VIEW_PATIENTS', 'EDIT_PATIENTS', 'MANAGE_VISITS', 'MANAGE_VACCINATIONS', 'VIEW_INVENTORY']`
   * `ASSISTANT` / `STAFF` -> `['VIEW_PATIENTS', 'VIEW_INVENTORY', 'VIEW_BILLING']`
   * `CASHIER` -> `['VIEW_PATIENTS', 'VIEW_INVENTORY', 'VIEW_BILLING', 'MANAGE_BILLING']`
3. Store the active permissions array inside the Redis session store (`UserContext`).

---

## 3. Backend Security guards (NestJS)

1.  **`@Permissions(...permissions: string[])` Decorator**: Set metadata for route handlers.
2.  **`PermissionsGuard`**: Extends NestJS `CanActivate` check. It extracts permissions metadata, checks if the session `user.permissions` contains the required permission, and allows/rejects access.
3.  **Controller Annotation**: Apply `@Permissions()` on all clinic/management controllers in `apps/api/src/modules/`.
4.  **Staff Permissions Update Endpoint**:
    *   `PUT /clinic/staff/:id/permissions`
    *   Allows clinic owners or users with `MANAGE_SETTINGS` to modify staff permission overrides.

---

## 4. Frontend Sidebar & Matrix UI (Next.js)

1.  **Sidebar Filtering**:
    *   Update `NAV_ITEMS` in `app-shell.tsx` with a `requiredPermission` key.
    *   Filter top-level and nested navigation options using `user.permissions`.
2.  **Staff Permissions Matrix UI**:
    *   Add "Edit Permissions" to the staff row dropdown.
    *   Open a popup Dialog with checkbox groups for Clinical, Inventory, and Billing permissions.
    *   Submit updates via the `PUT /api/v1/clinic/staff/:id/permissions` endpoint.
