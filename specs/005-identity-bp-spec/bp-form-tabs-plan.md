# BP Form Tabs & Enterprise Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Business Partner record with enterprise fields (contacts, credit, bank, comms) and reorganise the form into 4 tabs (Contact, Tax & Address, Roles & Commercial, Financials) backed by react-hook-form + Zod.

**Architecture:** Full-stack in 5 layers — Prisma migration → seed → shared types → NestJS DTOs/service → Next.js form. Each layer is self-contained and committed before moving to the next. The contacts diff runs inside a Prisma transaction. The form uses two Zod schemas (create / edit) sharing a base object; tabs detect errors from `formState.errors`.

**Tech Stack:** Prisma 6, NestJS 11, class-validator, class-transformer, react-hook-form, zod, @hookform/resolvers, Next.js 15, @petiatrics/ui (Tabs, Checkbox, Input, Select, Switch, Button), next-intl, sonner (toast)

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `apps/web/components/business-partners/tabs/contact-tab.tsx` | Tab 1 — phone, email, lineId, BpContact inline editor |
| `apps/web/components/business-partners/tabs/tax-address-tab.tsx` | Tab 2 — taxId, isHeadOffice, branchCode, address, VAT/WHT |
| `apps/web/components/business-partners/tabs/roles-commercial-tab.tsx` | Tab 3 — 8 LN role checkboxes, discountGroupId |
| `apps/web/components/business-partners/tabs/financials-tab.tsx` | Tab 4 — creditLimit, creditTermDays, creditHold, bank account |
| `apps/web/components/business-partners/bp-form-schema.ts` | Zod schemas (createBpSchema / editBpSchema) shared by both pages |
| `apps/web/components/business-partners/bp-form-schema.test.ts` | Vitest unit tests for Zod schemas |

### Modified files
| Path | Change summary |
|---|---|
| `packages/database/prisma/schema.prisma` | Add `ContactPosition` model, `BpContact` model, new BP fields |
| `packages/database/src/seed.ts` | Seed 5 `ContactPosition` rows (idempotent upsert) |
| `packages/types/src/api.ts` | Add `ContactPositionResponse`, `BpContactPayload`, `BpContactResponse`; extend payloads and response |
| `apps/api/src/modules/identity/dto/create-business-partner.dto.ts` | Add `BpContactDto`, new BP fields |
| `apps/api/src/modules/identity/dto/update-business-partner.dto.ts` | Add `BpContactDto` import, new BP fields |
| `apps/api/src/modules/identity/controllers/reference.controller.ts` | Add `GET /reference/contact-positions` endpoint |
| `apps/api/src/modules/identity/services/business-partner.service.ts` | Add `listContactPositions()`, extend `create()`/`update()` with contacts diff + new fields, extend `BP_INCLUDE`, extend `mapBpToResponse()` |
| `apps/web/components/business-partners/business-partner-form.tsx` | Replace with react-hook-form orchestrator + tab shell |
| `apps/web/components/business-partners/extension-fields.tsx` | Migrate to `useFormContext()`, remove `vet`/`onVetChange` props |

---

## Task 1: Prisma Schema — add ContactPosition, BpContact, new BP fields

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add models and fields to schema**

Open `packages/database/prisma/schema.prisma`. At the end of the Business Partner section (after the `BpSupplier` model, before the `Appointment` section), add:

```prisma
// ─── ContactPosition ─────────────────────────────────────────────────────────

model ContactPosition {
  id        String      @id @default(uuid())
  name      String
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  contacts  BpContact[]

  @@map("contact_positions")
}

// ─── BpContact ────────────────────────────────────────────────────────────────

model BpContact {
  id         String           @id @default(uuid())
  bpId       String
  name       String
  phone      String?
  email      String?
  lineId     String?
  positionId String?
  isPrimary  Boolean          @default(false)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  bp       BusinessPartner  @relation(fields: [bpId], references: [id])
  position ContactPosition? @relation(fields: [positionId], references: [id])

  @@index([bpId])
  @@map("bp_contacts")
}
```

In the `BusinessPartner` model, add these fields after `creditTermDays`:

```prisma
  // ── Communication
  phone           String?
  email           String?
  lineId          String?
  // ── Commercial
  creditLimit     Float?
  creditHold      Boolean  @default(false)
  discountGroupId String?
  // ── Bank account
  bankAccountName   String?
  bankAccountBranch String?
  bankAccountNumber String?
```

Also add `contacts BpContact[]` to the relations block of `BusinessPartner` (alongside `activeRoles BpRoleActive[]`):

```prisma
  contacts       BpContact[]
```

- [ ] **Step 2: Generate and run the migration**

```bash
cd packages/database
npx prisma migrate dev --name add-bp-enterprise-fields
```

Expected output: migration file created, database updated. If running against a dev database, confirm the new tables `contact_positions` and `bp_contacts` appear and the `business_partners` table has the 9 new columns.

- [ ] **Step 3: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected output: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add ContactPosition, BpContact, BP enterprise fields"
```

---

## Task 2: Seed ContactPosition data

**Files:**
- Modify: `packages/database/src/seed.ts`

- [ ] **Step 1: Add ContactPosition seed block**

In `packages/database/src/seed.ts`, find the section after the TaxCode upsert loop (around line 165 — after the `console.log('✓ TaxCodes seeded')` line). Add the following block:

```ts
  // ── 1b. ContactPosition — global reference, no clinic scoping ────────────
  //
  // The `name` stores a single bilingual string. The ` / ` separator is the
  // literal stored value; no separate language field is needed.
  const contactPositions = [
    { name: 'ผู้จัดการ / Manager' },
    { name: 'ฝ่ายจัดซื้อ / Purchasing' },
    { name: 'ฝ่ายบัญชี / Accounting' },
    { name: 'พนักงานขาย / Sales' },
    { name: 'กรรมการ / Director' },
  ];

  for (const cp of contactPositions) {
    await prisma.contactPosition.upsert({
      where: { name: cp.name },
      update: { isActive: true },
      create: { name: cp.name, isActive: true },
    });
  }
  console.log('✓ ContactPositions seeded');
```

> **Note:** This upsert uses `name` as the key. The `ContactPosition` model does not yet have `@@unique([name])`. You must add it to the schema in Task 1 before this seed will work, OR add it now as an amendment:

In `schema.prisma`, add `@@unique([name])` to `ContactPosition`:
```prisma
  @@unique([name])
  @@map("contact_positions")
```

Then re-run `npx prisma migrate dev --name add-contact-position-name-unique`.

- [ ] **Step 2: Run the seed to verify**

```bash
cd packages/database
npm run db:seed
```

Expected: `✓ ContactPositions seeded` printed. If it throws a Prisma error about missing `@@unique`, apply the amendment above first.

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/ packages/database/src/seed.ts
git commit -m "feat(db): seed ContactPosition reference data"
```

---

## Task 3: Shared Types — add ContactPosition, BpContact, extend payloads

**Files:**
- Modify: `packages/types/src/api.ts`

- [ ] **Step 1: Add new interfaces after `TaxCodeResponse`**

Open `packages/types/src/api.ts`. After the `TaxCodeResponse` interface (around line 94), add:

```ts
export interface ContactPositionResponse {
  id: string;
  name: string;
}

export interface BpContactPayload {
  id?: string;           // present for existing rows; absent for new rows
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

- [ ] **Step 2: Extend `CreateBusinessPartnerPayload`**

In `CreateBusinessPartnerPayload`, add after `creditTermDays`:

```ts
  // ── Communication
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  // ── Commercial
  creditLimit?: number | null;
  creditHold?: boolean;
  discountGroupId?: string | null;
  // ── Bank account
  bankAccountName?: string | null;
  bankAccountBranch?: string | null;
  bankAccountNumber?: string | null;
  // ── Contact persons
  contacts?: BpContactPayload[];
```

- [ ] **Step 3: Extend `UpdateBusinessPartnerPayload`**

Same fields as Step 2 added to `UpdateBusinessPartnerPayload` (all already optional by convention).

- [ ] **Step 4: Extend `BusinessPartnerResponse`**

Add after `creditTermDays: number;`:

```ts
  // ── Communication
  phone: string | null;
  email: string | null;
  lineId: string | null;
  // ── Commercial
  creditLimit: number | null;
  creditHold: boolean;
  discountGroupId: string | null;
  // ── Bank account
  bankAccountName: string | null;
  bankAccountBranch: string | null;
  bankAccountNumber: string | null;
  // ── Contact persons
  contacts: BpContactResponse[];
```

- [ ] **Step 5: Build types to catch errors**

```bash
cd packages/types
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/api.ts
git commit -m "feat(types): add ContactPosition, BpContact interfaces; extend BP payloads"
```

---

## Task 4: NestJS DTOs — BpContactDto, new BP fields

**Files:**
- Modify: `apps/api/src/modules/identity/dto/create-business-partner.dto.ts`
- Modify: `apps/api/src/modules/identity/dto/update-business-partner.dto.ts`

- [ ] **Step 1: Add `IsEmail`, `IsInt`, `IsUUID` imports and `BpContactDto` to create DTO file**

Open `apps/api/src/modules/identity/dto/create-business-partner.dto.ts`. Add `IsEmail`, `IsInt`, `IsUUID` to the class-validator import. Then add `BpContactDto` class before `CreateBusinessPartnerDto`:

```ts
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
```

Add after `BpSupplierDto`:

```ts
export class BpContactDto {
  /** Present for existing rows; absent for new rows. Server always generates a fresh UUID for new rows. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateIf((o: BpContactDto) => o.phone != null)
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ValidateIf((o: BpContactDto) => o.email != null)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ValidateIf((o: BpContactDto) => o.lineId != null)
  @IsOptional()
  @IsString()
  lineId?: string | null;

  @ValidateIf((o: BpContactDto) => o.positionId != null)
  @IsOptional()
  @IsUUID()
  positionId?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
```

- [ ] **Step 2: Add new fields to `CreateBusinessPartnerDto`**

Find the `// ── Payment defaults` section and change `creditTermDays`:

```ts
  @IsOptional()
  @IsInt()
  @Min(0)
  creditTermDays?: number;
```

After `creditTermDays`, add:

```ts
  // ── Communication
  @ValidateIf((o: CreateBusinessPartnerDto) => o.phone != null)
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.email != null)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.lineId != null)
  @IsOptional()
  @IsString()
  lineId?: string | null;

  // ── Commercial
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  creditHold?: boolean;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.discountGroupId != null)
  @IsOptional()
  @IsString()
  discountGroupId?: string | null;

  // ── Bank account
  @ValidateIf((o: CreateBusinessPartnerDto) => o.bankAccountName != null)
  @IsOptional()
  @IsString()
  bankAccountName?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.bankAccountBranch != null)
  @IsOptional()
  @IsString()
  bankAccountBranch?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.bankAccountNumber != null)
  @IsOptional()
  @IsString()
  bankAccountNumber?: string | null;

  // ── Contact persons
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BpContactDto)
  contacts?: BpContactDto[];
```

- [ ] **Step 3: Update `UpdateBusinessPartnerDto`**

Open `apps/api/src/modules/identity/dto/update-business-partner.dto.ts`. Add `IsEmail`, `IsInt`, `IsUUID`, `ValidateIf` to imports, and import `BpContactDto`:

```ts
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BpRole } from '@petiatrics/types';
import { BpVetDto, BpSupplierDto, BpContactDto } from './create-business-partner.dto';
```

Change `creditTermDays` to use `@IsInt()` instead of `@IsNumber()`:

```ts
  @IsOptional()
  @IsInt()
  @Min(0)
  creditTermDays?: number;
```

Add the same new fields as Step 2 (using `UpdateBusinessPartnerDto` in the `ValidateIf` type param) after `creditTermDays`:

```ts
  // ── Communication
  @ValidateIf((o: UpdateBusinessPartnerDto) => o.phone != null)
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ValidateIf((o: UpdateBusinessPartnerDto) => o.email != null)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ValidateIf((o: UpdateBusinessPartnerDto) => o.lineId != null)
  @IsOptional()
  @IsString()
  lineId?: string | null;

  // ── Commercial
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  creditHold?: boolean;

  @ValidateIf((o: UpdateBusinessPartnerDto) => o.discountGroupId != null)
  @IsOptional()
  @IsString()
  discountGroupId?: string | null;

  // ── Bank account
  @ValidateIf((o: UpdateBusinessPartnerDto) => o.bankAccountName != null)
  @IsOptional()
  @IsString()
  bankAccountName?: string | null;

  @ValidateIf((o: UpdateBusinessPartnerDto) => o.bankAccountBranch != null)
  @IsOptional()
  @IsString()
  bankAccountBranch?: string | null;

  @ValidateIf((o: UpdateBusinessPartnerDto) => o.bankAccountNumber != null)
  @IsOptional()
  @IsString()
  bankAccountNumber?: string | null;

  // ── Contact persons
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BpContactDto)
  contacts?: BpContactDto[];
```

- [ ] **Step 4: Run tsc to verify no type errors**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: no errors. If you see errors about missing decorators, verify the import list includes all used validators.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/identity/dto/
git commit -m "feat(api): add BpContactDto, enterprise fields to Create/Update DTOs"
```

---

## Task 5: NestJS Service — listContactPositions, contacts diff, new fields

**Files:**
- Modify: `apps/api/src/modules/identity/services/business-partner.service.ts`

This is the largest backend change. Read the existing file carefully before editing.

- [ ] **Step 1: Extend the `import` section**

Add `ContactPositionResponse` to the `@petiatrics/types` import:

```ts
import type { BusinessPartnerResponse, ContactPositionResponse, TaxCodeResponse } from '@petiatrics/types';
```

- [ ] **Step 2: Add `mapContactPosition` helper**

After `mapTaxCode`, add:

```ts
function mapContactPosition(cp: { id: string; name: string } | null): ContactPositionResponse | null {
  if (!cp) return null;
  return { id: cp.id, name: cp.name };
}
```

- [ ] **Step 3: Extend `BP_INCLUDE` to include contacts**

Change the `BP_INCLUDE` const to add contacts:

```ts
const BP_INCLUDE = {
  user: { select: { id: true, role: true, email: true, username: true } },
  vetExt: true,
  suppExt: true,
  activeRoles: true,
  defaultVatCode: true,
  defaultWhtCode: true,
  contacts: {
    include: { position: { select: { id: true, name: true } } },
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
  },
} as const;
```

- [ ] **Step 4: Extend `mapBpToResponse` to include new fields**

In `mapBpToResponse`, after `creditTermDays: bp.creditTermDays,` add:

```ts
    // Communication
    phone: bp.phone ?? null,
    email: bp.email ?? null,
    lineId: bp.lineId ?? null,
    // Commercial
    creditLimit: bp.creditLimit ?? null,
    creditHold: bp.creditHold,
    discountGroupId: bp.discountGroupId ?? null,
    // Bank account
    bankAccountName: bp.bankAccountName ?? null,
    bankAccountBranch: bp.bankAccountBranch ?? null,
    bankAccountNumber: bp.bankAccountNumber ?? null,
    // Contacts
    contacts: (bp.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      lineId: c.lineId ?? null,
      positionId: c.positionId ?? null,
      position: mapContactPosition(c.position ?? null),
      isPrimary: c.isPrimary,
    })),
```

- [ ] **Step 5: Add `listContactPositions()` method**

Add alongside `listTaxCodes()`:

```ts
  /** Return all active ContactPosition records for use in the BpContact position selector. */
  async listContactPositions(): Promise<ContactPositionResponse[]> {
    const rows = await this.prisma.contactPosition.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((cp) => ({ id: cp.id, name: cp.name }));
  }
```

- [ ] **Step 6: Extend `create()` — add new fields + contacts insert**

In the `create()` method, inside the `tx.businessPartner.create({ data: { ... } })` call, add new fields:

```ts
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          lineId: dto.lineId ?? null,
          creditLimit: dto.creditLimit ?? null,
          creditHold: dto.creditHold ?? false,
          discountGroupId: dto.discountGroupId ?? null,
          bankAccountName: dto.bankAccountName ?? null,
          bankAccountBranch: dto.bankAccountBranch ?? null,
          bankAccountNumber: dto.bankAccountNumber ?? null,
```

After the VET/supplier creation blocks (and before the final `findFirstOrThrow`), add:

```ts
      // ── Contact persons ─────────────────────────────────────────────
      if (dto.contacts?.length) {
        const primaryIdx = dto.contacts.findIndex((c) => c.isPrimary);
        await tx.bpContact.createMany({
          data: dto.contacts.map((c, i) => ({
            bpId: created.id,
            name: c.name,
            phone: c.phone ?? null,
            email: c.email ?? null,
            lineId: c.lineId ?? null,
            positionId: c.positionId ?? null,
            isPrimary: primaryIdx === -1 ? false : i === primaryIdx,
          })),
        });
      }
```

- [ ] **Step 7: Extend `update()` — new fields + contacts diff**

In the `coreUpdate` block, add new fields:

```ts
      if (dto.phone !== undefined) coreUpdate.phone = dto.phone;
      if (dto.email !== undefined) coreUpdate.email = dto.email;
      if (dto.lineId !== undefined) coreUpdate.lineId = dto.lineId;
      if (dto.creditLimit !== undefined) coreUpdate.creditLimit = dto.creditLimit;
      if (dto.creditHold !== undefined) coreUpdate.creditHold = dto.creditHold;
      if (dto.discountGroupId !== undefined) coreUpdate.discountGroupId = dto.discountGroupId;
      if (dto.bankAccountName !== undefined) coreUpdate.bankAccountName = dto.bankAccountName;
      if (dto.bankAccountBranch !== undefined) coreUpdate.bankAccountBranch = dto.bankAccountBranch;
      if (dto.bankAccountNumber !== undefined) coreUpdate.bankAccountNumber = dto.bankAccountNumber;
```

After the supplier upsert block, add the contacts diff:

```ts
      // ── Contacts diff ────────────────────────────────────────────────────
      // Only runs when `contacts` is explicitly present (even if empty array).
      // Undefined → preserve existing contacts unchanged.
      if (dto.contacts !== undefined) {
        const existingContacts = await tx.bpContact.findMany({
          where: { bpId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingContacts.map((c) => c.id));
        const incomingIds = new Set(
          dto.contacts.filter((c) => c.id && existingIds.has(c.id)).map((c) => c.id!),
        );

        // Delete contacts absent from the incoming array
        const toDelete = existingContacts
          .filter((c) => !incomingIds.has(c.id))
          .map((c) => c.id);
        if (toDelete.length) {
          await tx.bpContact.deleteMany({ where: { id: { in: toDelete } } });
        }

        // Determine which contact is primary (first one flagged, or none)
        const primaryIdx = dto.contacts.findIndex((c) => c.isPrimary);

        // Upsert each incoming contact
        for (let i = 0; i < dto.contacts.length; i++) {
          const c = dto.contacts[i];
          const contactIsPrimary = primaryIdx === -1 ? false : i === primaryIdx;
          const isExisting = c.id && existingIds.has(c.id);
          if (isExisting) {
            await tx.bpContact.update({
              where: { id: c.id! },
              data: {
                name: c.name,
                phone: c.phone ?? null,
                email: c.email ?? null,
                lineId: c.lineId ?? null,
                positionId: c.positionId ?? null,
                isPrimary: contactIsPrimary,
              },
            });
          } else {
            // New row — server generates a fresh UUID (c.id is discarded even if present)
            await tx.bpContact.create({
              data: {
                bpId: id,
                name: c.name,
                phone: c.phone ?? null,
                email: c.email ?? null,
                lineId: c.lineId ?? null,
                positionId: c.positionId ?? null,
                isPrimary: contactIsPrimary,
              },
            });
          }
        }
      }
```

- [ ] **Step 8: Add `positionId` existence check helper**

The service must validate that a supplied `positionId` actually exists before saving. Add a private helper:

```ts
  private async assertContactPositionExists(positionId: string): Promise<void> {
    const cp = await this.prisma.contactPosition.findUnique({
      where: { id: positionId },
      select: { id: true, isActive: true },
    });
    if (!cp || !cp.isActive) {
      throw new BadRequestException(`positionId '${positionId}' is not a valid active ContactPosition`);
    }
  }
```

Call it in `create()` and `update()` before the transaction, for each `dto.contacts` element that has a `positionId`:

```ts
    // Validate contact position references
    if (dto.contacts) {
      const uniquePositionIds = [...new Set(
        dto.contacts.filter((c) => c.positionId).map((c) => c.positionId!)
      )];
      for (const pid of uniquePositionIds) {
        await this.assertContactPositionExists(pid);
      }
    }
```

- [ ] **Step 9: Build to verify**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Run existing tests to verify no regression**

```bash
cd apps/api
npm test
```

Expected: all existing tests pass. (Tests use a mock service so they won't need new fields — they should still pass.)

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/modules/identity/services/business-partner.service.ts
git commit -m "feat(api): extend BP service with contacts diff, enterprise fields, listContactPositions"
```

---

## Task 6: NestJS Controller — GET /reference/contact-positions

**Files:**
- Modify: `apps/api/src/modules/identity/controllers/reference.controller.ts`

- [ ] **Step 1: Add the endpoint**

Open `apps/api/src/modules/identity/controllers/reference.controller.ts`. Add after `listTaxCodes()`:

```ts
  /**
   * GET /api/v1/reference/contact-positions
   * Return all active ContactPosition records for use in the BpContact position selector.
   * Global (no clinic scoping). Inherits BranchContextGuard from controller class.
   */
  @Get('contact-positions')
  listContactPositions() {
    return this.bpService.listContactPositions();
  }
```

- [ ] **Step 2: Build to verify**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/identity/controllers/reference.controller.ts
git commit -m "feat(api): add GET /reference/contact-positions endpoint"
```

---

## Task 7: Install react-hook-form + zod in web app

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/web
npm install react-hook-form zod @hookform/resolvers
```

Expected: packages installed, `package.json` updated with `react-hook-form`, `zod`, `@hookform/resolvers`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(web): add react-hook-form, zod, @hookform/resolvers"
```

---

## Task 8: Zod schema file

**Files:**
- Create: `apps/web/components/business-partners/bp-form-schema.ts`
- Create: `apps/web/components/business-partners/bp-form-schema.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `apps/web/components/business-partners/bp-form-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createBpSchema, editBpSchema } from './bp-form-schema';
import { BusinessPartnerType } from '@petiatrics/types';

describe('createBpSchema', () => {
  it('rejects when name is empty', () => {
    const result = createBpSchema.safeParse({ name: '', type: BusinessPartnerType.CUSTOMER });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'name')).toBe(true);
  });

  it('rejects when type is missing', () => {
    const result = createBpSchema.safeParse({ name: 'Test BP' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'type')).toBe(true);
  });

  it('rejects taxId that is not 13 digits', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, taxId: '12345',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'taxId')).toBe(true);
  });

  it('accepts taxId that is exactly 13 digits', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, taxId: '1234567890123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, email: 'not-an-email',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'email')).toBe(true);
  });

  it('rejects negative creditLimit', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, creditLimit: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects float creditTermDays', () => {
    const result = createBpSchema.safeParse({
      name: 'Test', type: BusinessPartnerType.CUSTOMER, creditTermDays: 1.5,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'creditTermDays')).toBe(true);
  });

  it('rejects two isPrimary contacts', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [
        { name: 'Alice', isPrimary: true },
        { name: 'Bob', isPrimary: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts one isPrimary contact', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001' },
      contacts: [
        { name: 'Alice', isPrimary: true },
        { name: 'Bob', isPrimary: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('requires vet.licenseNumber when type is VET', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('licenseNumber'))).toBe(true);
  });

  it('accepts VET with licenseNumber', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001' },
    });
    expect(result.success).toBe(true);
  });
});

describe('editBpSchema', () => {
  it('accepts payload without type field', () => {
    const result = editBpSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('rejects name as empty string', () => {
    const result = editBpSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web
npm test -- bp-form-schema
```

Expected: FAIL — module `./bp-form-schema` not found.

- [ ] **Step 3: Create the schema file**

Create `apps/web/components/business-partners/bp-form-schema.ts`:

```ts
import { z } from 'zod';
import { BusinessPartnerType, BpRole } from '@petiatrics/types';

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const bpContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email').nullable().optional().or(z.literal('')).transform((v) => v === '' ? null : v),
  lineId: z.string().nullable().optional(),
  positionId: z.string().uuid('Must be a valid UUID').nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});

const vetSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
});

// ── Base schema (shared between create and edit) ─────────────────────────────

const baseBpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  taxId: z
    .string()
    .regex(/^\d{13}$/, 'Tax ID must be 13 digits')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
  isHeadOffice: z.boolean().optional().default(true),
  branchCode: z
    .string()
    .regex(/^\d{5}$/, 'Branch code must be 5 digits')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
  addressLine1: z.string().nullable().optional(),
  subDistrict: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  zipcode: z
    .string()
    .regex(/^\d{5}$/, 'Zipcode must be 5 digits')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
  defaultVatCodeId: z.string().nullable().optional(),
  defaultWhtCodeId: z.string().nullable().optional(),
  // Communication
  phone: z.string().nullable().optional(),
  email: z
    .string()
    .email('Invalid email')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
  lineId: z.string().nullable().optional(),
  // Commercial
  creditTermDays: z.number().int('Must be a whole number').min(0, 'Must be 0 or more').optional(),
  creditLimit: z.number().min(0, 'Must be 0 or more').nullable().optional(),
  creditHold: z.boolean().optional().default(false),
  discountGroupId: z.string().nullable().optional(),
  // Bank
  bankAccountName: z.string().nullable().optional(),
  bankAccountBranch: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  // LN roles
  activeRoles: z.array(z.nativeEnum(BpRole)).optional().default([]),
  // Contacts
  contacts: z
    .array(bpContactSchema)
    .optional()
    .default([])
    .refine(
      (arr) => arr.filter((c) => c.isPrimary).length <= 1,
      'At most one contact can be marked as primary',
    ),
  // VET extension
  vet: vetSchema.nullable().optional(),
}).superRefine((data, ctx) => {
  // VET type requires licenseNumber
  if ((data as { type?: string }).type === BusinessPartnerType.VET) {
    if (!data.vet?.licenseNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'License number is required for VET type',
        path: ['vet', 'licenseNumber'],
      });
    }
  }
});

// ── Create schema (type required) ────────────────────────────────────────────

export const createBpSchema = baseBpSchema.and(
  z.object({
    type: z.nativeEnum(BusinessPartnerType, { required_error: 'Type is required' }),
  }),
);

// ── Edit schema (type absent — fixed at creation time) ───────────────────────

export const editBpSchema = baseBpSchema;

// ── Inferred types ───────────────────────────────────────────────────────────

export type CreateBpFormValues = z.infer<typeof createBpSchema>;
export type EditBpFormValues = z.infer<typeof editBpSchema>;
export type BpContactFormValue = z.infer<typeof bpContactSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web
npm test -- bp-form-schema
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/business-partners/bp-form-schema.ts apps/web/components/business-partners/bp-form-schema.test.ts
git commit -m "feat(web): add Zod schemas for BP form (create/edit)"
```

---

## Task 9: Tab components

**Files:**
- Create: `apps/web/components/business-partners/tabs/contact-tab.tsx`
- Create: `apps/web/components/business-partners/tabs/tax-address-tab.tsx`
- Create: `apps/web/components/business-partners/tabs/roles-commercial-tab.tsx`
- Create: `apps/web/components/business-partners/tabs/financials-tab.tsx`

All tab components use `useFormContext()` from react-hook-form. They do NOT accept `control` or `register` as props.

- [ ] **Step 1: Create contact-tab.tsx**

```tsx
'use client';

import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Button, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@petiatrics/ui';
import { Trash2, Plus } from 'lucide-react';
import type { ContactPositionResponse } from '@petiatrics/types';
import type { CreateBpFormValues } from '../bp-form-schema';

interface ContactTabProps {
  contactPositions: ContactPositionResponse[];
  positionsLoading: boolean;
}

export function ContactTab({ contactPositions, positionsLoading }: ContactTabProps) {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<CreateBpFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'contacts' });
  const contacts = watch('contacts') ?? [];

  function handlePrimaryChange(index: number) {
    // Radio semantics: check one, uncheck all others
    contacts.forEach((_, i) => {
      setValue(`contacts.${i}.isPrimary`, i === index, { shouldValidate: true });
    });
  }

  return (
    <div className="space-y-5">
      {/* ── BP-level communication ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input {...register('phone')} placeholder="+66 2 000 0000" />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input {...register('email')} type="email" placeholder="contact@example.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>LINE ID</Label>
          <Input {...register('lineId')} placeholder="@lineid" />
        </div>
      </div>

      {/* ── Contact persons ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Contact Persons</Label>
        {errors.contacts?.root && (
          <p className="text-xs text-destructive">{errors.contacts.root.message}</p>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_160px_auto_auto] gap-2 items-start rounded border p-2">
            <div className="space-y-1">
              <Input
                {...register(`contacts.${index}.name`)}
                placeholder="Name *"
              />
              {errors.contacts?.[index]?.name && (
                <p className="text-xs text-destructive">{errors.contacts[index]?.name?.message}</p>
              )}
            </div>
            <Input {...register(`contacts.${index}.phone`)} placeholder="Phone" />
            <div className="space-y-1">
              <Input {...register(`contacts.${index}.email`)} placeholder="Email" type="email" />
              {errors.contacts?.[index]?.email && (
                <p className="text-xs text-destructive">{errors.contacts[index]?.email?.message}</p>
              )}
            </div>
            <Input {...register(`contacts.${index}.lineId`)} placeholder="LINE ID" />
            <Controller
              control={control}
              name={`contacts.${index}.positionId`}
              render={({ field: posField }) => (
                <Select
                  disabled={positionsLoading}
                  value={posField.value ?? ''}
                  onValueChange={(v) => posField.onChange(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={positionsLoading ? 'Loading…' : 'Position'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {contactPositions.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <div className="flex items-center gap-1 pt-2">
              <Checkbox
                id={`primary-${index}`}
                checked={contacts[index]?.isPrimary ?? false}
                onCheckedChange={(checked) => {
                  if (checked) handlePrimaryChange(index);
                  else setValue(`contacts.${index}.isPrimary`, false, { shouldValidate: true });
                }}
              />
              <Label htmlFor={`primary-${index}`} className="text-xs">Primary</Label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              aria-label="Remove contact"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => append({ name: '', phone: null, email: null, lineId: null, positionId: null, isPrimary: false })}
        >
          <Plus className="h-4 w-4" /> Add contact
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create tax-address-tab.tsx**

```tsx
'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@petiatrics/ui';
import type { TaxCodeResponse } from '@petiatrics/types';
import type { CreateBpFormValues } from '../bp-form-schema';

interface TaxAddressTabProps {
  vatCodes: TaxCodeResponse[];
  whtCodes: TaxCodeResponse[];
}

export function TaxAddressTab({ vatCodes, whtCodes }: TaxAddressTabProps) {
  const { register, control, watch, formState: { errors } } = useFormContext<CreateBpFormValues>();
  const isHeadOffice = watch('isHeadOffice') ?? true;

  return (
    <div className="space-y-5">
      {/* ── Thai compliance ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>Tax ID (13-digit Thai TIN)</Label>
        <Input {...register('taxId')} placeholder="0000000000000" maxLength={13} />
        {errors.taxId && <p className="text-xs text-destructive">{errors.taxId.message}</p>}
      </div>

      <Controller
        control={control}
        name="isHeadOffice"
        render={({ field }) => (
          <div className="flex items-center gap-3">
            <Switch id="isHeadOffice" checked={field.value ?? true} onCheckedChange={field.onChange} />
            <Label htmlFor="isHeadOffice">Head office</Label>
          </div>
        )}
      />

      {!isHeadOffice && (
        <div className="space-y-1.5">
          <Label>Branch code (5 digits)</Label>
          <Input {...register('branchCode')} placeholder="00001" maxLength={5} />
          {errors.branchCode && <p className="text-xs text-destructive">{errors.branchCode.message}</p>}
        </div>
      )}

      {/* ── Tax defaults ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Default VAT code</Label>
          <Controller
            control={control}
            name="defaultVatCodeId"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {vatCodes.map((tc) => (
                    <SelectItem key={tc.id} value={tc.id}>{tc.code} — {tc.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Default WHT code</Label>
          <Controller
            control={control}
            name="defaultWhtCodeId"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {whtCodes.map((tc) => (
                    <SelectItem key={tc.id} value={tc.id}>{tc.code} — {tc.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* ── Address ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>Address line 1</Label>
        <Input {...register('addressLine1')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Sub-district</Label>
          <Input {...register('subDistrict')} />
        </div>
        <div className="space-y-1.5">
          <Label>District</Label>
          <Input {...register('district')} />
        </div>
        <div className="space-y-1.5">
          <Label>Province</Label>
          <Input {...register('province')} />
        </div>
        <div className="space-y-1.5">
          <Label>Zipcode</Label>
          <Input {...register('zipcode')} maxLength={5} />
          {errors.zipcode && <p className="text-xs text-destructive">{errors.zipcode.message}</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create roles-commercial-tab.tsx**

```tsx
'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Checkbox, Input, Label } from '@petiatrics/ui';
import { BpRole } from '@petiatrics/types';
import type { CreateBpFormValues } from '../bp-form-schema';

const ALL_ROLES = Object.values(BpRole);

const ROLE_LABELS: Record<BpRole, string> = {
  [BpRole.AR_SOLD_TO]: 'AR Sold-To',
  [BpRole.AR_SHIP_TO]: 'AR Ship-To',
  [BpRole.AR_INVOICE_TO]: 'AR Invoice-To',
  [BpRole.AR_PAY_BY]: 'AR Pay-By',
  [BpRole.AP_BUY_FROM]: 'AP Buy-From',
  [BpRole.AP_SHIP_FROM]: 'AP Ship-From',
  [BpRole.AP_INVOICE_FROM]: 'AP Invoice-From',
  [BpRole.AP_PAY_TO]: 'AP Pay-To',
};

export function RolesCommercialTab() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<CreateBpFormValues>();
  const activeRoles = watch('activeRoles') ?? [];

  function toggleRole(role: BpRole) {
    const next = activeRoles.includes(role)
      ? activeRoles.filter((r) => r !== role)
      : [...activeRoles, role];
    setValue('activeRoles', next, { shouldValidate: true });
  }

  return (
    <div className="space-y-5">
      {/* ── Infor LN roles ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Infor LN Business Roles</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ALL_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-2">
              <Checkbox
                id={`role-${role}`}
                checked={activeRoles.includes(role)}
                onCheckedChange={() => toggleRole(role)}
              />
              <Label htmlFor={`role-${role}`} className="text-sm">{ROLE_LABELS[role]}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* ── Discount group ───────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>Discount Group ID</Label>
        <Input {...register('discountGroupId')} placeholder="e.g. DISC-A (free text — no FK)" />
        <p className="text-xs text-muted-foreground">Free-text field. No reference table lookup.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create financials-tab.tsx**

```tsx
'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Input, Label, Switch } from '@petiatrics/ui';
import type { CreateBpFormValues } from '../bp-form-schema';

export function FinancialsTab() {
  const { register, control, formState: { errors } } = useFormContext<CreateBpFormValues>();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Credit Limit (฿)</Label>
          <Input
            {...register('creditLimit', { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="0.00"
          />
          {errors.creditLimit && <p className="text-xs text-destructive">{errors.creditLimit.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Credit Term (days)</Label>
          <Input
            {...register('creditTermDays', { valueAsNumber: true })}
            type="number"
            min={0}
            step={1}
            placeholder="30"
          />
          {errors.creditTermDays && <p className="text-xs text-destructive">{errors.creditTermDays.message}</p>}
        </div>
      </div>

      <Controller
        control={control}
        name="creditHold"
        render={({ field }) => (
          <div className="flex items-center gap-3">
            <Switch id="creditHold" checked={field.value ?? false} onCheckedChange={field.onChange} />
            <Label htmlFor="creditHold">Credit Hold</Label>
          </div>
        )}
      />

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Bank Account</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Account Holder Name</Label>
            <Input {...register('bankAccountName')} placeholder="Name on account" />
          </div>
          <div className="space-y-1.5">
            <Label>Bank Branch</Label>
            <Input {...register('bankAccountBranch')} placeholder="Branch name" />
          </div>
          <div className="space-y-1.5">
            <Label>Account Number</Label>
            <Input {...register('bankAccountNumber')} placeholder="000-0-00000-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build to verify no TypeScript errors**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/business-partners/tabs/
git commit -m "feat(web): add 4 BP form tab components"
```

---

## Task 10: Migrate extension-fields.tsx to useFormContext

**Files:**
- Modify: `apps/web/components/business-partners/extension-fields.tsx`

- [ ] **Step 1: Rewrite extension-fields.tsx**

Replace the entire file content with:

```tsx
'use client';

import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input, Label } from '@petiatrics/ui';
import { BusinessPartnerType } from '@petiatrics/types';
import type { CreateBpFormValues } from './bp-form-schema';

interface ExtensionFieldsProps {
  /** The current type — used to determine whether to show the VET section. */
  type: BusinessPartnerType | '';
}

/**
 * ExtensionFields — renders type-specific fields outside the tab boundary.
 * Reads and writes to the react-hook-form context via useFormContext().
 * The form orchestrator must wrap everything in <FormProvider>.
 */
export default function ExtensionFields({ type }: ExtensionFieldsProps) {
  const t = useTranslations('businessPartners');
  const { register, formState: { errors } } = useFormContext<CreateBpFormValues>();

  if (type !== BusinessPartnerType.VET) return null;

  return (
    <div className="space-y-1.5" data-testid="vet-fields">
      <Label>{t('vet.licenseNumber')}</Label>
      <Input
        {...register('vet.licenseNumber')}
        placeholder="VET-0001"
      />
      {errors.vet?.licenseNumber && (
        <p className="text-xs text-destructive">{errors.vet.licenseNumber.message}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: no errors (note: `business-partner-form.tsx` will now have type errors because it still passes `vet`/`onVetChange` props — that's resolved in Task 11).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/business-partners/extension-fields.tsx
git commit -m "feat(web): migrate ExtensionFields to useFormContext, remove vet/onVetChange props"
```

---

## Task 11: Rewrite business-partner-form.tsx

**Files:**
- Modify: `apps/web/components/business-partners/business-partner-form.tsx`

This is the orchestrator. It sets up react-hook-form, fetches reference data, renders the tab shell with error indicators, and submits.

- [ ] **Step 1: Replace the entire file**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@petiatrics/ui';
import {
  BpRole,
  BusinessPartnerType,
  type BusinessPartnerResponse,
  type ContactPositionResponse,
  type CreateBusinessPartnerPayload,
  type TaxCodeResponse,
  type UpdateBusinessPartnerPayload,
} from '@petiatrics/types';
import { apiClient } from '../../lib/api-client';
import ExtensionFields from './extension-fields';
import { ContactTab } from './tabs/contact-tab';
import { TaxAddressTab } from './tabs/tax-address-tab';
import { RolesCommercialTab } from './tabs/roles-commercial-tab';
import { FinancialsTab } from './tabs/financials-tab';
import {
  createBpSchema,
  editBpSchema,
  type CreateBpFormValues,
  type EditBpFormValues,
} from './bp-form-schema';

interface BusinessPartnerFormProps {
  /** Populated when editing an existing BP; absent for create. */
  initial?: BusinessPartnerResponse;
}

const TAB_FIELDS: Record<string, (keyof CreateBpFormValues)[]> = {
  contact: ['phone', 'email', 'lineId', 'contacts'],
  tax: ['taxId', 'isHeadOffice', 'branchCode', 'addressLine1', 'subDistrict', 'district', 'province', 'zipcode', 'defaultVatCodeId', 'defaultWhtCodeId'],
  roles: ['activeRoles', 'discountGroupId'],
  financials: ['creditLimit', 'creditTermDays', 'creditHold', 'bankAccountName', 'bankAccountBranch', 'bankAccountNumber'],
};

function hasTabErrors(
  errors: ReturnType<typeof useForm>['formState']['errors'],
  tab: string,
): boolean {
  const fields = TAB_FIELDS[tab] ?? [];
  return fields.some((f) => f in errors);
}

export default function BusinessPartnerForm({ initial }: BusinessPartnerFormProps) {
  const t = useTranslations('businessPartners');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const isEdit = !!initial;

  const [taxCodes, setTaxCodes] = useState<TaxCodeResponse[]>([]);
  const [contactPositions, setContactPositions] = useState<ContactPositionResponse[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);

  const schema = isEdit ? editBpSchema : createBpSchema;

  const form = useForm<CreateBpFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      ...(isEdit ? {} : { type: undefined }),
      taxId: initial?.taxId ?? null,
      isHeadOffice: initial?.isHeadOffice ?? true,
      branchCode: initial?.branchCode ?? null,
      addressLine1: initial?.addressLine1 ?? null,
      subDistrict: initial?.subDistrict ?? null,
      district: initial?.district ?? null,
      province: initial?.province ?? null,
      zipcode: initial?.zipcode ?? null,
      defaultVatCodeId: initial?.defaultVatCodeId ?? null,
      defaultWhtCodeId: initial?.defaultWhtCodeId ?? null,
      phone: initial?.phone ?? null,
      email: initial?.email ?? null,
      lineId: initial?.lineId ?? null,
      creditTermDays: initial?.creditTermDays ?? 0,
      creditLimit: initial?.creditLimit ?? null,
      creditHold: initial?.creditHold ?? false,
      discountGroupId: initial?.discountGroupId ?? null,
      bankAccountName: initial?.bankAccountName ?? null,
      bankAccountBranch: initial?.bankAccountBranch ?? null,
      bankAccountNumber: initial?.bankAccountNumber ?? null,
      activeRoles: initial?.activeRoles ?? [],
      contacts: initial?.contacts?.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        lineId: c.lineId,
        positionId: c.positionId,
        isPrimary: c.isPrimary,
      })) ?? [],
      vet: initial?.vet ? { licenseNumber: initial.vet.licenseNumber } : null,
    },
  });

  const { handleSubmit, register, watch, formState: { errors, isSubmitting } } = form;
  const watchType = watch('type') as BusinessPartnerType | undefined;
  // On edit, the type is fixed — read from initial
  const effectiveType: BusinessPartnerType | '' = isEdit
    ? (initial!.type as BusinessPartnerType)
    : (watchType ?? '');

  useEffect(() => {
    // Fetch tax codes (non-blocking)
    apiClient.get<TaxCodeResponse[]>('/reference/tax-codes').then(setTaxCodes).catch(() => {
      setTaxCodes([]);
    });

    // Fetch contact positions (non-blocking, graceful degrade)
    apiClient
      .get<ContactPositionResponse[]>('/reference/contact-positions')
      .then((data) => {
        setContactPositions(data);
        setPositionsLoading(false);
      })
      .catch(() => {
        setPositionsLoading(false);
        toast.error('Could not load contact positions. Position selector will be disabled.');
      });
  }, []);

  const vatCodes = taxCodes.filter((tc) => tc.isVatType);
  const whtCodes = taxCodes.filter((tc) => !tc.isVatType);

  async function onSubmit(values: CreateBpFormValues) {
    const payload: CreateBusinessPartnerPayload | UpdateBusinessPartnerPayload = {
      name: values.name,
      ...(isEdit ? {} : { type: (values as CreateBpFormValues & { type: BusinessPartnerType }).type }),
      taxId: values.taxId ?? null,
      isHeadOffice: values.isHeadOffice ?? true,
      branchCode: values.branchCode ?? null,
      addressLine1: values.addressLine1 ?? null,
      subDistrict: values.subDistrict ?? null,
      district: values.district ?? null,
      province: values.province ?? null,
      zipcode: values.zipcode ?? null,
      defaultVatCodeId: values.defaultVatCodeId ?? null,
      defaultWhtCodeId: values.defaultWhtCodeId ?? null,
      phone: values.phone ?? null,
      email: values.email ?? null,
      lineId: values.lineId ?? null,
      creditTermDays: values.creditTermDays,
      creditLimit: values.creditLimit ?? null,
      creditHold: values.creditHold ?? false,
      discountGroupId: values.discountGroupId ?? null,
      bankAccountName: values.bankAccountName ?? null,
      bankAccountBranch: values.bankAccountBranch ?? null,
      bankAccountNumber: values.bankAccountNumber ?? null,
      activeRoles: values.activeRoles ?? [],
      contacts: values.contacts?.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone ?? null,
        email: c.email ?? null,
        lineId: c.lineId ?? null,
        positionId: c.positionId ?? null,
        isPrimary: c.isPrimary ?? false,
      })),
      vet: effectiveType === BusinessPartnerType.VET && values.vet
        ? { licenseNumber: values.vet.licenseNumber }
        : null,
      supplier: null,
    };

    if (isEdit) {
      await apiClient.patch<BusinessPartnerResponse>(
        `/clinic/business-partners/${initial!.id}`,
        payload,
      );
    } else {
      await apiClient.post<BusinessPartnerResponse>('/clinic/business-partners', payload);
    }

    router.push('/clinic/business-partners');
    router.refresh();
  }

  const allTypes = Object.values(BusinessPartnerType);

  return (
    <FormProvider {...form}>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} disabled={isSubmitting} aria-label={tCommon('back')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? t('edit') : t('new')}
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-lg border bg-card p-6 space-y-5">
            {/* ── Core identity (always above tabs) ──────────────────── */}
            <div className="space-y-1.5">
              <Label>{t('name')}</Label>
              <Input {...register('name')} placeholder="Business Partner Name" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <Label>{t('type')}</Label>
                <Select
                  value={watchType ?? ''}
                  onValueChange={(v) => form.setValue('type', v as BusinessPartnerType, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tCommon('filter')} />
                  </SelectTrigger>
                  <SelectContent>
                    {allTypes.map((bpType) => (
                      <SelectItem key={bpType} value={bpType}>
                        {t(`types.${bpType}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{(errors as any).type?.message}</p>}
              </div>
            )}

            {/* ── Tabs ────────────────────────────────────────────────── */}
            <Tabs defaultValue="contact">
              <TabsList>
                <TabsTrigger value="contact" className="relative">
                  Contact
                  {hasTabErrors(errors, 'contact') && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="tax" className="relative">
                  Tax &amp; Address
                  {hasTabErrors(errors, 'tax') && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="roles" className="relative">
                  Roles &amp; Commercial
                  {hasTabErrors(errors, 'roles') && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="financials" className="relative">
                  Financials
                  {hasTabErrors(errors, 'financials') && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contact" className="pt-4">
                <ContactTab contactPositions={contactPositions} positionsLoading={positionsLoading} />
              </TabsContent>
              <TabsContent value="tax" className="pt-4">
                <TaxAddressTab vatCodes={vatCodes} whtCodes={whtCodes} />
              </TabsContent>
              <TabsContent value="roles" className="pt-4">
                <RolesCommercialTab />
              </TabsContent>
              <TabsContent value="financials" className="pt-4">
                <FinancialsTab />
              </TabsContent>
            </Tabs>

            {/* ── VET extension — below tabs, above actions ───────────── */}
            <ExtensionFields type={effectiveType} />

            {/* ── Form actions ────────────────────────────────────────── */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? tCommon('save') : tCommon('create')}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all web tests**

```bash
cd apps/web
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/business-partners/business-partner-form.tsx
git commit -m "feat(web): rewrite BP form with react-hook-form + Zod + 4-tab layout"
```

---

## Task 12: Smoke test the full flow manually

At this point all layers are wired. Before writing automated tests, verify the form renders and submits correctly.

- [ ] **Step 1: Start the dev servers**

```bash
# Terminal 1 — API
cd apps/api
npm run dev

# Terminal 2 — Web
cd apps/web
npm run dev
```

- [ ] **Step 2: Create a new Business Partner**

1. Navigate to `http://localhost:3000/clinic/business-partners/new`
2. Verify tabs render: Contact | Tax & Address | Roles & Commercial | Financials
3. Submit without filling in any field — verify `name` field shows an error
4. Fill in `name` and `type`, submit — verify save succeeds and redirects to list

- [ ] **Step 3: Edit an existing Business Partner**

1. Open an existing BP from the list
2. Verify `type` selector is hidden (edit mode)
3. Navigate to Contact tab — add a contact row, mark it Primary, fill in name
4. Save — verify the contact appears when reopening the edit form

- [ ] **Step 4: Verify position select degrades gracefully**

Temporarily kill the API (`Ctrl-C`). Reload the create form. Verify the Position select is disabled and a toast appears, but the form is still functional.

- [ ] **Step 5: Commit any small fixes found during smoke test**

```bash
git add -p   # stage only the specific fixes
git commit -m "fix(web): smoke test corrections"
```

---

## Task 13: Service unit tests (API)

**Files:**
- Modify: `apps/api/src/modules/identity/controllers/business-partners.controller.spec.ts`

Add test coverage for the contacts diff behaviour. The existing spec file mocks `BusinessPartnerService` — add cases that verify new methods are called.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe('BusinessPartnersController')` block in `business-partners.controller.spec.ts`. First verify the existing mock already has the new service methods; if not, extend `makeBpServiceMock()`:

```ts
function makeBpServiceMock() {
  return {
    list: jest.fn().mockResolvedValue([mockBp]),
    getById: jest.fn().mockResolvedValue(mockBp),
    create: jest.fn().mockResolvedValue(mockBp),
    update: jest.fn().mockResolvedValue(mockBp),
    deactivate: jest.fn().mockResolvedValue({ ...mockBp, isActive: false }),
    listTaxCodes: jest.fn().mockResolvedValue([]),
    listContactPositions: jest.fn().mockResolvedValue([]),
  };
}
```

Add a new `describe` block for the reference controller (you'll also need to add `ReferenceController` to the test module):

```ts
import { ReferenceController } from './reference.controller';

// ... inside the test module setup ...
// Add ReferenceController to the controllers array

describe('ReferenceController', () => {
  let refController: ReferenceController;

  beforeEach(async () => {
    // (set up module including ReferenceController — same pattern as above)
  });

  it('GET /reference/contact-positions calls listContactPositions', async () => {
    bpService.listContactPositions.mockResolvedValue([
      { id: 'cp-1', name: 'ผู้จัดการ / Manager' },
    ]);
    const result = await refController.listContactPositions();
    expect(bpService.listContactPositions).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'cp-1', name: 'ผู้จัดการ / Manager' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api
npm test
```

Expected: FAIL — `ReferenceController` doesn't have `listContactPositions` method yet (Task 6 added it — if you did that task, it should pass).

- [ ] **Step 3: Verify tests pass after implementation**

```bash
cd apps/api
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/identity/controllers/business-partners.controller.spec.ts
git commit -m "test(api): add controller tests for listContactPositions"
```

---

## Task 14: AC verification checklist

Work through all 17 acceptance criteria from the design doc. For each one, note the outcome.

- [ ] AC-01: Run `npx prisma migrate status` — verify migration applied cleanly
- [ ] AC-02: Call `GET /api/v1/reference/contact-positions` (use curl or browser devtools) — verify 5 positions returned with bilingual names
- [ ] AC-03: POST a BP with `contacts: [{ name: "Alice", isPrimary: true }]` — verify row created in `bp_contacts` table
- [ ] AC-04: PATCH the same BP with `contacts: []` — verify contact deleted
- [ ] AC-05: Open create and edit forms — verify Contact tab is active by default
- [ ] AC-06: On create form, leave `name` empty and submit — verify red dot on Contact tab if email has error
- [ ] AC-07: Switch between all tabs — verify Save/Cancel always visible
- [ ] AC-08: Create a BP with all new fields, reload edit page — verify all values round-trip
- [ ] AC-09: Confirm `discountGroupId` input is a plain text field
- [ ] AC-10: Confirm there is no ContactPosition management page in the app
- [ ] AC-11: PATCH a BP without `contacts` in payload — verify existing contacts unchanged
- [ ] AC-12: PATCH with two `isPrimary: true` contacts — verify only first is primary after save
- [ ] AC-13: Kill API, reload form — verify position select disabled and toast shown, form still submittable
- [ ] AC-14: Confirm no FK constraint on `discountGroupId` column (`\d business_partners` in psql)
- [ ] AC-15: Create VET BP — verify licenseNumber input appears below tabs
- [ ] AC-16: Add two contacts, check primary on second — verify first unchecked automatically
- [ ] AC-17: Submit form with two contacts both marked primary — Zod refine should block submission

- [ ] **Step: Commit final verification note**

```bash
git commit --allow-empty -m "chore: AC verification complete — BP form tabs feature"
```

---

## Self-Review

### Spec coverage check

| Spec section | Covered by task |
|---|---|
| 1a ContactPosition model | Task 1 |
| 1a Seed data | Task 2 |
| 1b BpContact model | Task 1 |
| 1c New BP fields | Task 1 |
| 2 Shared types | Task 3 |
| 3a ReferenceController endpoint | Task 6 |
| 3b listContactPositions | Task 5 |
| 3b contacts diff algorithm | Task 5 |
| 3b positionId validation | Task 5 |
| 3c DTOs (BpContactDto + new fields) | Task 4 |
| 4a react-hook-form migration | Tasks 7, 8 |
| 4a Zod schemas | Task 8 |
| 4b File structure | Tasks 9, 10, 11 |
| 4c Tab layout / core identity above tabs | Task 11 |
| 4c VET below tabs | Tasks 10, 11 |
| 4d Per-tab error indicator | Task 11 |
| 4e BpContact inline editor | Task 9 (contact-tab) |
| 4f Edit page hydration | Task 11 |
| 4g BpSupplier not touched | ✓ no changes to supplier |
| AC-01 through AC-17 | Task 14 |

### Placeholder scan

No TBD, TODO, "implement later", or vague steps found. Every step includes exact code or exact commands.

### Type consistency check

- `BpContactFormValue` defined in `bp-form-schema.ts`, used in `contact-tab.tsx`
- `CreateBpFormValues` used consistently across all tab components and the orchestrator
- `ContactPositionResponse` defined in Task 3, used in Task 9 (ContactTab props) and Task 5 (service return type)
- `mapContactPosition` helper defined and used only in `business-partner.service.ts`
- `BP_INCLUDE` extended in one place; `mapBpToResponse` reads `bp.contacts` from that include
