# Design Specification: Patient Detail Access Control and Clinic Routing

This document defines the design for opening patient detail, visit records, and vaccination endpoints to clinic staff roles (`Role.STAFF`, `Role.ASSISTANT`, `Role.CASHIER`) and pet owners (`Role.CUSTOMER`), while securing B2C customer access so they can only access their own pets. It also addresses the routing bug where frontend links are incorrectly formatted as `/patients/[id]` instead of `/clinic/patients/[id]`.

## Goal

1. **Clinic Staff Access**: Allow clinic staff (`STAFF`, `ASSISTANT`, `CASHIER`) with appropriate permissions (e.g. `PATIENT:VIEW`, `VISIT:VIEW`) to view patient details and medical records.
2. **B2C Customer Guarding**: Allow `CUSTOMER` role to access `/patients/:id` and clinical records, but restrict their view *strictly* to pets they own (`pet.ownerUserId === user.userId`).
3. **Frontend Routing Fix**: Replace all broken links in the web application pointing to `/patients/[id]` (which causes a 404 in Next.js) with `/clinic/patients/[id]`.

---

## 1. Backend Authentication & Guard Updates

### 1.1 Tenant ID Decorator (`tenant.decorator.ts`)
Update the `TenantId` decorator to allow null values for `Role.CUSTOMER` users, as customer sessions are not strictly bound to a single clinic tenant:
```typescript
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request & { userContext?: UserContext }>();
    const clinicId = request.userContext?.clinicId;
    if (!clinicId && request.userContext?.role !== Role.CUSTOMER) {
      throw new Error('TenantId decorator used on a route without a session context.');
    }
    return clinicId ?? null;
  },
);
```

### 1.2 Permissions Guard (`permissions.guard.ts`)
Since B2C customers do not have global permissions (empty `permissions` array), we update the `PermissionsGuard` to allow `CUSTOMER` users to bypass read-only permission checks (ending with `:VIEW`). The controller handlers will then enforce strict ownership checking:
```typescript
if (userContext.role === Role.CUSTOMER) {
  const isReadOnly = requiredPermissions.every(perm => perm.endsWith(':VIEW'));
  if (isReadOnly) {
    return true;
  }
}
```

---

## 2. Controller & Service Access Control

### 2.1 Patient Controller (`patient.controller.ts`)
* Add `ASSISTANT`, `CASHIER`, `STAFF`, and `CUSTOMER` roles to `@Roles()`:
  ```typescript
  @Controller('patients')
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.ASSISTANT, Role.CASHIER, Role.STAFF, Role.CUSTOMER)
  ```
* Enforce ownership check in `findOne`:
  If `user.role === Role.CUSTOMER`, fetch the pet using `findByIdCrossClinic(id)`. If `pet.ownerUserId !== user.userId`, throw a `ForbiddenException`.
  Otherwise, staff members fetch using `findById(clinicId, id)`.
* Enforce customer scoping in `findAll`:
  If `user.role === Role.CUSTOMER`, resolve customer's `clinicIds` from `BusinessPartner` database linkages, and return `findAllByOwnerCrossClinic(clinicIds, user.userId)`.
  Otherwise, return staff-level `findAll(clinicId, search, ownerUserId)`.

### 2.2 Vaccination Controller (`vaccination.controller.ts`)
* Allow all staff and customer roles at class-level `@Roles()`.
* Enforce ownership checks in read endpoints:
  - `list`: If `CUSTOMER`, verify ownership of `patientId` via `patientService.findByIdCrossClinic`. Throw `ForbiddenException` if not matching.
  - `getOne`: If `CUSTOMER`, fetch the record, retrieve the associated pet profile, and verify that `pet.ownerUserId === user.userId`.

### 2.3 Visit Controller (`visit.controller.ts`)
* Allow all staff and customer roles at class-level `@Roles()`.
* Enforce ownership checks in read endpoints:
  - `list`: If `CUSTOMER`, verify ownership of `patientId`.
  - `getOne`: If `CUSTOMER`, fetch visit, fetch associated pet profile, verify ownership.

### 2.4 Service Extensions (`vaccination.service.ts` & `visit.service.ts`)
Add cross-clinic query methods to fetch documents by MongoDB `_id` without requiring `clinicId`:
* `VaccinationService.getOneCrossClinic(id)`
* `VisitService.getOneCrossClinic(visitId)`

---

## 3. Frontend Link Routing Fixes

Update the web application client components to direct routing links properly under `/clinic/patients/...`:

1. **`patients-client.tsx`**
   * Change redirect link: `/patients/${p._id}` -> `/clinic/patients/${p._id}`
2. **`patient-profile-client.tsx`**
   * Change "New Visit" link: `/patients/${patient._id}/visits/new` -> `/clinic/patients/${patient._id}/visits/new`
   * Change visit list links: `/patients/${patient._id}/visits/${v._id}` -> `/clinic/patients/${patient._id}/visits/${v._id}`
3. **`visits/new/page.tsx`**
   * Change routing path upon creation: `/patients/${patientId}/visits/${visit._id}` -> `/clinic/patients/${patientId}/visits/${visit._id}`
   * Change cancel button path: `/patients/${patientId}` -> `/clinic/patients/${patientId}`
4. **`visit-detail-client.tsx`**
   * Change back-link path: `/patients/${patientId}` -> `/clinic/patients/${patientId}`
5. **`client-detail-client.tsx`**
   * Change pet name link: `/patients/${pet._id}` -> `/clinic/patients/${pet._id}`

---

## 4. Verification Plan

### 4.1 Automated API Tests
Create unit/integration test assertions verifying:
1. Staff members (`Role.STAFF`) can successfully fetch patient profiles (`GET /patients/:id`).
2. Customers (`Role.CUSTOMER`) can fetch their own pet profiles (`GET /patients/:id`).
3. Customers (`Role.CUSTOMER`) receive a `403 Forbidden` if fetching a pet profile belonging to another user.
4. Clinic staff role checks work as expected.

### 4.2 Manual / Browser Verification
1. Log in as clinic owner (`owner@happypaws.io`) and check navigation to `/clinic/patients` and click any patient. Ensure the page URL is `/clinic/patients/[id]` and loads successfully.
2. Log in as a customer role, navigate to their B2C pets view `/my/pets/[id]`, and confirm that the API requests return status `200 OK`.
3. Try to access `/clinic/patients/[id]` as a customer to verify that Next.js middleware redirects to `/my`.
