# Design: Advanced ERP & Clinic-Specific BP Enhancements

**Feature Branch**: `005-identity-bp-spec`  
**Date**: April 19, 2026  
**Status**: Approved  
**Builds on**: `2026-04-18-bp-form-tabs-design.md` (4-tab form, currently implemented)

---

## Overview

This design extends the existing Business Partner system with:

1. **BpGroup** — clinic-scoped grouping with auto-generated human-readable codes (`C-0001`, `V-0023`)
2. **CRM fields** — PDPA opt-in, internal notes, alert message
3. **BpVet extensions** — specialty and default doctor fee (DF) rate
4. **Free-form contact position** — replace `ContactPosition` master table with plain text field
5. **Alert banner** — shown everywhere a full `BusinessPartnerResponse` is displayed

---

## Decisions Captured

| Question | Decision |
|---|---|
| BpGroup scope | Clinic-scoped (`clinicId` FK); auto-seeded 3 defaults on clinic creation |
| Concurrent code generation | `SELECT ... FOR UPDATE` row lock inside a Prisma `$transaction` |
| ContactPosition migration | Drop-and-lose (pre-production; no real data); `BpContact.position` becomes free-form `String?` |
| Alert banner placement | Everywhere a full `BusinessPartnerResponse` is rendered (form, detail page, future invoice selectors) |

---

## Section 1: Schema Changes

### New model: `BpGroup`

```prisma
model BpGroup {
  id               String            @id @default(uuid())
  clinicId         String
  name             String
  prefix           String            // e.g. "C-", "V-", "S-"
  currentSequence  Int               @default(0)
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  clinic           Clinic            @relation(fields: [clinicId], references: [id])
  businessPartners BusinessPartner[]

  @@unique([clinicId, prefix])
  @@index([clinicId])
  @@map("bp_groups")
}
```

- `@@unique([clinicId, prefix])` prevents duplicate prefixes within a clinic.
- `currentSequence` is incremented atomically via row lock — never read outside a transaction during creation.

### Modified: `BusinessPartner`

Five new fields added after `isActive`:

```prisma
  groupId          String?           // FK to BpGroup.id
  code             String?  @unique  // auto-generated: "{prefix}{seq:04d}"
  isMarketingOptIn Boolean  @default(false)
  internalNotes    String?  @db.Text
  alertMessage     String?
```

And the FK relation:

```prisma
  group            BpGroup?  @relation(fields: [groupId], references: [id])
```

### Modified: `BpVet`

Two new optional fields:

```prisma
  specialty        String?
  defaultDfRate    Decimal? @db.Decimal(5,2)
```

### Modified: `BpContact`

Replace FK-based position with free-form text:

- **Remove**: `positionId String?` and `position ContactPosition? @relation(...)` 
- **Add**: `position String?`

### Removed: `ContactPosition`

The entire `ContactPosition` model and its `@@map("contact_positions")` table are dropped.  
Migration: drop-and-lose — the `contact_positions` table and `bp_contacts.position_id` column are dropped. The new `bp_contacts.position` varchar column is added with no data migration (pre-production).

---

## Section 2: Backend Logic

### BP Code Generation

Triggered when `groupId` is present on `POST /clinic/business-partners`.

```
1. Begin Prisma $transaction
2. SELECT * FROM bp_groups WHERE id = groupId FOR UPDATE
3. INCREMENT currentSequence by 1
4. FORMAT code = `${prefix}${currentSequence.toString().padStart(4, '0')}`
   → e.g. prefix "C-", sequence 1 → "C-0001"
5. Save BusinessPartner with { code, groupId } + save incremented BpGroup.currentSequence
6. Commit transaction
```

- If `groupId` is null, `code` remains null — no sequence consumed.
- `code` has `@unique` on the table. Cross-clinic uniqueness is acceptable (codes are short references, not tenant keys).
- The generated `code` is immutable after creation. `groupId` and `code` are excluded from the update DTO.

### `GET /reference/bp-groups`

Add to `reference.controller.ts`. Returns all active `BpGroup` rows for the current clinic (derived from session `clinicId`). Response type: `BpGroupResponse[]`.

```ts
interface BpGroupResponse {
  id: string;
  name: string;
  prefix: string;
  currentSequence: number;
  isActive: boolean;
}
```

Requires authentication; all roles may read. No clinic-override from query params — `clinicId` from session only.

### Clinic Auto-Seed

When `ClinicService.create()` runs, after the `Clinic` row is persisted, insert 3 default `BpGroup` rows in the same transaction:

```ts
{ clinicId, name: 'Customers', prefix: 'C-' }
{ clinicId, name: 'Vets',      prefix: 'V-' }
{ clinicId, name: 'Suppliers', prefix: 'S-' }
```

### Superseded: `GET /reference/contact-positions`

The `listContactPositions()` method and `@Get('contact-positions')` route are **removed** from `reference.controller.ts` as `ContactPosition` no longer exists.

### Alert Message — No Backend Logic

`alertMessage` is a plain `String?`. The API returns it in `BusinessPartnerResponse` unchanged. No server-side processing. Consumers render a banner when the field is non-null/non-empty.

---

## Section 3: Frontend Changes

### Alert Banner

New component rendered in two places:

1. **`business-partner-form.tsx`** — above `<Tabs>`, below the form header
2. **BP detail/view page** — at the top of the page

```tsx
// Render condition
{bp?.alertMessage && (
  <BpAlertBanner message={bp.alertMessage} />
)}
```

`BpAlertBanner` uses the existing UI package's warning/alert variant (yellow). It is read-only — staff edit `alertMessage` via the form field in the Roles & Commercial tab.

### Form Tab Changes

#### Contact Tab (`contact-tab.tsx`)

- **Remove**: `Select` dropdown for position, `positionsLoading` state, `/reference/contact-positions` fetch
- **Add**: `<Input type="text">` bound to `contacts[i].position` (free-form)
- **Remove** from `business-partner-form.tsx`: `contactPositions` state and the parallel `Promise.all` fetch for contact positions

#### Roles & Commercial Tab (`roles-commercial-tab.tsx`)

Add the following fields:

| Field | Control | Source |
|---|---|---|
| `groupId` | `<Select>` | `GET /reference/bp-groups` (async, same pattern as tax codes) |
| `isMarketingOptIn` | `<Checkbox>` | static |
| `internalNotes` | `<Textarea>` | static |
| `alertMessage` | `<Input type="text">` | static |

The `groupId` selector is optional. When a group is selected, display the next code preview as hint text: `Next code: {prefix}{(currentSequence+1).toString().padStart(4,'0')}`.

#### Vet Extension (`extension-fields.tsx`)

Add two fields below `licenseNumber`:

| Field | Control | Validation |
|---|---|---|
| `specialty` | `<Input type="text">` | optional, free-form |
| `defaultDfRate` | `<Input type="number">` | optional, 0–100, 2 decimal places |

### Zod Schema Changes (`bp-form-schema.ts`)

```ts
// bpContactSchema
position: z.string().nullable().optional()
// (remove positionId)

// vetSchema — add
specialty: z.string().nullable().optional()
defaultDfRate: z.number().min(0).max(100).nullable().optional()

// baseBpSchema — add
groupId: z.string().nullable().optional()
isMarketingOptIn: z.boolean().default(false)
internalNotes: z.string().nullable().optional()
alertMessage: z.string().nullable().optional()
```

---

## Section 4: Spec / Docs Updates (Approach A — In-Place)

### New FRs for `spec.md`

- **FR-016**: System MUST auto-generate a human-readable `code` for new Business Partners when a `groupId` is provided, using the `prefix` and `currentSequence` from the assigned `BpGroup`. Code generation MUST be atomic (row-level lock) to prevent duplicates under concurrent creation.
- **FR-017**: `BpGroup` records MUST be clinic-scoped. Each clinic MUST have 3 default groups auto-seeded on clinic creation: Customers (`C-`), Vets (`V-`), Suppliers (`S-`).
- **FR-018**: `BpContact.position` MUST be a free-form text field. No master `ContactPosition` table exists. Staff enter any job title string.
- **FR-019**: The `alertMessage` field on `BusinessPartner` MUST be surfaced as a visible warning banner in every UI context where a full `BusinessPartnerResponse` is displayed (BP form, BP detail page, and any future selector that loads the full response).
- **FR-020**: `BpVet` MUST support optional `specialty` (free-form text) and `defaultDfRate` (decimal 0–100, 2dp) fields.

### Superseded tasks (annotate in `tasks.md`)

| Task | Status | Reason |
|---|---|---|
| `ContactPosition` seed rows in T002/T007 | ~~SUPERSEDED~~ | `ContactPosition` model removed; free-form text replaces it |
| `GET /reference/contact-positions` in T035 | ~~SUPERSEDED~~ | Endpoint removed along with model |
| `contact-tab.tsx` position `Select` (T009 partial) | ~~SUPERSEDED~~ | Replaced by plain `<Input>` |

### New tasks for `tasks.md`

See Section 5.

---

## Section 5: New Task List

### Phase 2 Revision (Schema)

- **T037** Update `packages/database/prisma/schema.prisma`: add `BpGroup` model; add 5 new fields to `BusinessPartner`; add `specialty`/`defaultDfRate` to `BpVet`; replace `BpContact.positionId` FK with `position String?`; drop `ContactPosition` model
- **T038** Generate Prisma migration (`20260419_advanced_bp_erp`): drop `contact_positions` table, drop `bp_contacts.position_id`, add `bp_contacts.position`, add `bp_groups` table, add 5 columns to `business_partners`, add 2 columns to `bp_vets`

### Phase 3 — Shared Types

- **T039** Update `packages/types/src/api.ts`: add `BpGroupResponse`; add `groupId`, `code`, `isMarketingOptIn`, `internalNotes`, `alertMessage` to `BusinessPartnerResponse` and payloads; add `specialty`, `defaultDfRate` to `BpContactResponse` / vet payload; remove `ContactPositionResponse` and `BpContactPayload.positionId`; rebuild dist

### Phase 4 — Backend

- **T040** [P] Update `apps/api/src/modules/identity/dto/create-business-partner.dto.ts`: add `groupId?`, `isMarketingOptIn?`, `internalNotes?`, `alertMessage?`; add `specialty?`, `defaultDfRate?` to `BpVetDto`; replace `positionId?` with `position?` in `BpContactDto`
- **T041** [P] Update `apps/api/src/modules/identity/dto/update-business-partner.dto.ts`: same field additions; exclude `groupId`/`code` from update (immutable after creation)
- **T042** Update `apps/api/src/modules/identity/services/business-partner.service.ts`: implement sequence generation inside `$transaction` with `SELECT FOR UPDATE`; map new fields in `mapBpToResponse()`; update `create()`/`update()` flows
- **T043** [P] Add `GET /reference/bp-groups` to `apps/api/src/modules/identity/controllers/reference.controller.ts`; add `listBpGroups()` method to `business-partner.service.ts`
- **T044** Remove `GET /reference/contact-positions` from `reference.controller.ts` and `listContactPositions()` from service (~~SUPERSEDED~~)
- **T045** Update `apps/api/src/modules/identity/services/clinic.service.ts` (or equivalent clinic creation service): auto-seed 3 `BpGroup` rows when a `Clinic` is created

### Phase 4 — Backend Tests

- **T046** [P] Update `apps/api/src/modules/identity/services/business-partner.service.spec.ts`: add tests for sequence generation, new field mapping, removed `ContactPosition` references
- **T047** [P] Update `apps/api/src/modules/identity/controllers/reference.controller.spec.ts`: add `listBpGroups` test; remove `listContactPositions` test

### Phase 5 — Frontend

- **T048** Update `apps/web/components/business-partners/bp-form-schema.ts`: replace `positionId` with `position` in `bpContactSchema`; add `groupId`, `isMarketingOptIn`, `internalNotes`, `alertMessage` to `baseBpSchema`; add `specialty`, `defaultDfRate` to `vetSchema`
- **T049** Update `apps/web/components/business-partners/tabs/contact-tab.tsx`: replace position `<Select>` + `__none__` sentinel with plain `<Input type="text">` for `position`
- **T050** Update `apps/web/components/business-partners/tabs/roles-commercial-tab.tsx`: add `groupId` `<Select>` (from `/reference/bp-groups`), `isMarketingOptIn` checkbox, `internalNotes` textarea, `alertMessage` input; add next-code preview hint
- **T051** Update `apps/web/components/business-partners/extension-fields.tsx`: add `specialty` input and `defaultDfRate` number input below `licenseNumber`
- **T052** Update `apps/web/components/business-partners/business-partner-form.tsx`: remove `/reference/contact-positions` fetch; add `/reference/bp-groups` fetch; add `<BpAlertBanner>` above `<Tabs>` when `alertMessage` is set; wire new schema fields into `buildDefaultValues()`
- **T053** [P] Update `apps/web/messages/en.json` and `th.json`: add keys for `group`, `code`, `isMarketingOptIn`, `internalNotes`, `alertMessage`, `specialty`, `defaultDfRate`, `contacts.position` (replacing `contacts.selectPosition`/`contacts.noPosition`)

### Phase 5 — Frontend Tests

- **T054** [P] Update `apps/web/components/business-partners/bp-form-schema.test.ts`: update contact schema tests (positionId → position); add tests for new baseBpSchema fields; add vetSchema tests for specialty/defaultDfRate

---

## Out of Scope for This Design

- BpGroup administration UI (create/edit/delete groups) — deferred; groups are auto-seeded and may be managed via seed/migration for now
- Bulk BP import / code reassignment
- Alert banner in invoice creation selectors (planned by design; to be implemented when invoice feature is built)
- DF Rate calculation logic in billing — `defaultDfRate` is stored only; no payroll computation in this phase
