# Advanced ERP BP Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Business Partner system with BpGroup (clinic-scoped code generation), CRM fields (PDPA opt-in / internal notes / alert banner), BpVet specialty + DF rate, and free-form contact position — replacing the `ContactPosition` master table entirely.

**Architecture:** Schema-first, backend, shared-types, then frontend. The `ContactPosition` model is dropped (pre-production, no data migration needed). BpGroup auto-seeded on clinic creation. Code generation uses `SELECT FOR UPDATE` inside a Prisma `$transaction`. Alert banner rendered in the BP form above the tabs.

**Tech Stack:** Prisma 6 / PostgreSQL, NestJS 11, class-validator DTOs, Next.js 15 with react-hook-form + Zod v4, @petiatrics/ui Radix components, next-intl.

---

## File Map

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Add BpGroup model; modify BusinessPartner, BpVet, BpContact; drop ContactPosition; add Clinic back-relation |
| `packages/types/src/api.ts` | Add BpGroupResponse; update BP/BpVet/BpContact interfaces; remove ContactPositionResponse |
| `apps/api/src/modules/identity/dto/create-business-partner.dto.ts` | Add groupId, CRM fields to BP DTO; add specialty/defaultDfRate to BpVetDto; replace positionId with position in BpContactDto |
| `apps/api/src/modules/identity/dto/update-business-partner.dto.ts` | Same additions minus groupId/code (immutable) |
| `apps/api/src/modules/identity/services/business-partner.service.ts` | Add group to BP_INCLUDE; implement $queryRaw code generation; map new fields; remove ContactPosition references; add listBpGroups() |
| `apps/api/src/modules/identity/controllers/reference.controller.ts` | Add GET /reference/bp-groups; remove GET /reference/contact-positions |
| `apps/api/src/modules/identity/services/clinic.service.ts` | Seed 3 BpGroup rows in registerRequest() and create() |
| `apps/api/src/modules/identity/services/business-partner.service.spec.ts` | Add sequence-gen tests; remove ContactPosition refs; add group mapping tests |
| `apps/api/src/modules/identity/controllers/reference.controller.spec.ts` | Replace listContactPositions with listBpGroups test |
| `apps/web/components/business-partners/bp-form-schema.ts` | positionId→position; add groupId/CRM/vet fields to schemas |
| `apps/web/components/business-partners/tabs/contact-tab.tsx` | Replace position Select with plain Input |
| `apps/web/components/business-partners/tabs/roles-commercial-tab.tsx` | Add groupId Select (read-only in edit), CRM fields |
| `apps/web/components/business-partners/extension-fields.tsx` | Add specialty and defaultDfRate inputs |
| `apps/web/components/business-partners/bp-alert-banner.tsx` | **Create new** — yellow warning banner |
| `apps/web/components/business-partners/business-partner-form.tsx` | Remove contact-positions fetch; add bp-groups fetch; render BpAlertBanner; wire new fields |
| `apps/web/messages/en.json` | Add keys for group, code, CRM fields, vet extensions |
| `apps/web/messages/th.json` | Same keys in Thai |
| `apps/web/components/business-partners/bp-form-schema.test.ts` | Update contact/vet/base schema tests |

---

## Task 1: Update Prisma Schema (T037)

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

This task has no test step — schema changes are validated by `prisma generate`.

- [ ] **Step 1: Add BpGroup model and Clinic back-relation**

In `packages/database/prisma/schema.prisma`:

1. Inside `model Clinic`, add `bpGroups` after the `businessPartners` line:

```prisma
  businessPartners BusinessPartner[]
  bpGroups         BpGroup[]
```

2. After the `BpSupplier` model block (before the `// ─── ContactPosition` comment), insert:

```prisma
// ─── BpGroup ─────────────────────────────────────────────────────────────────

model BpGroup {
  id               String   @id @default(uuid())
  clinicId         String
  name             String
  prefix           String           // e.g. "C-", "V-", "S-"
  currentSequence  Int      @default(0)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  clinic           Clinic            @relation(fields: [clinicId], references: [id])
  businessPartners BusinessPartner[]

  @@unique([clinicId, prefix])
  @@index([clinicId])
  @@map("bp_groups")
}
```

- [ ] **Step 2: Add new fields to BusinessPartner**

Inside `model BusinessPartner`, after the `isActive` field and before `createdAt`:

```prisma
  // ── BpGroup & auto-code
  groupId          String?
  code             String?
  // ── CRM
  isMarketingOptIn Boolean  @default(false)
  internalNotes    String?  @db.Text
  alertMessage     String?
```

Add the relation after the existing `contacts` relation line:

```prisma
  group            BpGroup?  @relation(fields: [groupId], references: [id])
```

Add the unique constraint alongside the existing `@@index` lines (before `@@map("business_partners")`):

```prisma
  @@unique([clinicId, code])
```

- [ ] **Step 3: Add fields to BpVet**

Inside `model BpVet`, after `licenseNumber`:

```prisma
  specialty        String?
  defaultDfRate    Decimal? @db.Decimal(5,2)
```

- [ ] **Step 4: Replace BpContact FK position with free-form text**

Inside `model BpContact`, replace:

```prisma
  positionId String?
```

```prisma
  position ContactPosition? @relation(fields: [positionId], references: [id])
```

With a single line:

```prisma
  position   String?
```

- [ ] **Step 5: Remove the ContactPosition model**

Delete the entire `// ─── ContactPosition ─────...` section including the `model ContactPosition { ... }` block (approximately lines 311–326).

- [ ] **Step 6: Run prisma generate to validate**

```bash
cd packages/database
npx prisma generate
```

Expected: no errors, client regenerated.

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(schema): add BpGroup, CRM fields, BpVet specialty/dfRate, free-form contact position, drop ContactPosition"
```

---

## Task 2: Generate Prisma Migration (T038)

**Files:**
- Creates: `packages/database/prisma/migrations/20260419_advanced_bp_erp/migration.sql`

- [ ] **Step 1: Generate the migration**

```bash
cd packages/database
npx prisma migrate dev --name 20260419_advanced_bp_erp
```

Expected output: migration SQL file created and applied. The migration will:
- DROP `contact_positions` table
- DROP column `bp_contacts.position_id`
- ADD column `bp_contacts.position varchar`
- CREATE table `bp_groups`
- ADD columns to `business_partners`: `group_id`, `code`, `is_marketing_opt_in`, `internal_notes`, `alert_message`
- ADD columns to `bp_vets`: `specialty`, `default_df_rate`
- ADD `UNIQUE(clinic_id, code)` constraint to `business_partners`

- [ ] **Step 2: Verify migration and regenerate client**

```bash
npx prisma generate
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/migrations/
git commit -m "feat(db): migration 20260419_advanced_bp_erp — BpGroup, CRM fields, free-form contact position"
```

---

## Task 3: Update Shared Types (T039)

**Files:**
- Modify: `packages/types/src/api.ts`

- [ ] **Step 1: Add BpGroupResponse and remove ContactPositionResponse**

Remove the `ContactPositionResponse` interface entirely from the file.

Add `BpGroupResponse` near the other BP interfaces:

```ts
export interface BpGroupResponse {
  id: string;
  name: string;
  prefix: string;
  currentSequence: number;
  isActive: boolean;
}
```

- [ ] **Step 2: Update BpVetPayload and BpVetResponse**

Replace `BpVetPayload`:

```ts
export interface BpVetPayload {
  licenseNumber: string;
  specialty?: string | null;
  defaultDfRate?: number | null;
}
```

Replace `BpVetResponse`:

```ts
export interface BpVetResponse {
  licenseNumber: string;
  specialty: string | null;
  defaultDfRate: number | null;
}
```

- [ ] **Step 3: Update BpContactPayload and BpContactResponse**

Replace `BpContactPayload` — remove `positionId`, add `position`:

```ts
export interface BpContactPayload {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
  position?: string | null;
  isPrimary?: boolean;
}
```

Replace `BpContactResponse` — remove `positionId` and the old `position: ContactPositionResponse | null`, add free-form:

```ts
export interface BpContactResponse {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  position: string | null;
  isPrimary: boolean;
}
```

- [ ] **Step 4: Update BusinessPartnerResponse**

In `BusinessPartnerResponse`, add these fields after `discountGroupId`:

```ts
  groupId: string | null;
  code: string | null;
  isMarketingOptIn: boolean;
  internalNotes: string | null;
  alertMessage: string | null;
  group: { id: string; name: string; prefix: string } | null;
```

- [ ] **Step 5: Update CreateBusinessPartnerPayload and UpdateBusinessPartnerPayload**

In `CreateBusinessPartnerPayload`, add after `discountGroupId`:

```ts
  groupId?: string | null;
  isMarketingOptIn?: boolean;
  internalNotes?: string | null;
  alertMessage?: string | null;
```

In `UpdateBusinessPartnerPayload`, add the same fields **without** `groupId` (immutable):

```ts
  isMarketingOptIn?: boolean;
  internalNotes?: string | null;
  alertMessage?: string | null;
```

- [ ] **Step 6: Rebuild dist**

```bash
cd packages/types
npx tsc --build
```

Expected: no errors, `dist/index.js` and `dist/index.d.ts` updated.

- [ ] **Step 7: Commit**

```bash
git add packages/types/src/api.ts packages/types/dist/
git commit -m "feat(types): add BpGroupResponse, new BP/BpVet/BpContact fields, remove ContactPositionResponse"
```

---

## Task 4: Update Create DTO (T040)

**Files:**
- Modify: `apps/api/src/modules/identity/dto/create-business-partner.dto.ts`

- [ ] **Step 1: Add Max to class-validator imports**

At the top of the file, add `Max` to the import list from `'class-validator'`:

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
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
```

- [ ] **Step 2: Update BpVetDto**

Replace:

```ts
export class BpVetDto {
  @IsString()
  @IsNotEmpty()
  licenseNumber!: string;

  // whtRate REMOVED — WHT defaults are set via BusinessPartner.defaultWhtCodeId
}
```

With:

```ts
export class BpVetDto {
  @IsString()
  @IsNotEmpty()
  licenseNumber!: string;

  @IsOptional()
  @IsString()
  specialty?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultDfRate?: number | null;
}
```

- [ ] **Step 3: Update BpContactDto — replace positionId with position**

Replace:

```ts
  @ValidateIf((o: BpContactDto) => o.positionId != null)
  @IsOptional()
  @IsUUID()
  positionId?: string | null;
```

With:

```ts
  @IsOptional()
  @IsString()
  position?: string | null;
```

Check if `IsUUID` is still used elsewhere in this file. If the only use was `positionId`, remove `IsUUID` from the imports. (`linkUserId` uses `@IsUUID()` in `CreateBusinessPartnerDto`, so `IsUUID` must stay.)

- [ ] **Step 4: Add new fields to CreateBusinessPartnerDto**

After the `// ── Commercial ──` section's `discountGroupId` field, add:

```ts
  // ── BpGroup & auto-code ──────────────────────────────────────────────────
  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  // ── CRM fields ───────────────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  isMarketingOptIn?: boolean;

  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  @IsOptional()
  @IsString()
  alertMessage?: string | null;
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/identity/dto/create-business-partner.dto.ts
git commit -m "feat(dto): add groupId, CRM fields, specialty/dfRate, free-form contact position"
```

---

## Task 5: Update Update DTO (T041)

**Files:**
- Modify: `apps/api/src/modules/identity/dto/update-business-partner.dto.ts`

Note: `groupId` and `code` are **not** present in the update DTO — they are immutable after creation.

- [ ] **Step 1: Add CRM fields to UpdateBusinessPartnerDto**

After the `discountGroupId` field, add:

```ts
  // ── CRM fields ───────────────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  isMarketingOptIn?: boolean;

  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  @IsOptional()
  @IsString()
  alertMessage?: string | null;
```

The `BpContactDto` and `BpVetDto` are imported from `create-business-partner.dto.ts` and already updated in Task 4. No further changes needed here for those.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/identity/dto/update-business-partner.dto.ts
git commit -m "feat(dto): add CRM fields to UpdateBusinessPartnerDto"
```

---

## Task 6: Update BusinessPartner Service (T042 + T043 + T044)

**Files:**
- Modify: `apps/api/src/modules/identity/services/business-partner.service.ts`

- [ ] **Step 1: Update imports**

Replace:

```ts
import { PrismaClient } from '@prisma/client';
import type { BusinessPartnerResponse, ContactPositionResponse, TaxCodeResponse } from '@petiatrics/types';
```

With:

```ts
import { PrismaClient, Prisma } from '@prisma/client';
import type { BusinessPartnerResponse, BpGroupResponse, TaxCodeResponse } from '@petiatrics/types';
```

- [ ] **Step 2: Remove mapContactPosition helper**

Delete the entire function:

```ts
function mapContactPosition(cp: { id: string; name: string } | null): ContactPositionResponse | null {
  if (!cp) return null;
  return { id: cp.id, name: cp.name };
}
```

- [ ] **Step 3: Update contacts mapping in mapBpToResponse**

Replace:

```ts
    contacts: ((bp as any).contacts ?? []).map((c: any) => ({
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

With:

```ts
    contacts: ((bp as any).contacts ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      lineId: c.lineId ?? null,
      position: c.position ?? null,
      isPrimary: c.isPrimary,
    })),
```

- [ ] **Step 4: Add new BP fields to mapBpToResponse**

After the `discountGroupId` line, add:

```ts
    // Group & auto-code
    groupId: bp.groupId ?? null,
    code: bp.code ?? null,
    // CRM
    isMarketingOptIn: bp.isMarketingOptIn,
    internalNotes: bp.internalNotes ?? null,
    alertMessage: bp.alertMessage ?? null,
    group: (bp as any).group
      ? {
          id: (bp as any).group.id,
          name: (bp as any).group.name,
          prefix: (bp as any).group.prefix,
        }
      : null,
```

Update the `vet` mapping to serialize `defaultDfRate` via `.toNumber()`:

```ts
    vet: bp.vetExt
      ? {
          licenseNumber: bp.vetExt.licenseNumber,
          specialty: (bp.vetExt as any).specialty ?? null,
          defaultDfRate: (bp.vetExt as any).defaultDfRate?.toNumber() ?? null,
        }
      : null,
```

- [ ] **Step 5: Update BP_INCLUDE**

Replace:

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
};
```

With:

```ts
const BP_INCLUDE = {
  user: { select: { id: true, role: true, email: true, username: true } },
  vetExt: true,
  suppExt: true,
  group: true,
  activeRoles: true,
  defaultVatCode: true,
  defaultWhtCode: true,
  contacts: {
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
  },
};
```

- [ ] **Step 6: Remove ContactPosition validation from create()**

In the `create()` method, delete the contact position validation block:

```ts
    // Validate contact position references
    if (dto.contacts) {
      const uniquePositionIds = [...new Set(
        dto.contacts.filter((c) => c.positionId).map((c) => c.positionId!),
      )];
      for (const pid of uniquePositionIds) {
        await this.assertContactPositionExists(pid);
      }
    }
```

- [ ] **Step 7: Add code generation inside create() transaction**

Inside `this.prisma.$transaction(async (tx) => {`, add the following **before** `tx.businessPartner.create`:

```ts
      // ── Auto-generate BP code if groupId provided ────────────────────────
      let generatedCode: string | null = null;
      if (dto.groupId) {
        const rows = await tx.$queryRaw<Array<{
          id: string; prefix: string; current_sequence: number;
        }>>(Prisma.sql`SELECT id, prefix, current_sequence FROM bp_groups WHERE id = ${dto.groupId} FOR UPDATE`);
        const group = rows[0];
        if (!group) throw new BadRequestException(`groupId '${dto.groupId}' not found`);
        const newSeq = group.current_sequence + 1;
        await tx.bpGroup.update({
          where: { id: dto.groupId },
          data: { currentSequence: newSeq },
        });
        generatedCode = `${group.prefix}${newSeq.toString().padStart(4, '0')}`;
      }
```

In `tx.businessPartner.create({ data: { ... } })`, add after `bankAccountNumber`:

```ts
          groupId: dto.groupId ?? null,
          code: generatedCode,
          isMarketingOptIn: dto.isMarketingOptIn ?? false,
          internalNotes: dto.internalNotes ?? null,
          alertMessage: dto.alertMessage ?? null,
```

In `tx.bpVet.create`, add specialty and defaultDfRate:

```ts
        await tx.bpVet.create({
          data: {
            bpId: created.id,
            licenseNumber: dto.vet.licenseNumber,
            specialty: dto.vet.specialty ?? null,
            defaultDfRate: dto.vet.defaultDfRate ?? null,
          },
        });
```

In `tx.bpContact.createMany`, replace `positionId` with `position`:

```ts
          data: dto.contacts.map((c, i) => ({
            bpId: created.id,
            name: c.name,
            phone: c.phone ?? null,
            email: c.email ?? null,
            lineId: c.lineId ?? null,
            position: c.position ?? null,
            isPrimary: primaryIdx === -1 ? false : i === primaryIdx,
          })),
```

- [ ] **Step 8: Remove ContactPosition validation from update()**

Delete the contact position validation block:

```ts
    // Validate contact position references
    if (dto.contacts) {
      const uniquePositionIds = [...new Set(
        dto.contacts.filter((c) => c.positionId).map((c) => c.positionId!),
      )];
      for (const pid of uniquePositionIds) {
        await this.assertContactPositionExists(pid);
      }
    }
```

- [ ] **Step 9: Add CRM fields to update() coreUpdate builder**

After `if (dto.bankAccountNumber !== undefined) coreUpdate.bankAccountNumber = dto.bankAccountNumber;`, add:

```ts
      if (dto.isMarketingOptIn !== undefined) coreUpdate.isMarketingOptIn = dto.isMarketingOptIn;
      if (dto.internalNotes !== undefined) coreUpdate.internalNotes = dto.internalNotes;
      if (dto.alertMessage !== undefined) coreUpdate.alertMessage = dto.alertMessage;
```

Update the BpVet upsert:

```ts
          await tx.bpVet.upsert({
            where: { bpId: id },
            create: {
              bpId: id,
              licenseNumber: dto.vet.licenseNumber,
              specialty: dto.vet.specialty ?? null,
              defaultDfRate: dto.vet.defaultDfRate ?? null,
            },
            update: {
              licenseNumber: dto.vet.licenseNumber,
              specialty: dto.vet.specialty ?? null,
              defaultDfRate: dto.vet.defaultDfRate ?? null,
            },
          });
```

Update `tx.bpContact.update` (replace `positionId` with `position`):

```ts
            await tx.bpContact.update({
              where: { id: c.id! },
              data: {
                name: c.name,
                phone: c.phone ?? null,
                email: c.email ?? null,
                lineId: c.lineId ?? null,
                position: c.position ?? null,
                isPrimary: contactIsPrimary,
              },
            });
```

Update `tx.bpContact.create` (replace `positionId` with `position`):

```ts
            await tx.bpContact.create({
              data: {
                bpId: id,
                name: c.name,
                phone: c.phone ?? null,
                email: c.email ?? null,
                lineId: c.lineId ?? null,
                position: c.position ?? null,
                isPrimary: contactIsPrimary,
              },
            });
```

- [ ] **Step 10: Remove assertContactPositionExists and listContactPositions; add listBpGroups**

Delete `assertContactPositionExists`:

```ts
  /** Validate that a positionId references an active ContactPosition. */
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

Delete `listContactPositions`:

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

Add `listBpGroups` after `listTaxCodes`:

```ts
  /** Return all active BpGroup records for the clinic — for use in the BP form group selector. */
  async listBpGroups(clinicId: string): Promise<BpGroupResponse[]> {
    const rows = await this.prisma.bpGroup.findMany({
      where: { clinicId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      prefix: g.prefix,
      currentSequence: g.currentSequence,
      isActive: g.isActive,
    }));
  }
```

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/modules/identity/services/business-partner.service.ts
git commit -m "feat(service): BpGroup code-gen, CRM fields, listBpGroups, remove ContactPosition"
```

---

## Task 7: Update Reference Controller (T043 + T044)

**Files:**
- Modify: `apps/api/src/modules/identity/controllers/reference.controller.ts`

- [ ] **Step 1: Find how clinicId is extracted from request in the BP controller**

Run:

```bash
grep -n "ClinicContext\|clinicId\|@Param\|@Request\|@Req" apps/api/src/modules/identity/controllers/business-partner.controller.ts | head -20
```

Note the decorator used to extract `clinicId` (likely `@ClinicContext()` or `@Req() req` + `req.clinicId`). Use the same pattern in the reference controller.

- [ ] **Step 2: Replace the controller content**

Assuming `@ClinicContext()` decorator exists (check output from Step 1). If a different mechanism is used, adapt accordingly.

Replace the entire file:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessPartnerService } from '../services/business-partner.service';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { ClinicContext } from '../../../common/decorators/clinic-context.decorator';

/**
 * ReferenceController — read-only reference data endpoints.
 *
 * - TaxCode: global (no clinic scoping)
 * - BpGroup: clinic-scoped (reads clinicId from session via ClinicContext)
 */
@Controller('reference')
@UseGuards(BranchContextGuard)
export class ReferenceController {
  constructor(private readonly bpService: BusinessPartnerService) {}

  /**
   * GET /api/v1/reference/tax-codes
   * Return all active TaxCode records for use in the BP form VAT/WHT selectors.
   */
  @Get('tax-codes')
  listTaxCodes() {
    return this.bpService.listTaxCodes();
  }

  /**
   * GET /api/v1/reference/bp-groups
   * Return all active BpGroup records for the current clinic.
   */
  @Get('bp-groups')
  listBpGroups(@ClinicContext() clinicId: string) {
    return this.bpService.listBpGroups(clinicId);
  }
}
```

If `@ClinicContext()` does not exist and the pattern is `@Req() req: { clinicId: string }`, use:

```ts
  @Get('bp-groups')
  listBpGroups(@Req() req: { clinicId: string }) {
    return this.bpService.listBpGroups(req.clinicId);
  }
```

And add `Req` to the `@nestjs/common` import.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/identity/controllers/reference.controller.ts
git commit -m "feat(controller): add GET /reference/bp-groups, remove GET /reference/contact-positions"
```

---

## Task 8: Seed BpGroups in ClinicService (T045)

**Files:**
- Modify: `apps/api/src/modules/identity/services/clinic.service.ts`

- [ ] **Step 1: Update registerRequest() to seed BpGroups**

Inside the `$transaction` callback in `registerRequest()`, after `const c = await tx.clinic.create(...)` and before `const u = await tx.user.create(...)`, insert:

```ts
      await tx.bpGroup.createMany({
        data: [
          { clinicId: c.id, name: 'Customers', prefix: 'C-' },
          { clinicId: c.id, name: 'Vets',      prefix: 'V-' },
          { clinicId: c.id, name: 'Suppliers', prefix: 'S-' },
        ],
      });
```

- [ ] **Step 2: Update create() to seed BpGroups**

Replace the current `create()` method (which uses a plain `this.prisma.clinic.create`):

```ts
  async create(dto: CreateClinicDto): Promise<Clinic> {
    const existing = await this.prisma.clinic.findFirst({
      where: { taxId: dto.taxId },
    });
    if (existing) {
      throw new ConflictException(`Clinic with Tax ID ${dto.taxId} already exists.`);
    }
    const slug = await this.generateUniqueSlug(dto.name);
    return this.prisma.clinic.create({
      data: {
        name: dto.name,
        taxId: dto.taxId,
        slug,
        address: dto.address,
        subscriptionTier: dto.subscriptionTier ?? SubscriptionTier.FREE,
        status: ClinicStatus.ACTIVE,
      },
    });
  }
```

With:

```ts
  async create(dto: CreateClinicDto): Promise<Clinic> {
    const existing = await this.prisma.clinic.findFirst({
      where: { taxId: dto.taxId },
    });
    if (existing) {
      throw new ConflictException(`Clinic with Tax ID ${dto.taxId} already exists.`);
    }
    const slug = await this.generateUniqueSlug(dto.name);
    return this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: dto.name,
          taxId: dto.taxId,
          slug,
          address: dto.address,
          subscriptionTier: dto.subscriptionTier ?? SubscriptionTier.FREE,
          status: ClinicStatus.ACTIVE,
        },
      });
      await tx.bpGroup.createMany({
        data: [
          { clinicId: clinic.id, name: 'Customers', prefix: 'C-' },
          { clinicId: clinic.id, name: 'Vets',      prefix: 'V-' },
          { clinicId: clinic.id, name: 'Suppliers', prefix: 'S-' },
        ],
      });
      return clinic;
    });
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/identity/services/clinic.service.ts
git commit -m "feat(clinic): seed 3 BpGroup rows on clinic creation"
```

---

## Task 9: Backend Tests (T046 + T047)

**Files:**
- Modify: `apps/api/src/modules/identity/services/business-partner.service.spec.ts`
- Modify: `apps/api/src/modules/identity/controllers/reference.controller.spec.ts`

- [ ] **Step 1: Replace reference.controller.spec.ts**

Replace the entire file content:

```ts
import { Test } from '@nestjs/testing';
import { ReferenceController } from './reference.controller';
import { BusinessPartnerService } from '../services/business-partner.service';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';

const allowGuard = { canActivate: () => true };

const mockTaxCodes = [
  { id: 'tc-1', code: 'V7', name: 'VAT 7%', rate: 7, isVatType: true, description: 'Standard VAT' },
];

const mockBpGroups = [
  { id: 'grp-1', name: 'Customers', prefix: 'C-', currentSequence: 5, isActive: true },
  { id: 'grp-2', name: 'Vets',      prefix: 'V-', currentSequence: 0, isActive: true },
];

function makeBpServiceMock() {
  return {
    listTaxCodes: jest.fn().mockResolvedValue(mockTaxCodes),
    listBpGroups: jest.fn().mockResolvedValue(mockBpGroups),
  };
}

describe('ReferenceController', () => {
  let controller: ReferenceController;
  let bpService: ReturnType<typeof makeBpServiceMock>;

  beforeEach(async () => {
    bpService = makeBpServiceMock();
    const module = await Test.createTestingModule({
      controllers: [ReferenceController],
      providers: [{ provide: BusinessPartnerService, useValue: bpService }],
    })
      .overrideGuard(BranchContextGuard)
      .useValue(allowGuard)
      .compile();

    controller = module.get(ReferenceController);
  });

  describe('listTaxCodes', () => {
    it('delegates to bpService.listTaxCodes and returns result', async () => {
      const result = await controller.listTaxCodes();
      expect(bpService.listTaxCodes).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTaxCodes);
    });
  });

  describe('listBpGroups', () => {
    it('delegates to bpService.listBpGroups with clinicId', async () => {
      const result = await controller.listBpGroups('clinic-1');
      expect(bpService.listBpGroups).toHaveBeenCalledWith('clinic-1');
      expect(result).toEqual(mockBpGroups);
    });

    it('returns empty array when service returns none', async () => {
      bpService.listBpGroups.mockResolvedValueOnce([]);
      const result = await controller.listBpGroups('clinic-1');
      expect(result).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run reference controller tests (expect pass after Task 7)**

```bash
cd apps/api
npx jest src/modules/identity/controllers/reference.controller.spec.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 3: Update makeBp() in business-partner.service.spec.ts**

In the `makeBp` overrides type and return object, add:

```ts
// In the overrides parameter type (after `updatedAt: Date`):
  groupId?: string | null;
  code?: string | null;
  isMarketingOptIn?: boolean;
  internalNotes?: string | null;
  alertMessage?: string | null;
  group?: null | { id: string; name: string; prefix: string; currentSequence: number; isActive: boolean };
```

In the return object (after `contacts: []`):

```ts
    groupId: null,
    code: null,
    isMarketingOptIn: false,
    internalNotes: null,
    alertMessage: null,
    group: null,
```

- [ ] **Step 4: Update makePrisma() to include bpGroup mock and $queryRaw**

In `makePrisma()`, add to the `tx` object:

```ts
    bpGroup: {
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([
      { id: 'grp-1', prefix: 'C-', current_sequence: 0 },
    ]),
```

Also add to the main `prisma` mock (outside `tx`):

```ts
    bpGroup: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
```

- [ ] **Step 5: Add code generation tests**

Find the helper used to instantiate `BusinessPartnerService` in the test file (look for `new BusinessPartnerService` or a `makeService` factory). Use that pattern.

Add a new describe block:

```ts
describe('create — code generation', () => {
  it('generates code C-0001 when groupId is provided and currentSequence is 0', async () => {
    // The $queryRaw mock returns sequence=0 → next code is 1 → "C-0001"
    const bpRecord = makeBp({ groupId: 'grp-1', code: 'C-0001' });
    const prisma = makePrisma(bpRecord);
    (prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 'grp-1', prefix: 'C-', current_sequence: 0 },
    ]);

    const service = new BusinessPartnerService(prisma as unknown as PrismaClient);
    const result = await service.create('clinic-1', {
      type: BusinessPartnerType.CUSTOMER,
      name: 'Test',
      groupId: 'grp-1',
    } as any);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.bpGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'grp-1' }, data: { currentSequence: 1 } }),
    );
    expect(result.code).toBe('C-0001');
  });

  it('leaves code null when groupId is absent', async () => {
    const bpRecord = makeBp({ groupId: null, code: null });
    const prisma = makePrisma(bpRecord);
    (prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));

    const service = new BusinessPartnerService(prisma as unknown as PrismaClient);
    await service.create('clinic-1', {
      type: BusinessPartnerType.CUSTOMER,
      name: 'Test',
    } as any);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when groupId row not found', async () => {
    const prisma = makePrisma();
    (prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    const service = new BusinessPartnerService(prisma as unknown as PrismaClient);
    await expect(
      service.create('clinic-1', {
        type: BusinessPartnerType.CUSTOMER,
        name: 'Test',
        groupId: 'non-existent',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 6: Add listBpGroups test**

```ts
describe('listBpGroups', () => {
  it('returns mapped BpGroup rows for the clinic', async () => {
    const prisma = makePrisma();
    (prisma.bpGroup.findMany as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'Customers', prefix: 'C-', currentSequence: 3, isActive: true },
    ]);

    const service = new BusinessPartnerService(prisma as unknown as PrismaClient);
    const result = await service.listBpGroups('clinic-1');

    expect(prisma.bpGroup.findMany).toHaveBeenCalledWith({
      where: { clinicId: 'clinic-1', isActive: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toMatchObject([
      { id: 'g1', name: 'Customers', prefix: 'C-', currentSequence: 3, isActive: true },
    ]);
  });
});
```

- [ ] **Step 7: Run all identity service tests**

```bash
cd apps/api
npx jest src/modules/identity/ --no-coverage
```

Expected: all tests PASS. Fix any TypeScript errors from missing mock fields.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/identity/services/business-partner.service.spec.ts
git add apps/api/src/modules/identity/controllers/reference.controller.spec.ts
git commit -m "test(api): update BP service and reference controller tests for BpGroup"
```

---

## Task 10: Update i18n Keys (T053)

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/th.json`

- [ ] **Step 1: Update en.json**

In the `businessPartners` section:

**Inside `contacts`** — remove `selectPosition` and `noPosition`, add `position`:

Remove:
```json
      "selectPosition": "Select position",
      "noPosition": "— No position —"
```

Add:
```json
      "position": "Position"
```

**At the top level of `businessPartners`**, add before the `"address"` key:

```json
    "group": "Group",
    "groupCode": "Group Code",
    "code": "BP Code",
    "noGroup": "— No group —",
    "nextCode": "Next code: {code}",
    "isMarketingOptIn": "Marketing Opt-In (PDPA)",
    "internalNotes": "Internal Notes",
    "alertMessage": "Alert Message",
```

**Inside `vet`**, add after `licenseNumber`:

```json
      "specialty": "Specialty",
      "defaultDfRate": "Default DF Rate (%)"
```

- [ ] **Step 2: Update th.json**

Find the `businessPartners` section in `th.json` and apply matching changes.

Inside `contacts`, replace `selectPosition`/`noPosition` with:

```json
      "position": "ตำแหน่ง"
```

Add to top-level `businessPartners`:

```json
    "group": "กลุ่ม",
    "groupCode": "รหัสกลุ่ม",
    "code": "รหัส BP",
    "noGroup": "— ไม่มีกลุ่ม —",
    "nextCode": "รหัสถัดไป: {code}",
    "isMarketingOptIn": "ยินยอมรับการตลาด (PDPA)",
    "internalNotes": "หมายเหตุภายใน",
    "alertMessage": "ข้อความแจ้งเตือน",
```

Add to `vet`:

```json
      "specialty": "ความเชี่ยวชาญ",
      "defaultDfRate": "อัตราค่า DF (%)"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/th.json
git commit -m "feat(i18n): add BpGroup, CRM, vet specialty keys"
```

---

## Task 11: Update Zod Schema (T048)

**Files:**
- Modify: `apps/web/components/business-partners/bp-form-schema.ts`

- [ ] **Step 1: Update bpContactSchema — positionId → position**

Replace:

```ts
const bpContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().nullable().optional(),
  email: z
    .union([z.string().email('Invalid email'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  lineId: z.string().nullable().optional(),
  positionId: z.string().uuid('Must be a valid UUID').nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});
```

With:

```ts
const bpContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().nullable().optional(),
  email: z
    .union([z.string().email('Invalid email'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  lineId: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});
```

- [ ] **Step 2: Update vetSchema**

Replace:

```ts
const vetSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
});
```

With:

```ts
const vetSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
  specialty: z.string().nullable().optional(),
  defaultDfRate: z.number().min(0).max(100).nullable().optional(),
});
```

- [ ] **Step 3: Add new fields to baseBpSchema**

After the `discountGroupId` field in `baseBpSchema`, add:

```ts
    // BpGroup & auto-code
    groupId: z.string().nullable().optional(),
    // CRM
    isMarketingOptIn: z.boolean().optional().default(false),
    internalNotes: z.string().nullable().optional(),
    alertMessage: z.string().nullable().optional(),
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/business-partners/bp-form-schema.ts
git commit -m "feat(schema): positionId→position, add groupId/CRM/vet fields to Zod schemas"
```

---

## Task 12: Update Contact Tab (T049)

**Files:**
- Modify: `apps/web/components/business-partners/tabs/contact-tab.tsx`

- [ ] **Step 1: Update imports**

Remove from the import line: `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` (these are no longer needed here). Remove `ContactPositionResponse` import from `@petiatrics/types`.

Keep `Controller` in the import — it is still used for the `isPrimary` checkbox.

- [ ] **Step 2: Remove props interface and update signature**

Remove:

```tsx
interface ContactTabProps {
  contactPositions: ContactPositionResponse[];
  positionsLoading: boolean;
}

export default function ContactTab({ contactPositions, positionsLoading }: ContactTabProps) {
```

Replace with:

```tsx
export default function ContactTab() {
```

- [ ] **Step 3: Replace position Select with plain Input**

In the contact row JSX, replace the entire position `<Controller>` block:

```tsx
                <div className="space-y-1.5">
                  <Label>{t('contacts.position')}</Label>
                  <Controller
                    control={control}
                    name={`contacts.${index}.positionId`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value ?? '__none__'}
                        onValueChange={(v) => f.onChange(v === '__none__' ? null : v)}
                        disabled={positionsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={positionsLoading ? t('loading') : t('contacts.selectPosition')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('contacts.noPosition')}</SelectItem>
                          {contactPositions.map((pos) => (
                            <SelectItem key={pos.id} value={pos.id}>
                              {pos.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
```

With:

```tsx
                <div className="space-y-1.5">
                  <Label>{t('contacts.position')}</Label>
                  <Input
                    {...register(`contacts.${index}.position`)}
                    placeholder={t('contacts.position')}
                  />
                </div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/business-partners/tabs/contact-tab.tsx
git commit -m "feat(contact-tab): replace ContactPosition Select with free-form position Input"
```

---

## Task 13: Update Roles & Commercial Tab (T050)

**Files:**
- Modify: `apps/web/components/business-partners/tabs/roles-commercial-tab.tsx`

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { Checkbox, Input, Label } from '@petiatrics/ui';
import { BpRole } from '@petiatrics/types';
import { CreateBpFormValues } from '../bp-form-schema';
```

With:

```tsx
import { useFormContext, Controller } from 'react-hook-form';
import { Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@petiatrics/ui';
import { BpRole, BpGroupResponse } from '@petiatrics/types';
import { CreateBpFormValues } from '../bp-form-schema';
```

Note: `useFormContext` and `Controller` are already imported — check the current imports and add only what is missing. The current file already imports `useFormContext` and `Controller`.

- [ ] **Step 2: Update component signature**

Replace:

```tsx
export default function RolesCommercialTab() {
  const t = useTranslations('businessPartners');
  const { control, register, watch } = useFormContext<CreateBpFormValues>();
```

With:

```tsx
interface RolesCommercialTabProps {
  bpGroups: BpGroupResponse[];
  groupsLoading: boolean;
  isEdit: boolean;
}

export default function RolesCommercialTab({ bpGroups, groupsLoading, isEdit }: RolesCommercialTabProps) {
  const t = useTranslations('businessPartners');
  const { control, register, watch } = useFormContext<CreateBpFormValues>();
```

- [ ] **Step 3: Replace Commercial section with expanded version**

Replace:

```tsx
      {/* Commercial */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('commercial.title')}</h3>
        <div className="space-y-1.5 sm:w-1/2">
          <Label>{t('discountGroupId')}</Label>
          <Input {...register('discountGroupId')} placeholder={t('discountGroupId')} />
        </div>
      </div>
```

With:

```tsx
      {/* Commercial */}
      <div>
        <h3 className="mb-3 text-sm font-medium">{t('commercial.title')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('discountGroupId')}</Label>
            <Input {...register('discountGroupId')} placeholder={t('discountGroupId')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('group')}</Label>
            {isEdit ? (
              <p className="py-2 text-sm text-muted-foreground">
                {watch('groupId')
                  ? bpGroups.find((g) => g.id === watch('groupId'))?.name ?? watch('groupId')
                  : t('noGroup')}
              </p>
            ) : (
              <>
                <Controller
                  control={control}
                  name="groupId"
                  render={({ field: f }) => (
                    <Select
                      value={f.value ?? '__none__'}
                      onValueChange={(v) => f.onChange(v === '__none__' ? null : v)}
                      disabled={groupsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={groupsLoading ? t('loading') : t('noGroup')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('noGroup')}</SelectItem>
                        {bpGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name} ({g.prefix})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {watch('groupId') && (() => {
                  const selected = bpGroups.find((g) => g.id === watch('groupId'));
                  if (!selected) return null;
                  const nextCode = `${selected.prefix}${(selected.currentSequence + 1).toString().padStart(4, '0')}`;
                  return <p className="text-xs text-muted-foreground">{t('nextCode', { code: nextCode })}</p>;
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* CRM */}
      <div>
        <h3 className="mb-3 text-sm font-medium">CRM</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="isMarketingOptIn"
              render={({ field: f }) => (
                <Switch
                  id="isMarketingOptIn"
                  checked={f.value ?? false}
                  onCheckedChange={f.onChange}
                />
              )}
            />
            <Label htmlFor="isMarketingOptIn" className="cursor-pointer font-normal">
              {t('isMarketingOptIn')}
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label>{t('alertMessage')}</Label>
            <Input {...register('alertMessage')} placeholder={t('alertMessage')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('internalNotes')}</Label>
            <textarea
              {...register('internalNotes')}
              rows={3}
              placeholder={t('internalNotes')}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/business-partners/tabs/roles-commercial-tab.tsx
git commit -m "feat(roles-tab): add groupId Select, CRM fields (PDPA, notes, alert)"
```

---

## Task 14: Update Extension Fields (T051)

**Files:**
- Modify: `apps/web/components/business-partners/extension-fields.tsx`

- [ ] **Step 1: Replace VET return block**

Replace:

```tsx
  if (type === BusinessPartnerType.VET) {
    return (
      <div className="space-y-1.5" data-testid="vet-fields">
        <Label>{t('vet.licenseNumber')}</Label>
        <Input
          {...register('vet.licenseNumber')}
          placeholder="VET-0001"
        />
        {errors.vet?.licenseNumber && (
          <p className="text-destructive text-sm">{errors.vet.licenseNumber.message}</p>
        )}
      </div>
    );
  }
```

With:

```tsx
  if (type === BusinessPartnerType.VET) {
    return (
      <div className="space-y-4" data-testid="vet-fields">
        <div className="space-y-1.5">
          <Label>{t('vet.licenseNumber')}</Label>
          <Input
            {...register('vet.licenseNumber')}
            placeholder="VET-0001"
          />
          {errors.vet?.licenseNumber && (
            <p className="text-destructive text-sm">{errors.vet.licenseNumber.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t('vet.specialty')}</Label>
          <Input
            {...register('vet.specialty')}
            placeholder={t('vet.specialty')}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('vet.defaultDfRate')}</Label>
          <Input
            {...register('vet.defaultDfRate', { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="0.00"
          />
          {errors.vet?.defaultDfRate && (
            <p className="text-destructive text-sm">{errors.vet.defaultDfRate.message}</p>
          )}
        </div>
      </div>
    );
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/business-partners/extension-fields.tsx
git commit -m "feat(extension-fields): add specialty and defaultDfRate inputs for VET type"
```

---

## Task 15: Create BpAlertBanner Component (T052a)

**Files:**
- Create: `apps/web/components/business-partners/bp-alert-banner.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { AlertTriangle } from 'lucide-react';

interface BpAlertBannerProps {
  message: string;
}

export default function BpAlertBanner({ message }: BpAlertBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-800"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" aria-hidden="true" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/business-partners/bp-alert-banner.tsx
git commit -m "feat(ui): create BpAlertBanner component"
```

---

## Task 16: Update BusinessPartnerForm (T052b)

**Files:**
- Modify: `apps/web/components/business-partners/business-partner-form.tsx`

- [ ] **Step 1: Update imports**

In the `@petiatrics/types` import, remove `ContactPositionResponse` and add `BpGroupResponse`:

```tsx
import {
  BusinessPartnerType,
  BusinessPartnerResponse,
  CreateBusinessPartnerPayload,
  TaxCodeResponse,
  UpdateBusinessPartnerPayload,
  BpGroupResponse,
} from '@petiatrics/types';
```

Add BpAlertBanner import after the existing component imports:

```tsx
import BpAlertBanner from './bp-alert-banner';
```

- [ ] **Step 2: Replace contactPositions state with bpGroups state**

Replace:

```tsx
  const [contactPositions, setContactPositions] = useState<ContactPositionResponse[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
```

With:

```tsx
  const [bpGroups, setBpGroups] = useState<BpGroupResponse[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
```

- [ ] **Step 3: Replace the useEffect fetch**

Replace:

```tsx
  useEffect(() => {
    Promise.all([
      apiClient.get<TaxCodeResponse[]>('/reference/tax-codes').catch(() => [] as TaxCodeResponse[]),
      apiClient.get<ContactPositionResponse[]>('/reference/contact-positions').catch(() => [] as ContactPositionResponse[]),
    ]).then(([codes, positions]) => {
      setTaxCodes(codes);
      setContactPositions(positions);
      setPositionsLoading(false);
    });
  }, []);
```

With:

```tsx
  useEffect(() => {
    Promise.all([
      apiClient.get<TaxCodeResponse[]>('/reference/tax-codes').catch(() => [] as TaxCodeResponse[]),
      apiClient.get<BpGroupResponse[]>('/reference/bp-groups').catch(() => [] as BpGroupResponse[]),
    ]).then(([codes, groups]) => {
      setTaxCodes(codes);
      setBpGroups(groups);
      setGroupsLoading(false);
    });
  }, []);
```

- [ ] **Step 4: Update TAB_FIELDS**

Replace the `roles` entry:

```tsx
  roles: ['activeRoles', 'discountGroupId'],
```

With:

```tsx
  roles: ['activeRoles', 'discountGroupId', 'groupId', 'isMarketingOptIn', 'internalNotes', 'alertMessage'],
```

- [ ] **Step 5: Update buildDefaultValues**

Replace the `vet` mapping:

```tsx
    vet: initial.vet ? { licenseNumber: initial.vet.licenseNumber } : undefined,
```

With:

```tsx
    vet: initial.vet
      ? {
          licenseNumber: initial.vet.licenseNumber,
          specialty: initial.vet.specialty ?? '',
          defaultDfRate: initial.vet.defaultDfRate ?? undefined,
        }
      : undefined,
```

Replace the `contacts` mapping:

```tsx
    contacts: (initial.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      lineId: c.lineId ?? '',
      positionId: c.positionId ?? undefined,
      isPrimary: c.isPrimary,
    })),
```

With:

```tsx
    contacts: (initial.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      lineId: c.lineId ?? '',
      position: c.position ?? '',
      isPrimary: c.isPrimary,
    })),
```

Add new fields to the returned object (after `activeRoles`):

```tsx
    groupId: initial.groupId ?? null,
    isMarketingOptIn: initial.isMarketingOptIn ?? false,
    internalNotes: initial.internalNotes ?? '',
    alertMessage: initial.alertMessage ?? '',
```

- [ ] **Step 6: Update onSubmit payload**

Replace the `vet` payload:

```tsx
        vet: type === BusinessPartnerType.VET && values.vet?.licenseNumber
          ? { licenseNumber: values.vet.licenseNumber }
          : null,
```

With:

```tsx
        vet: type === BusinessPartnerType.VET && values.vet?.licenseNumber
          ? {
              licenseNumber: values.vet.licenseNumber,
              specialty: values.vet.specialty ?? null,
              defaultDfRate: values.vet.defaultDfRate ?? null,
            }
          : null,
```

Replace the `contacts` payload:

```tsx
        contacts: (values.contacts ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          email: c.email ?? null,
          lineId: c.lineId ?? null,
          positionId: c.positionId ?? null,
          isPrimary: c.isPrimary ?? false,
        })),
```

With:

```tsx
        contacts: (values.contacts ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          email: c.email ?? null,
          lineId: c.lineId ?? null,
          position: c.position ?? null,
          isPrimary: c.isPrimary ?? false,
        })),
```

Add CRM and groupId fields to the payload (after the existing `supplier: null` line — or inline with the spread):

```tsx
        ...(!isEdit ? { groupId: (values as CreateBpFormValues).groupId ?? null } : {}),
        isMarketingOptIn: values.isMarketingOptIn ?? false,
        internalNotes: values.internalNotes ?? null,
        alertMessage: values.alertMessage ?? null,
```

- [ ] **Step 7: Add BpAlertBanner to form JSX**

In the form JSX, add above `<Tabs defaultValue="contact">` (inside the card `div`):

```tsx
          {isEdit && initial?.alertMessage && (
            <BpAlertBanner message={initial.alertMessage} />
          )}
```

- [ ] **Step 8: Update ContactTab and RolesCommercialTab calls**

Replace:

```tsx
              <ContactTab contactPositions={contactPositions} positionsLoading={positionsLoading} />
```

With:

```tsx
              <ContactTab />
```

Replace:

```tsx
              <RolesCommercialTab />
```

With:

```tsx
              <RolesCommercialTab bpGroups={bpGroups} groupsLoading={groupsLoading} isEdit={isEdit} />
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/business-partners/business-partner-form.tsx
git commit -m "feat(bp-form): add BpAlertBanner, bp-groups fetch, new fields wiring"
```

---

## Task 17: Update Frontend Schema Tests (T054)

**Files:**
- Modify: `apps/web/components/business-partners/bp-form-schema.test.ts`

- [ ] **Step 1: Run existing tests first (baseline)**

```bash
cd apps/web
npx vitest run components/business-partners/bp-form-schema.test.ts
```

Expected: all 10 existing tests still PASS (schema changes in Task 11 should not break them — none tested `positionId` directly in a "required" way).

- [ ] **Step 2: Add new tests**

Append to `bp-form-schema.test.ts`:

```ts
describe('bpContactSchema — free-form position', () => {
  it('accepts free-form position text', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [{ name: 'Alice', position: 'Manager' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts null position', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [{ name: 'Alice', position: null }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts omitted position', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      contacts: [{ name: 'Alice' }],
    });
    expect(result.success).toBe(true);
  });
});

describe('vetSchema — specialty and defaultDfRate', () => {
  it('accepts VET with specialty', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001', specialty: 'Surgery' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts VET with defaultDfRate in range', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001', defaultDfRate: 15.5 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects defaultDfRate above 100', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001', defaultDfRate: 101 },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('defaultDfRate'))).toBe(true);
  });

  it('rejects defaultDfRate below 0', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.VET,
      vet: { licenseNumber: 'VET-001', defaultDfRate: -1 },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('defaultDfRate'))).toBe(true);
  });
});

describe('baseBpSchema — CRM fields', () => {
  it('accepts null groupId', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      groupId: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts isMarketingOptIn true', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      isMarketingOptIn: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts internalNotes string', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      internalNotes: 'This client has specific requirements',
    });
    expect(result.success).toBe(true);
  });

  it('accepts alertMessage string', () => {
    const result = createBpSchema.safeParse({
      name: 'Test',
      type: BusinessPartnerType.CUSTOMER,
      alertMessage: 'DO NOT EXTEND CREDIT',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run all schema tests**

```bash
cd apps/web
npx vitest run components/business-partners/bp-form-schema.test.ts
```

Expected: all tests PASS (both old and new).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/business-partners/bp-form-schema.test.ts
git commit -m "test(schema): add position/specialty/dfRate/CRM field tests"
```

---

## Task 18: Final Integration Check

- [ ] **Step 1: Run all API tests**

```bash
cd apps/api
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 2: Run all web tests**

```bash
cd apps/web
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: TypeScript type check**

```bash
cd apps/api && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Prisma generate (final)**

```bash
cd packages/database
npx prisma generate
```

Expected: no errors.

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| FR-016: auto-generate BP code with row lock | Task 6 Step 7 ($queryRaw FOR UPDATE) |
| FR-017: BpGroup clinic-scoped, 3 defaults seeded on creation | Task 1 (schema) + Task 8 (clinic seeding) |
| FR-018: BpContact.position free-form text | Task 1 + Task 4 + Task 6 + Task 12 |
| FR-019: alertMessage banner in BP form | Task 15 (BpAlertBanner) + Task 16 Step 7 |
| FR-020: BpVet specialty + defaultDfRate | Task 1 + Task 4 + Task 6 + Task 14 |
| BpGroupResponse type | Task 3 |
| listBpGroups endpoint | Task 6 Step 10 (service) + Task 7 (controller) |
| Remove listContactPositions | Task 6 Step 10 + Task 7 |
| groupId read-only in edit mode | Task 13 (Select disabled/replaced in edit) + Task 16 Step 6 (groupId only in create payload) |
| defaultDfRate Decimal→number serialization | Task 6 Step 4 (.toNumber()) |
| group sub-object in BusinessPartnerResponse | Task 3 Step 4 + Task 6 Step 4 |
| Clinic.bpGroups Prisma back-relation | Task 1 Step 1 |
| @@unique([clinicId, code]) | Task 1 Step 2 |
| $queryRaw not ORM findUnique | Task 6 Step 7 (explicit Prisma.sql usage) |
| i18n keys | Task 10 |
| Zod schema updates | Task 11 |
| Tests | Tasks 9 and 17 |

### Type Consistency

- `BpGroupResponse` defined Task 3 → used in Task 7 (service return), Task 13 (component props), Task 16 (form state). ✓
- `BpVetResponse.defaultDfRate: number | null` (Task 3) → `.toNumber() ?? null` in Task 6. ✓
- `BpContactResponse.position: string | null` (Task 3) → `c.position ?? null` in Task 6. ✓
- `listBpGroups(clinicId: string)` defined Task 6 → called in Task 7 → tested in Task 9. ✓
- `RolesCommercialTab({ bpGroups, groupsLoading, isEdit })` defined Task 13 → called Task 16 Step 8. ✓
- `ContactTab()` (no props) defined Task 12 → called Task 16 Step 8. ✓
- `BpAlertBanner({ message })` defined Task 15 → used Task 16 Step 7. ✓
