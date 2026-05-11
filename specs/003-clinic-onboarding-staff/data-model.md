# Data Model: Clinic Onboarding, Staff Creation, and Dual Authentication

## Overview

This slice extends the PostgreSQL schema with three categories of change: (1) new lifecycle states on `Clinic` and `User`, (2) new identity fields on both models to support username-based authentication and forced password change, and (3) a new `slug` field on `Clinic` that anchors the staff username system. The Redis session payload is also expanded to carry the `mustChangePassword` flag. No new tables are introduced.

---

## Relational Changes (PostgreSQL via Prisma)

### Clinic (modified)

**New fields**:

| Field    | Type          | Constraints                              | Notes                                                    |
|----------|---------------|------------------------------------------|----------------------------------------------------------|
| `slug`   | `String`      | `@unique`, non-nullable                  | Auto-generated from `name` at creation; immutable after. |
| `phone`  | `String?`     | optional                                 | Captured at registration but not required.               |

**Enum extension** — `ClinicStatus`:

| Value      | Was present | Added |
|------------|-------------|-------|
| `ACTIVE`   | ✓           |       |
| `SUSPENDED`| ✓           |       |
| `ARCHIVED` | ✓           |       |
| `PENDING`  |             | ✓     |
| `REJECTED` |             | ✓     |

**Status transition rules**:

```
PENDING  → ACTIVE    (admin approve action)
PENDING  → REJECTED  (admin reject action — terminal)
ACTIVE   → SUSPENDED (admin status toggle, unchanged from 002)
SUSPENDED→ ACTIVE    (admin status toggle, unchanged from 002)
REJECTED → (no transition — terminal)
```

**Slug generation algorithm** (server-side, no client input):

```
slug = clinicName
         .toLowerCase()
         .replaceAll(/[^a-z0-9]+/g, '-')
         .replace(/^-|-$/g, '')   // strip leading/trailing hyphens
         .substring(0, 50)        // safety cap

if slug already exists in DB:
    try slug-2, slug-3 … slug-9, slug-{nanoid(4)}
```

---

### User (modified)

**New fields**:

| Field                | Type      | Constraints                | Notes                                                                              |
|----------------------|-----------|----------------------------|------------------------------------------------------------------------------------|
| `name`               | `String`  | non-nullable               | Human-readable display name. Required at creation for all user types.              |
| `username`           | `String?` | `@unique`, nullable        | Full staff login identifier: `{prefix}@{clinic-slug}`. NULL for owners and admins. |
| `mustChangePassword` | `Boolean` | `@default(false)`          | Force-change flag set to `true` when created with a temporary password.            |

**Modified fields**:

| Field   | Before              | After               | Migration note                                      |
|---------|---------------------|---------------------|-----------------------------------------------------|
| `email` | `String @unique`    | `String? @unique`   | Existing rows retain their email values. NULL allowed for new staff-only accounts. |

**Enum extension** — `UserStatus`:

| Value      | Was present | Added |
|------------|-------------|-------|
| `INVITED`  | ✓           |       |
| `ACTIVE`   | ✓           |       |
| `INACTIVE` | ✓           |       |
| `LOCKED`   | ✓           |       |
| `PENDING`  |             | ✓     |

**Status transition rules** (new paths only):

```
PENDING  → ACTIVE   (clinic owner activated by admin approval)
PENDING  → INACTIVE (clinic owner deactivated by admin rejection)
(all 002 transitions remain unchanged)
```

**Validation rules** (additions to existing):

- `email` is required for `SUPER_ADMIN` and `CLINIC_OWNER` roles. Staff-role users may have `email = NULL`.
- `username` is required for staff-role users created through the manual provisioning flow. It must be globally unique.
- `mustChangePassword = true` must be set whenever a user is created with a caller-supplied temporary password.
- `name` must be non-empty on all new user records.

---

## Slug Format

The `slug` field on `Clinic` is the canonical namespace for all staff usernames within a clinic. Rules enforced at the database level:

- Characters: lowercase letters `[a-z]`, digits `[0-9]`, hyphens `-`.
- Length: 2–50 characters.
- Uniqueness: enforced by `@unique` in Prisma/PostgreSQL.
- Mutability: immutable after creation (no update path exposed).

---

## Session and Request Context (Redis)

### UserContext (extended)

The Redis session payload (`UserContext` in `packages/types/src/api.ts`) gains two optional fields:

| Field                | Type              | Notes                                                       |
|----------------------|-------------------|-------------------------------------------------------------|
| `email`              | `string \| null`  | Was `string` — now explicitly nullable for staff accounts.  |
| `username`           | `string \| null`  | New. Non-null for staff; null for owners and admins.        |
| `mustChangePassword` | `boolean`         | New. `true` until the staff member completes a password change. |

**Backwards compatibility**: The existing `SessionService.getSession()` already backfills missing fields from older sessions. Add `mustChangePassword` to the backfill block with a default of `false` so pre-migration sessions degrade gracefully.

---

## AuthProfile (web-facing type)

`AuthProfile` in `packages/types/src/api.ts` gains the same additions:

| Field                | Type              | Notes                                                    |
|----------------------|-------------------|----------------------------------------------------------|
| `email`              | `string \| null`  | Nullable. Staff accounts may have no email.              |
| `username`           | `string \| null`  | Non-null for staff; null for owners and admins.          |
| `mustChangePassword` | `boolean`         | Frontend uses this to gate navigation to change-password page. |

---

## Prisma Schema Delta (summary diff)

```prisma
// ─── Enums (changed) ───────────────────────────────────────────────────────

enum ClinicStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
  PENDING   // NEW
  REJECTED  // NEW
}

enum UserStatus {
  INVITED
  ACTIVE
  INACTIVE
  LOCKED
  PENDING   // NEW
}

// ─── Clinic (changed) ──────────────────────────────────────────────────────

model Clinic {
  // ... existing fields unchanged ...
  slug   String  @unique           // NEW — generated at creation, immutable
  phone  String?                   // NEW — optional contact number
  status ClinicStatus @default(PENDING)  // DEFAULT changed from ACTIVE to PENDING
}

// ─── User (changed) ────────────────────────────────────────────────────────

model User {
  // ... existing fields unchanged except email ...
  name                String           // NEW — human-readable display name
  email               String? @unique  // CHANGED — was String (non-nullable)
  username            String? @unique  // NEW — staff login identifier
  mustChangePassword  Boolean @default(false)  // NEW
  status              UserStatus @default(PENDING)  // DEFAULT changed from INVITED to PENDING
}
```

---

## Migration Notes

1. **`User.email` nullable migration**: Existing rows all have non-null email values. The migration adds `ALTER COLUMN email DROP NOT NULL`. No data update needed.
2. **`Clinic.slug` backfill**: The slug column is non-nullable. The migration must `ADD COLUMN slug TEXT`, then run a `UPDATE clinics SET slug = ...` for each existing clinic before applying the `NOT NULL` and `UNIQUE` constraints. The backfill strategy uses the same slugification algorithm applied to the existing clinic `name`.
3. **`User.name` backfill**: The `name` column is non-nullable but existing rows lack it. Migration must `ADD COLUMN name TEXT DEFAULT ''` first, then apply `NOT NULL`. Application code is responsible for populating meaningful values for existing users via a seed or admin action.
4. **`Clinic.status` default**: Existing clinics have `ACTIVE` status. The default change to `PENDING` only affects new rows. No data update needed for existing records.
5. **`User.status` default**: Existing users are unaffected. New registration requests start in `PENDING`.
