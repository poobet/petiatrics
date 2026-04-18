# Design: Business Partner Form — Tab UI & Enterprise Field Expansion

**Date**: 2026-04-18  
**Feature Branch**: `005-identity-bp-spec`  
**Status**: Approved

## Problem

The Business Partner form has grown beyond the original Thai-compliance scope. It now needs to support contact persons, commercial terms (credit limit, credit hold, discount group), bank account details, and a richer contact section (`phone`, `email`, `lineId` on the BP core record). Rendering all fields in a single card is unusable. The backend is also missing all of these new fields — this is a full-stack expansion, not a UI-only refactor.

## Scope

Full-stack: Prisma schema migration + seed data + NestJS API + shared types + Next.js UI.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| BpContact persistence | Nested array submitted with BP payload | Consistent with `activeRoles` pattern; single-submit contract |
| BpContact inline editor | Inline rows (no modal) | Faster UX for multi-contact entry |
| `position` field on BpContact | FK to `ContactPosition` reference table | Ensures data consistency; no management UI in this phase |
| Form validation library | Migrate to `react-hook-form` | Required for per-tab error detection; current `useState` approach cannot report which tab has errors |
| Tab file decomposition | One component per tab | Keeps each file focused and under ~150 lines |

---

## 1. Database Schema

### 1a. New `ContactPosition` reference table

Seeded by system migration. Not user-editable in this phase. No clinic scoping — global.

```prisma
model ContactPosition {
  id        String      @id @default(uuid())
  name      String
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  contacts  BpContact[]

  @@map("contact_positions")
}
```

**Seed records** (added to `packages/database/prisma/seed.ts`):

```ts
{ name: 'ผู้จัดการ / Manager' },
{ name: 'ฝ่ายจัดซื้อ / Purchasing' },
{ name: 'ฝ่ายบัญชี / Accounting' },
{ name: 'พนักงานขาย / Sales' },
{ name: 'กรรมการ / Director' },
```

### 1b. New `BpContact` model

**`isPrimary` business rule:** At most one contact per BP may have `isPrimary = true`. Enforced at the application layer on every save: if the incoming `contacts` array contains more than one row with `isPrimary = true`, the service sets `isPrimary = true` only on the first one and `isPrimary = false` on the rest. No DB-level partial unique index is added in this phase; the app layer is the sole enforcer.

```prisma
model BpContact {
  id          String           @id @default(uuid())
  bpId        String
  name        String
  phone       String?
  email       String?
  lineId      String?
  positionId  String?
  isPrimary   Boolean          @default(false)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  bp       BusinessPartner  @relation(fields: [bpId], references: [id])
  position ContactPosition? @relation(fields: [positionId], references: [id])

  @@index([bpId])
  @@map("bp_contacts")
}
```

### 1c. New fields on `BusinessPartner`

Added via Prisma migration. All optional — no existing rows are broken.

| Field | Type | Default |
|---|---|---|
| `phone` | `String?` | — |
| `email` | `String?` | — |
| `lineId` | `String?` | — |
| `creditLimit` | `Float?` | — |
| `creditHold` | `Boolean` | `false` |
| `discountGroupId` | `String?` | — |
| `bankAccountName` | `String?` | — |
| `bankAccountBranch` | `String?` | — |
| `bankAccountNumber` | `String?` | — |
| `contacts` | `BpContact[]` | relation |

---

## 2. Shared Types (`packages/types`)

### New interfaces in `api.ts`

```ts
export interface ContactPositionResponse {
  id: string;
  name: string;
}

export interface BpContactPayload {
  id?: string;           // present for existing rows; absent for new
  name: string;
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  positionId?: string | null;
  isPrimary?: boolean;
}

export interface BpContactResponse {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  positionId: string | null;
  position: ContactPositionResponse | null;
  isPrimary: boolean;
}
```

### Updated `CreateBusinessPartnerPayload` / `UpdateBusinessPartnerPayload`

Both gain the following optional fields:

```ts
phone?: string | null;
email?: string | null;
lineId?: string | null;
creditLimit?: number | null;
creditHold?: boolean;
discountGroupId?: string | null;
bankAccountName?: string | null;
bankAccountBranch?: string | null;
bankAccountNumber?: string | null;
contacts?: BpContactPayload[];
```

### Updated `BusinessPartnerResponse`

Gains all above fields (read side) plus:

```ts
contacts: BpContactResponse[];
```

---

## 3. Backend (NestJS)

### 3a. `ReferenceController`

New endpoint added alongside `GET /reference/tax-codes`:

```
GET /api/v1/reference/contact-positions
```

Returns all `ContactPosition` records where `isActive = true`. No clinic scoping. Accessible to all authenticated clinic users.

### 3b. `BusinessPartnerService`

`listContactPositions()` — queries `db.contactPosition.findMany({ where: { isActive: true } })`. This method lives on `BusinessPartnerService`, which is already injected into `ReferenceController` (matching the existing `listTaxCodes()` pattern — no new cross-module dependency is introduced).

`create()` and `update()` both gain contacts diff logic. The entire contacts diff runs inside a `prisma.$transaction` to prevent partial state on failure.

**Diff algorithm (upsert-based, not delete-then-recreate):**

1. If `contacts` is `undefined` in the payload → skip the diff entirely; preserve existing contacts unchanged.
2. If `contacts` is an explicit array (including empty `[]`) → perform the following inside a transaction:
   a. Load existing `BpContact.id` values for the BP.
   b. Delete all rows whose `id` is not present in the incoming array.
   c. For each element in the incoming array: `update` the row if `id` is present and matches an existing row; `create` a new row otherwise, always generating a fresh server-side UUID (client-supplied `id` values for new rows are discarded — the server never uses a client-provided UUID when creating a row to prevent ID injection).

This approach preserves row IDs across saves (important for FK references on other tables in future phases) and avoids the "delete all, re-create" pattern which destroys identity.

### 3c. DTOs

**New `BpContactDto`** (used in both Create and Update DTOs):

```ts
export class BpContactDto {
  @IsOptional() @IsUUID()     id?: string;     // ignored for new rows — server generates a fresh UUID
  @IsString() @IsNotEmpty()   name!: string;
  @IsOptional() @IsString()   phone?: string | null;
  @IsOptional() @IsEmail() @IsString() email?: string | null;
  @IsOptional() @IsString()   lineId?: string | null;
  @IsOptional() @IsUUID()     positionId?: string | null;
  @IsOptional() @IsBoolean()  isPrimary?: boolean;
}
```

The `creditTermDays` field (already existing) adds `@IsInt()` to align with Zod's `z.number().int().min(0)` rule.

**`CreateBusinessPartnerDto`** and **`UpdateBusinessPartnerDto`** gain:

```ts
@IsOptional() @IsString()   phone?: string | null;
  @IsOptional() @IsEmail() @IsString() email?: string | null;
@IsOptional() @IsNumber() @Min(0) creditLimit?: number | null;
@IsOptional() @IsBoolean()  creditHold?: boolean;
@IsOptional() @IsString()   discountGroupId?: string | null;
@IsOptional() @IsString()   bankAccountName?: string | null;
@IsOptional() @IsString()   bankAccountBranch?: string | null;
@IsOptional() @IsString()   bankAccountNumber?: string | null;

@IsOptional()
@IsArray()
@ValidateNested({ each: true })
@Type(() => BpContactDto)
contacts?: BpContactDto[];
```

---

## 4. Frontend UI (`apps/web/components/business-partners/`)

### 4a. Form migration to `react-hook-form`

The current form uses local `useState` per field. This will be migrated to `react-hook-form` with a Zod schema. This is required to enable `formState.errors` — without it there is no reliable way to detect which tab contains invalid fields.

**Zod schema field-level rules (frontend validation):**

| Field | Rule |
|---|---|
| `name` | Required, non-empty string |
| `type` | Required, must be a `BusinessPartnerType` enum value (create only) |
| `taxId` | Optional; if provided, must match `/^\d{13}$/` |
| `branchCode` | Optional; if provided, must match `/^\d{5}$/` |
| `zipcode` | Optional; if provided, must match `/^\d{5}$/` |
| `email` | Optional; if provided, must be a valid email format (`z.string().email()`) |
| `creditLimit` | Optional; if provided, must be a non-negative number |
| `creditTermDays` | Optional; if provided, must be a non-negative integer (`z.number().int().min(0)`) |
| `contacts[].name` | Required on each contact row, non-empty string |
| `contacts[].email` | Optional; if provided, must be a valid email format (`z.string().email()`) |
| `contacts` (array-level) | At most one entry may have `isPrimary: true` — enforced by a `.refine()` on the array. If multiple are checked the form shows an error rather than silently demoting. |
| `vet.licenseNumber` | Required when `type === 'VET'` |

All other fields are optional with no additional format constraints at the frontend layer. The frontend Zod schema mirrors the backend DTO constraints — they must not diverge.

### 4b. File structure

```
components/business-partners/
  business-partner-form.tsx      ← orchestrator (react-hook-form setup, submit, tab shell)
  tabs/
    contact-tab.tsx              ← phone, email, lineId + BpContact inline editor
    tax-address-tab.tsx          ← taxId, isHeadOffice, branchCode, VAT/WHT, address
    roles-commercial-tab.tsx     ← 8 LN role checkboxes + discountGroupId
    financials-tab.tsx           ← creditLimit, creditTermDays, creditHold, bank account
  extension-fields.tsx           ← updated: props changed to use react-hook-form `Controller`
```

### 4c. Tab layout

Core identity fields sit **above** the `<Tabs>` component inside the outer card — they apply to all tabs. `name` is always visible; `type` is visible only on create (hidden on edit, matching existing behavior). The VET extension (`licenseNumber`) is rendered **below** the `<Tabs>` component, conditionally visible when `type === 'VET'`, before the Save/Cancel row. Save / Cancel buttons are always visible outside the tab boundary.

```
┌─ Card ────────────────────────────────────────────┐
│  name (always)   type (create only)               │
│  ┌─ Tabs ──────────────────────────────────────┐  │
│  │ Contact | Tax & Address | Roles & Commercial | Financials │
│  │ <tab content>                               │  │
│  └─────────────────────────────────────────────┘  │
│  [VET: licenseNumber — shown only when type=VET]  │
│  [ Save ]  [ Cancel ]                             │
└───────────────────────────────────────────────────┘
```

Because `vet.licenseNumber` lives outside the tabs, a validation error on it does **not** trigger any tab's red-dot indicator. It renders inline below the tabs where it is always visible when applicable. `ExtensionFields` must be updated to register its field via `Controller` from react-hook-form so that `vet.licenseNumber` participates in `formState.errors`.

### 4d. Per-tab error indicator

```tsx
// TabsTrigger wrapper — shows red dot if the tab has validation errors
<TabsTrigger value="contact" className="relative">
  Contact
  {hasContactErrors && (
    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
  )}
</TabsTrigger>
```

`hasContactErrors` is derived from `formState.errors` by checking the field names belonging to the Contact tab (phone, email, lineId, contacts).

### 4e. BpContact inline editor (Contact tab)

```
[ Name* ] [ Phone ] [ Email ] [ LINE ID ] [ Position ▼ ] [ Primary ] [×]
[ Name* ] [ Phone ] [ Email ] [ LINE ID ] [ Position ▼ ] [ Primary ] [×]
+ Add contact
```

- "Add contact" appends a blank row via `useFieldArray` from react-hook-form.
- Delete button removes the row from the array.
- The `isPrimary` checkbox uses **radio-button semantics**: checking a row's Primary checkbox automatically unchecks all other rows' Primary checkboxes. Only one row can be primary at a time; the UI enforces this before the Zod array-level refine runs.
- `Position` is a `<Select>` populated from `GET /reference/contact-positions` (fetched once on form mount alongside tax codes). While positions are loading, the Select is disabled. If the fetch fails, the Position field degrades to a disabled Select (no options) and a non-blocking toast error is displayed; the save is **not** blocked.
- On submit, the `contacts` array is sent as `BpContactPayload[]`; existing rows carry their `id`, new rows omit it.

### 4f. Edit page hydration

On the edit page, `initial` (a `BusinessPartnerResponse`) is passed to the form as `defaultValues` in `useForm`. All new fields default to their `initial` value or a sensible empty/false fallback. `contacts` defaults to `initial.contacts ?? []`.

---

## 5. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | New Prisma migration applies cleanly with no data loss on existing BP rows |
| AC-02 | `GET /reference/contact-positions` returns the 5 seeded positions |
| AC-03 | Creating a BP with `contacts` array persists all contact rows |
| AC-04 | Updating a BP removes contacts absent from the new array and upserts the rest |
| AC-05 | Tab 1 (Contact) is the default active tab on both create and edit |
| AC-06 | Tabs with validation errors show a red dot indicator on their trigger |
| AC-07 | Save / Cancel buttons are visible regardless of which tab is active |
| AC-08 | All new fields (`creditLimit`, `creditHold`, bank account, etc.) round-trip correctly through create and edit flows |
| AC-09 | `discountGroupId` is a free-text input (no reference table in this phase) |
| AC-10 | `ContactPosition` has no management UI; it is seeded only |
| AC-11 | When `contacts` is omitted from the update payload, existing contacts are preserved unchanged |
| AC-12 | No more than one contact per BP has `isPrimary = true` after any save operation |
| AC-13 | If the `GET /reference/contact-positions` fetch fails, the Position selector degrades gracefully (disabled, non-blocking toast); the form remains saveable |
| AC-14 | `discountGroupId` is stored as a plain string; no FK constraint exists in the database |
| AC-15 | The VET licenseNumber field renders outside the tabs and participates in form validation via `Controller` |
| AC-16 | Checking a contact's Primary checkbox automatically unchecks all other contacts' Primary checkboxes |
| AC-17 | Submitting a form with two `isPrimary = true` contacts shows a Zod validation error (not a silent backend demotion) |

## 6. Out of Scope

- `ContactPosition` management UI (CRUD for positions)
- `discountGroupId` reference table — `discountGroupId` is stored as a plain free-text string with **no FK constraint** in this phase. The `*Id` suffix is used for future upgrade-path clarity, not to imply a current FK. Implementers MUST NOT add a FK constraint.
- Bank institution name field (`bankName`) — the three bank fields cover account holder, branch, and number only. Bank institution name is deferred to a future phase and is not to be added now.
- Per-line invoice tax calculation
- BP hierarchy reporting
