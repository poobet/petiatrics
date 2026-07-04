# Implementation Plan: BP–Staff–Client Linkage

**Date:** 2026-07-04  
**Scope:** Connect Business Partners, Staff (Users), and Clients so each domain navigates to the others.

---

## 1. Current State Analysis

### Schema (what exists)
| Table | Key field | Current state |
|---|---|---|
| `business_partners` | `linkedUserId` (nullable FK → `users`) | Only populated for CUSTOMER BPs auto-created on client registration |
| `business_partners` | `type` (BpType: CUSTOMER/STAFF/VET/SUPPLIER/OTHER) | STAFF and VET values exist but are **never written** |
| `users` | `businessPartners[]` | Relation exists; CUSTOMER users always have 1 BP; Staff users have **zero** BPs |
| `bp_vets` | extension table for VET BPs | Schema exists, never populated |

### Flow gaps
1. **`createStaff()`** creates a `User` but **no** corresponding `BusinessPartner`.  
   → VET/STAFF roles cannot appear in BP list; have no BP code; no AR/AP roles.
2. **Staff page** (`/clinic/staff`) shows raw `User` rows — no BP code, no link to BP detail.
3. **BP page** (`/clinic/business-partners`) for CUSTOMER BPs: no link back to the Client detail page.
4. **BP page** for STAFF/VET BPs: cannot exist yet (never created).
5. **Client detail** page shows `bp.code` and contact fields — but no "View BP" link to the full BP form.
6. **`findByClinic`** (staff list API) does not include `businessPartners` in the select.

---

## 2. Target State

```
User (role=VET)        ←→  BusinessPartner (type=VET,  linkedUserId=user.id)
User (role=STAFF/…)    ←→  BusinessPartner (type=STAFF, linkedUserId=user.id)
User (role=CUSTOMER)   ←→  BusinessPartner (type=CUSTOMER, linkedUserId=user.id)  ← already works
```

Navigation cross-links:
- Staff list row → **BP code badge** (links to `/clinic/business-partners/{bpId}`)
- BP detail (STAFF/VET/CUSTOMER type) → **"View Staff"** or **"View Client"** button
- Client detail → **"View Business Partner"** button (links to `/clinic/business-partners/{bpId}`)

---

## 3. Work Packages

### WP-1 · Database — seed Staff & Vet BP Groups (if missing)

**File:** `packages/database/prisma/seed.ts` (or a new migration)

Add two `BpGroup` rows if not present:
```
prefix: 'S-'  name: 'Staff'     (for role STAFF/ASSISTANT/CASHIER)
prefix: 'V-'  name: 'Vet'       (for role VET)
```

These are seeded per-clinic at clinic creation time or as part of the DB seed script.  
**Acceptance:** Running `db:seed` idempotently creates both groups for each clinic.

---

### WP-2 · Backend — auto-create BP on staff creation

**File:** `apps/api/src/modules/identity/services/user.service.ts`

#### 2a. New private helper `createStaffBpWithCode(tx, userId, clinicId, name, role)`

```typescript
private async createStaffBpWithCode(
  tx: PrismaTransactionClient,
  userId: string,
  clinicId: string,
  name: string,
  role: Role,
): Promise<any>
```

Logic:
- Map `Role.VET` → `BpType.VET`, prefix `'V-'`; all others → `BpType.STAFF`, prefix `'S-'`
- Find BpGroup by `{ clinicId, prefix }` (same locking pattern as `createCustomerBpWithCode`)
- If VET: also create a `bp_vets` row (`bpId`, licenseNumber blank initially)
- Return the created BP

#### 2b. Wire into `createStaff()`

Inside the existing `$transaction` block, after creating the User:
```typescript
// existing code already does this for CUSTOMER; add for staff roles:
if (input.role !== Role.CUSTOMER) {
  await this.createStaffBpWithCode(tx, u.id, input.clinicId, input.name, input.role);
}
```

#### 2c. Update `findByClinic()` to include BP

```typescript
async findByClinic(clinicId: string) {
  return this.prisma.user.findMany({
    where: { clinicId, role: { not: Role.CUSTOMER as any } },
    include: {
      businessPartners: {
        where: { clinicId },
        select: { id: true, code: true, type: true, isActive: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}
```

**Acceptance tests (existing spec file):**
- `createStaff` with role VET → user has 1 BP of type VET in same transaction
- `createStaff` with role ASSISTANT → user has 1 BP of type STAFF
- `findByClinic` response includes `businessPartners` array

---

### WP-3 · Backend — back-fill existing staff without BPs

**File:** `packages/database/prisma/seed.ts` or a one-off migration script

A script that:
1. Finds all staff Users (role ≠ CUSTOMER) with zero linked BPs
2. For each, creates a BP (type=VET or STAFF) with `linkedUserId=user.id`, no code (groups may not exist)

This is a safe idempotent back-fill (skips any user that already has a BP).

---

### WP-4 · Backend — BP detail includes linked user summary

**File:** `apps/api/src/modules/identity/services/business-partner.service.ts`

In `findByIdForManagement()`, add `user` to the include:
```typescript
user: {
  select: { id: true, name: true, email: true, username: true, role: true, status: true },
},
```

Update `mapBpToResponse()` to include:
```typescript
linkedUser: bp.user
  ? { id: bp.user.id, name: bp.user.name, role: bp.user.role, status: bp.user.status }
  : null,
```

Update `BusinessPartnerResponse` type in `packages/types/src/` to add `linkedUser` field.

---

### WP-5 · Frontend — Staff page shows BP code

**File:** `apps/web/app/(clinic)/clinic/staff/staff-client.tsx`

1. Extend `StaffUser` interface:
```typescript
interface StaffUser {
  // ... existing fields
  businessPartners?: Array<{ id: string; code: string | null; type: string }>;
}
```

2. Add **BP Code** column to the staff table:
```tsx
<TableHead>BP Code</TableHead>
// ...
<TableCell>
  {bp ? (
    <Link href={`/clinic/business-partners/${bp.id}`} className="text-primary hover:underline font-mono text-xs">
      {bp.code ?? 'View BP'}
    </Link>
  ) : (
    <span className="text-muted-foreground text-xs">—</span>
  )}
</TableCell>
```

---

### WP-6 · Frontend — BP detail shows linked user

**File:** `apps/web/app/(clinic)/clinic/business-partners/[id]/edit/page.tsx` (or the edit client component)

If `bp.linkedUser` is present, show a "Linked Account" card:
```tsx
{bp.linkedUser && (
  <div className="border rounded-lg p-4 bg-muted/30">
    <h3 className="font-medium text-sm mb-2">Linked Account</h3>
    <p className="text-sm">{bp.linkedUser.name}</p>
    <p className="text-muted-foreground text-xs">{bp.linkedUser.role}</p>
    <Link
      href={
        bp.type === 'CUSTOMER'
          ? `/clinic/clients/${bp.linkedUser.id}`
          : `/clinic/staff` // future: /clinic/staff/{id}
      }
      className="text-primary text-sm hover:underline mt-2 inline-block"
    >
      View {bp.type === 'CUSTOMER' ? 'Client' : 'Staff'} →
    </Link>
  </div>
)}
```

---

### WP-7 · Frontend — Client detail shows "View BP" link

**File:** `apps/web/app/(clinic)/clinic/clients/[id]/client-detail-client.tsx`

The `Client` interface already has `businessPartners[0].code`. Extend to add `id`:
```typescript
businessPartners?: { id: string; code: string | null; /* ... */ }[];
```

In the header area, next to "BP Code:", add:
```tsx
{bp && (
  <Link href={`/clinic/business-partners/${bp.id}`} className="text-primary text-xs hover:underline ml-2">
    View BP Record →
  </Link>
)}
```

---

### WP-8 · Types package update

**File:** `packages/types/src/index.ts` (or relevant type file)

Add `linkedUser` to `BusinessPartnerResponse`:
```typescript
linkedUser: {
  id: string;
  name: string;
  role: string;
  status: string;
} | null;
```

---

## 4. Execution Order

```
WP-1 (seed groups) → WP-2 (backend auto-create) → WP-3 (back-fill) 
  → WP-4 (BP includes user) → WP-8 (types) 
    → WP-5 (staff UI) + WP-6 (BP UI) + WP-7 (client UI)
```

WP-5, 6, 7 can run in parallel after WP-4 + WP-8.

---

## 5. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | Creating a new VET staff member → BP record of type VET auto-created and linked |
| AC-2 | Creating a non-VET staff member → BP record of type STAFF auto-created |
| AC-3 | Staff list table shows BP code for each row; code links to BP detail |
| AC-4 | BP detail page for type CUSTOMER/STAFF/VET shows "Linked Account" section |
| AC-5 | Client detail page shows "View BP Record →" link in header area |
| AC-6 | BP list can be filtered by type=STAFF or type=VET to see all staff BPs |
| AC-7 | Existing staff without BPs are back-filled by the seed/migration script |
| AC-8 | No breaking changes to existing Client creation flow |

---

## 6. Files Changed Summary

### Backend (`apps/api/`)
- `src/modules/identity/services/user.service.ts` — WP-2 (createStaff, findByClinic)
- `src/modules/identity/services/business-partner.service.ts` — WP-4 (include user)

### Database (`packages/database/`)
- `prisma/seed.ts` — WP-1 (staff/vet BP groups), WP-3 (back-fill)

### Types (`packages/types/`)
- `src/index.ts` or relevant type file — WP-8 (linkedUser on BusinessPartnerResponse)

### Frontend (`apps/web/`)
- `app/(clinic)/clinic/staff/staff-client.tsx` — WP-5
- `app/(clinic)/clinic/business-partners/[id]/edit/` (component) — WP-6
- `app/(clinic)/clinic/clients/[id]/client-detail-client.tsx` — WP-7

**Total estimated files:** ~7–9 files, no schema migration required (all linkage already exists in DB schema).
