# Dynamic Custom Roles & Permissions — Plan A: DB Schema + Seed Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `PageMaster`, `ActionMaster`, `ClinicRole`, `ClinicRolePermission` tables to replace the static `Role` enum with a fully dynamic permission system, and migrate existing seed data.

**Architecture:** New tables are added alongside the existing `User.role` enum field first (non-breaking), then data is migrated, then the old column is dropped. The `ClinicRole` model stores per-clinic roles. `ClinicRolePermission` is the junction table linking roles to pages and actions.

**Tech Stack:** Prisma, PostgreSQL, TypeScript, NestJS

**Design Spec:** `docs/superpowers/specs/2026-07-11-dynamic-roles-permissions-design.md`

---

### Task 1: Add New Tables to Prisma Schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add `PageMaster` model**

Open `packages/database/prisma/schema.prisma`. After the `ClinicRolePermission` model block (around line 737), add:

```prisma
// ─── Dynamic RBAC — Page & Action Masters ────────────────────────────────────

model PageMaster {
  id          String         @id @default(uuid())
  code        String         @unique // e.g. "PATIENTS", "INVENTORY"
  name        String
  description String?
  sortOrder   Int            @default(0)
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  actions     ActionMaster[]
  rolePermissions ClinicRolePermissionV2[]

  @@map("page_masters")
}

model ActionMaster {
  id          String         @id @default(uuid())
  pageId      String
  code        String         @unique // e.g. "PATIENT:VIEW", "INVENTORY:ADD"
  name        String
  description String?
  sortOrder   Int            @default(0)
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  page        PageMaster     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  rolePermissions ClinicRolePermissionV2[]

  @@index([pageId])
  @@map("action_masters")
}
```

- [ ] **Step 2: Add `ClinicRole` model**

In the same file, after the `PageMaster`/`ActionMaster` blocks, add:

```prisma
model ClinicRole {
  id          String   @id @default(uuid())
  clinicId    String?  // null = system-level (SUPER_ADMIN, CUSTOMER)
  code        String   // e.g. "CLINIC_OWNER", "VET", "CUSTOM_NURSE"
  name        String
  isSystem    Boolean  @default(false) // seeded by system; code is reserved
  isDeletable Boolean  @default(true)  // false = cannot be deleted
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  clinic      Clinic?  @relation("ClinicRoles", fields: [clinicId], references: [id], onDelete: Cascade)
  users       User[]   @relation("UserClinicRole")
  permissions ClinicRolePermissionV2[]

  @@unique([clinicId, code])
  @@index([clinicId])
  @@map("clinic_roles")
}

model ClinicRolePermissionV2 {
  id        String        @id @default(uuid())
  roleId    String
  pageId    String
  actionId  String?       // null = page-view access only
  createdAt DateTime      @default(now())

  role      ClinicRole    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  page      PageMaster    @relation(fields: [pageId], references: [id], onDelete: Cascade)
  action    ActionMaster? @relation(fields: [actionId], references: [id], onDelete: SetNull)

  @@unique([roleId, pageId, actionId])
  @@index([roleId])
  @@index([pageId])
  @@index([actionId])
  @@map("clinic_role_permissions_v2")
}
```

> NOTE: We name the junction table `ClinicRolePermissionV2` and map to `clinic_role_permissions_v2` to avoid conflict with the existing `ClinicRolePermission` model that's already in the schema. We'll rename/drop the old one in a later plan.

- [ ] **Step 3: Add `ClinicRole` relation to `Clinic` model**

Find the `Clinic` model (around line 130) and add this relation line after `rolePermissions`:

```prisma
  clinicRoles         ClinicRole[]          @relation("ClinicRoles")
```

- [ ] **Step 4: Add `roleId` and `systemRole` to `User` model (nullable first)**

Find the `User` model (around line 202). Add these two fields after the existing `role Role` line:

```prisma
  roleId     String?     // FK to ClinicRole — nullable during migration
  systemRole String?     // "SUPER_ADMIN" | "CUSTOMER" | null
  clinicRole ClinicRole? @relation("UserClinicRole", fields: [roleId], references: [id])
```

- [ ] **Step 5: Generate and run migration**

```bash
cd packages/database
npx prisma migrate dev --name add_dynamic_rbac_tables
```

Expected output: migration file created in `prisma/migrations/`, `prisma generate` runs automatically.

- [ ] **Step 6: Verify migration succeeded**

```bash
npx prisma studio
```

Open browser at http://localhost:5555 and verify these tables exist:
- `page_masters`
- `action_masters`
- `clinic_roles`
- `clinic_role_permissions_v2`

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add PageMaster, ActionMaster, ClinicRole, ClinicRolePermissionV2 tables"
```

---

### Task 2: Seed PageMaster and ActionMaster

**Files:**
- Modify: `packages/database/src/seed.ts`

- [ ] **Step 1: Add PageMaster + ActionMaster seed data**

Open `packages/database/src/seed.ts`. After the `systemDocTypes` block (around line 97), add this new section:

```typescript
  // ── 0b. PageMaster & ActionMaster — system-wide RBAC registry ──────────────
  const pageSeed = [
    {
      code: 'PATIENTS',
      name: 'Patients',
      description: 'Patient profiles and medical history',
      sortOrder: 10,
      actions: [
        { code: 'PATIENT:VIEW', name: 'View Patients', description: 'Search and read patient profiles', sortOrder: 1 },
        { code: 'PATIENT:EDIT', name: 'Edit Patients', description: 'Create and update patient records', sortOrder: 2 },
      ],
    },
    {
      code: 'VISITS',
      name: 'Visits & Vaccinations',
      description: 'SOAP visit notes and vaccination records',
      sortOrder: 20,
      actions: [
        { code: 'VISIT:VIEW', name: 'View Visits', description: 'Read SOAP visit notes', sortOrder: 1 },
        { code: 'VISIT:ADD', name: 'Create Visits', description: 'Open new visit / SOAP notes', sortOrder: 2 },
        { code: 'VISIT:EDIT', name: 'Edit & Finalize Visits', description: 'Update and finalize visit notes', sortOrder: 3 },
        { code: 'VACCINATION:ADD', name: 'Log Vaccinations', description: 'Record vaccination events', sortOrder: 4 },
      ],
    },
    {
      code: 'INVENTORY',
      name: 'Inventory',
      description: 'Products, stock balances and adjustments',
      sortOrder: 30,
      actions: [
        { code: 'INVENTORY:VIEW', name: 'View Inventory', description: 'View stock levels and product catalog', sortOrder: 1 },
        { code: 'INVENTORY:ADD', name: 'Add Stock', description: 'Receive goods and post new movements', sortOrder: 2 },
        { code: 'INVENTORY:EDIT', name: 'Edit Products', description: 'Update product details and adjustments', sortOrder: 3 },
        { code: 'INVENTORY:DELETE', name: 'Deactivate Items', description: 'Deactivate products from active catalog', sortOrder: 4 },
      ],
    },
    {
      code: 'BILLING',
      name: 'Billing',
      description: 'Invoices and payments',
      sortOrder: 40,
      actions: [
        { code: 'BILLING:VIEW', name: 'View Billing', description: 'Read invoices and payment history', sortOrder: 1 },
        { code: 'BILLING:ADD', name: 'Create Invoices', description: 'Create draft invoices', sortOrder: 2 },
        { code: 'BILLING:EDIT', name: 'Process Payments', description: 'Mark invoices as issued or paid', sortOrder: 3 },
        { code: 'BILLING:VOID', name: 'Void Invoices', description: 'Void an invoice (destructive)', sortOrder: 4 },
      ],
    },
    {
      code: 'PROCUREMENT',
      name: 'Procurement',
      description: 'Purchase orders, goods receipt and supplier invoices',
      sortOrder: 50,
      actions: [
        { code: 'PROCUREMENT:VIEW', name: 'View Procurement', description: 'View purchase orders and receipts', sortOrder: 1 },
        { code: 'PROCUREMENT:CREATE_PO', name: 'Create Purchase Orders', description: 'Create and edit draft POs', sortOrder: 2 },
        { code: 'PROCUREMENT:APPROVE_PO', name: 'Approve Purchase Orders', description: 'Approve POs for ordering', sortOrder: 3 },
        { code: 'PROCUREMENT:CREATE_GR', name: 'Create Goods Receipts', description: 'Receive goods against POs', sortOrder: 4 },
      ],
    },
    {
      code: 'SETTINGS',
      name: 'Settings',
      description: 'Clinic configuration and role management',
      sortOrder: 60,
      actions: [
        { code: 'SETTINGS:MANAGE', name: 'Manage Settings', description: 'Manage clinic settings and role permissions', sortOrder: 1 },
      ],
    },
  ];

  const pageIds: Record<string, string> = {};
  const actionIds: Record<string, string> = {};

  for (const p of pageSeed) {
    const page = await prisma.pageMaster.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, sortOrder: p.sortOrder, isActive: true },
      create: { code: p.code, name: p.name, description: p.description, sortOrder: p.sortOrder, isActive: true },
    });
    pageIds[p.code] = page.id;

    for (const a of p.actions) {
      const action = await prisma.actionMaster.upsert({
        where: { code: a.code },
        update: { name: a.name, description: a.description, sortOrder: a.sortOrder, isActive: true, pageId: page.id },
        create: { code: a.code, name: a.name, description: a.description, sortOrder: a.sortOrder, isActive: true, pageId: page.id },
      });
      actionIds[a.code] = action.id;
    }
  }
  console.log('  ✓ PageMaster & ActionMaster seeded');
```

- [ ] **Step 2: Add ClinicRole seed for the demo clinic**

After the staff users block (around line 386), add a new section to seed roles for `clinic`:

```typescript
  // ── 5b. ClinicRole — seed system roles for demo clinic ────────────────────
  const roleSeedDefs = [
    {
      code: 'CLINIC_OWNER',
      name: 'Clinic Owner',
      isSystem: true,
      isDeletable: false,
      // CLINIC_OWNER bypasses all checks in code — no permission rows needed
      permissionCodes: [] as string[],
    },
    {
      code: 'VET',
      name: 'Veterinarian',
      isSystem: true,
      isDeletable: true,
      permissionCodes: [
        'PATIENT:VIEW', 'PATIENT:EDIT',
        'VISIT:VIEW', 'VISIT:ADD', 'VISIT:EDIT', 'VACCINATION:ADD',
        'INVENTORY:VIEW',
        'PROCUREMENT:VIEW',
      ],
    },
    {
      code: 'CASHIER',
      name: 'Cashier',
      isSystem: true,
      isDeletable: true,
      permissionCodes: [
        'PATIENT:VIEW',
        'BILLING:VIEW', 'BILLING:ADD', 'BILLING:EDIT', 'BILLING:VOID',
      ],
    },
    {
      code: 'STAFF',
      name: 'Staff',
      isSystem: true,
      isDeletable: true,
      permissionCodes: [
        'PATIENT:VIEW',
        'INVENTORY:VIEW',
        'BILLING:VIEW',
      ],
    },
    {
      code: 'ASSISTANT',
      name: 'Assistant',
      isSystem: true,
      isDeletable: true,
      permissionCodes: [
        'PATIENT:VIEW',
        'VISIT:VIEW',
        'INVENTORY:VIEW',
        'BILLING:VIEW',
      ],
    },
  ];

  const clinicRoleIds: Record<string, string> = {};

  for (const rd of roleSeedDefs) {
    const cr = await prisma.clinicRole.upsert({
      where: { clinicId_code: { clinicId: clinic.id, code: rd.code } },
      update: { name: rd.name, isSystem: rd.isSystem, isDeletable: rd.isDeletable, isActive: true },
      create: {
        clinicId: clinic.id,
        code: rd.code,
        name: rd.name,
        isSystem: rd.isSystem,
        isDeletable: rd.isDeletable,
        isActive: true,
      },
    });
    clinicRoleIds[rd.code] = cr.id;

    // Seed permissions for this role
    for (const actionCode of rd.permissionCodes) {
      const actionId = actionIds[actionCode];
      const actionRecord = await prisma.actionMaster.findUnique({ where: { code: actionCode } });
      if (!actionRecord) continue;
      const pageId = actionRecord.pageId;

      await prisma.clinicRolePermissionV2.upsert({
        where: { roleId_pageId_actionId: { roleId: cr.id, pageId, actionId } },
        update: {},
        create: { roleId: cr.id, pageId, actionId },
      });
    }
    console.log(`  ✓ ClinicRole: ${rd.code} (${rd.permissionCodes.length} permissions)`);
  }

  // Also seed system roles (SUPER_ADMIN, CUSTOMER) with clinicId=null
  for (const systemCode of ['SUPER_ADMIN', 'CUSTOMER'] as const) {
    await prisma.clinicRole.upsert({
      where: { clinicId_code: { clinicId: null as any, code: systemCode } },
      update: {},
      create: {
        clinicId: null,
        code: systemCode,
        name: systemCode === 'SUPER_ADMIN' ? 'Super Admin' : 'Customer',
        isSystem: true,
        isDeletable: false,
        isActive: true,
      },
    });
  }
  console.log('  ✓ System ClinicRoles (SUPER_ADMIN, CUSTOMER) seeded');
```

- [ ] **Step 3: Link existing Users to ClinicRole**

After the ClinicRole seed block, add this migration block to link existing seed users to their new ClinicRole:

```typescript
  // ── 5c. Migrate existing seed users → roleId ──────────────────────────────
  const legacyRoleMap: Record<string, string> = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CLINIC_OWNER: 'CLINIC_OWNER',
    VET: 'VET',
    ASSISTANT: 'ASSISTANT',
    CASHIER: 'CASHIER',
    STAFF: 'STAFF',
    CUSTOMER: 'CUSTOMER',
  };

  const allUsers = await prisma.user.findMany({ select: { id: true, role: true, clinicId: true } });
  for (const u of allUsers) {
    const roleCode = legacyRoleMap[u.role as string];
    if (!roleCode) continue;

    // System roles (SUPER_ADMIN, CUSTOMER) use clinicId=null roles
    const isSystemRole = roleCode === 'SUPER_ADMIN' || roleCode === 'CUSTOMER';
    const clinicRole = await prisma.clinicRole.findFirst({
      where: {
        code: roleCode,
        clinicId: isSystemRole ? null : (u.clinicId ?? clinic.id),
      },
    });
    if (!clinicRole) continue;

    await prisma.user.update({
      where: { id: u.id },
      data: {
        roleId: clinicRole.id,
        systemRole: isSystemRole ? roleCode : null,
      },
    });
  }
  console.log(`  ✓ Migrated ${allUsers.length} users to ClinicRole`);
```

- [ ] **Step 4: Run seed**

```bash
cd packages/database
npm run db:seed
```

Expected output ends with:
```
  ✓ PageMaster & ActionMaster seeded
  ✓ ClinicRole: CLINIC_OWNER (0 permissions)
  ✓ ClinicRole: VET (8 permissions)
  ...
  ✓ System ClinicRoles (SUPER_ADMIN, CUSTOMER) seeded
  ✓ Migrated N users to ClinicRole
🎉 Seed complete!
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/seed.ts
git commit -m "feat(seed): add PageMaster, ActionMaster, ClinicRole seed data and user migration"
```

---

### Task 3: Create `ClinicRoleModule` in NestJS API

**Files:**
- Create: `apps/api/src/modules/clinic-role/clinic-role.module.ts`
- Create: `apps/api/src/modules/clinic-role/clinic-role.service.ts`
- Create: `apps/api/src/modules/clinic-role/clinic-role.controller.ts`
- Create: `apps/api/src/modules/clinic-role/dto/create-role.dto.ts`
- Create: `apps/api/src/modules/clinic-role/dto/update-role-permissions.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

Create `apps/api/src/modules/clinic-role/dto/create-role.dto.ts`:

```typescript
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;
}
```

Create `apps/api/src/modules/clinic-role/dto/update-role-permissions.dto.ts`:

```typescript
import { IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[]; // Array of action codes e.g. ["PATIENT:VIEW", "INVENTORY:ADD"]
}
```

- [ ] **Step 2: Create `ClinicRoleService`**

Create `apps/api/src/modules/clinic-role/clinic-role.service.ts`:

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class ClinicRoleService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List all active roles for a clinic */
  async listRoles(clinicId: string) {
    return this.prisma.clinicRole.findMany({
      where: { clinicId, isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        isSystem: true,
        isDeletable: true,
        _count: { select: { users: true } },
      },
    });
  }

  /** Create a custom clinic role */
  async createRole(clinicId: string, dto: CreateRoleDto) {
    // Generate code from name: "Senior Nurse" → "CUSTOM_SENIOR_NURSE"
    const code = 'CUSTOM_' + dto.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

    const existing = await this.prisma.clinicRole.findUnique({
      where: { clinicId_code: { clinicId, code } },
    });
    if (existing) {
      throw new BadRequestException(`A role with this name already exists.`);
    }

    return this.prisma.clinicRole.create({
      data: {
        clinicId,
        code,
        name: dto.name,
        isSystem: false,
        isDeletable: true,
        isActive: true,
      },
    });
  }

  /** Rename a role (name only — code never changes) */
  async renameRole(clinicId: string, roleId: string, name: string) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be renamed');

    return this.prisma.clinicRole.update({
      where: { id: roleId },
      data: { name },
    });
  }

  /** Delete a role — blocked if isDeletable=false or users exist */
  async deleteRole(clinicId: string, roleId: string) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (!role.isDeletable) {
      throw new BadRequestException('This role is a system role and cannot be deleted.');
    }

    const userCount = await this.prisma.user.count({
      where: { roleId },
    });
    if (userCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${userCount} user(s) still assigned to this role. Reassign them first.`,
      );
    }

    await this.prisma.clinicRole.delete({ where: { id: roleId } });
    return { deleted: true };
  }

  /** Get all permissions for a role */
  async getRolePermissions(clinicId: string, roleId: string) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');

    const perms = await this.prisma.clinicRolePermissionV2.findMany({
      where: { roleId },
      include: {
        page: { select: { code: true, name: true } },
        action: { select: { code: true, name: true } },
      },
    });

    return perms.map((p) => ({
      pageCode: p.page.code,
      pageName: p.page.name,
      actionCode: p.action?.code ?? null,
      actionName: p.action?.name ?? null,
    }));
  }

  /** Replace the full permission set for a role */
  async setRolePermissions(clinicId: string, roleId: string, actionCodes: string[]) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (!role.isDeletable && role.code === 'CLINIC_OWNER') {
      throw new BadRequestException('Clinic Owner permissions cannot be modified.');
    }

    // Validate all action codes exist
    const actions = await this.prisma.actionMaster.findMany({
      where: { code: { in: actionCodes }, isActive: true },
    });
    if (actions.length !== actionCodes.length) {
      const foundCodes = actions.map((a) => a.code);
      const invalid = actionCodes.filter((c) => !foundCodes.includes(c));
      throw new BadRequestException(`Invalid action codes: ${invalid.join(', ')}`);
    }

    // Replace all permissions in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.clinicRolePermissionV2.deleteMany({ where: { roleId } });
      for (const action of actions) {
        await tx.clinicRolePermissionV2.create({
          data: { roleId, pageId: action.pageId, actionId: action.id },
        });
      }
    });

    return this.getRolePermissions(clinicId, roleId);
  }

  /** List all pages + actions (for permission matrix UI) */
  async listPagesWithActions() {
    const pages = await this.prisma.pageMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        actions: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, code: true, name: true, description: true },
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        actions: true,
      },
    });
    return pages;
  }
}
```

- [ ] **Step 3: Create `ClinicRoleController`**

Create `apps/api/src/modules/clinic-role/clinic-role.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ClinicRoleService } from './clinic-role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('clinic/roles')
@Permissions('SETTINGS:MANAGE')
export class ClinicRoleController {
  constructor(private readonly roleService: ClinicRoleService) {}

  /** GET /api/v1/clinic/roles — list all roles for this clinic */
  @Get()
  list(@TenantId() clinicId: string) {
    return this.roleService.listRoles(clinicId);
  }

  /** POST /api/v1/clinic/roles — create a custom role */
  @Post()
  create(@Body() dto: CreateRoleDto, @TenantId() clinicId: string) {
    return this.roleService.createRole(clinicId, dto);
  }

  /** PATCH /api/v1/clinic/roles/:id — rename a role */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  rename(
    @Param('id') id: string,
    @Body() dto: { name: string },
    @TenantId() clinicId: string,
  ) {
    return this.roleService.renameRole(clinicId, id, dto.name);
  }

  /** DELETE /api/v1/clinic/roles/:id — delete a custom role */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string, @TenantId() clinicId: string) {
    return this.roleService.deleteRole(clinicId, id);
  }

  /** GET /api/v1/clinic/roles/:id/permissions */
  @Get(':id/permissions')
  getPermissions(@Param('id') id: string, @TenantId() clinicId: string) {
    return this.roleService.getRolePermissions(clinicId, id);
  }

  /** PUT /api/v1/clinic/roles/:id/permissions — replace full permission set */
  @Put(':id/permissions')
  @HttpCode(HttpStatus.OK)
  setPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @TenantId() clinicId: string,
  ) {
    return this.roleService.setRolePermissions(clinicId, id, dto.permissions);
  }
}

@Controller('clinic/pages')
@Permissions('SETTINGS:MANAGE')
export class ClinicPagesController {
  constructor(private readonly roleService: ClinicRoleService) {}

  /** GET /api/v1/clinic/pages — list all PageMaster + ActionMaster for UI */
  @Get()
  list() {
    return this.roleService.listPagesWithActions();
  }
}
```

- [ ] **Step 4: Create module file**

Create `apps/api/src/modules/clinic-role/clinic-role.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClinicRoleController, ClinicPagesController } from './clinic-role.controller';
import { ClinicRoleService } from './clinic-role.service';

@Module({
  controllers: [ClinicRoleController, ClinicPagesController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    ClinicRoleService,
  ],
  exports: [ClinicRoleService],
})
export class ClinicRoleModule {}
```

- [ ] **Step 5: Register module in app.module.ts**

Open `apps/api/src/app.module.ts`. Add the import:

```typescript
import { ClinicRoleModule } from './modules/clinic-role/clinic-role.module';
```

And add `ClinicRoleModule` to the `imports` array.

- [ ] **Step 6: Build to verify no TypeScript errors**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/clinic-role/
git add apps/api/src/app.module.ts
git commit -m "feat(api): add ClinicRoleModule with CRUD endpoints for dynamic role management"
```

---

### Task 4: Update `AuthService` — Permission Resolution from DB

**Files:**
- Modify: `apps/api/src/modules/identity/services/auth.service.ts`
- Modify: `packages/types/src/api.ts`
- Modify: `packages/types/src/enums.ts`

- [ ] **Step 1: Update `UserContext` and `AuthProfile` in `packages/types/src/api.ts`**

Open `packages/types/src/api.ts`. Replace the `UserContext` interface:

```typescript
export interface UserContext {
  userId: string;
  clinicId: string | null;
  clinicName: string | null;
  clinicSlug: string | null;
  // Legacy field kept for backward compat during migration — maps to roleCode
  role: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  systemRole: string | null; // "SUPER_ADMIN" | "CUSTOMER" | null
  permissions: string[];
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  preferredLocale: Locale;
  authorizedBranches: BranchSummary[];
  businessPartnerId?: string | null;
  currencyCode?: string | null;
  issuedAt?: number;
}
```

Replace the `AuthProfile` interface:

```typescript
export interface AuthProfile {
  id: string;
  name?: string;
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  role: string;         // backward compat — equals roleCode
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

- [ ] **Step 2: Add system role constants to `packages/types/src/enums.ts`**

Open `packages/types/src/enums.ts`. At the bottom of the file, add:

```typescript
// System-level role codes (non-clinic-scoped — these bypass normal permission checks)
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;
export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

// Reserved role codes that clinics cannot delete
export const SYSTEM_ROLE_CODES = [
  'CLINIC_OWNER', 'VET', 'CASHIER', 'STAFF', 'ASSISTANT',
  'SUPER_ADMIN', 'CUSTOMER',
] as const;
```

> NOTE: Do NOT remove the `Role` enum yet — it is still referenced in many files. It will be removed in Plan B.

- [ ] **Step 3: Update login permission resolution in `auth.service.ts`**

Open `apps/api/src/modules/identity/services/auth.service.ts`. Replace the permission resolution block (lines 162–176) with:

```typescript
    const userRole = user.role as unknown as Role;

    // --- New dynamic permission resolution ---
    let permissions: string[] = [];
    let resolvedRoleId: string = '';
    let resolvedRoleCode: string = userRole as string;
    let resolvedRoleName: string = userRole as string;
    let resolvedSystemRole: string | null = null;

    // Resolve the ClinicRole record if roleId is set (new system)
    if ((user as any).roleId) {
      const clinicRole = await this.prisma.clinicRole.findUnique({
        where: { id: (user as any).roleId },
        include: {
          permissions: {
            include: { action: { select: { code: true } } },
          },
        },
      });

      if (clinicRole) {
        resolvedRoleId = clinicRole.id;
        resolvedRoleCode = clinicRole.code;
        resolvedRoleName = clinicRole.name;
        resolvedSystemRole = (user as any).systemRole ?? null;

        if (
          resolvedRoleCode === 'CLINIC_OWNER' ||
          resolvedSystemRole === 'SUPER_ADMIN'
        ) {
          // Full access — load all action codes
          const allActions = await this.prisma.actionMaster.findMany({
            where: { isActive: true },
            select: { code: true },
          });
          permissions = allActions.map((a) => a.code);
        } else {
          permissions = clinicRole.permissions
            .filter((p) => p.action)
            .map((p) => p.action!.code);
        }
      }
    } else {
      // Fallback: legacy resolution for users not yet migrated
      if (user.clinicId) {
        const rolePerm = await this.prisma.clinicRolePermission.findFirst({
          where: { clinicId: user.clinicId, role: user.role },
        });
        if (rolePerm) permissions = rolePerm.permissions;
      }
      if (permissions.length === 0) {
        permissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
      }
    }
    // --- End new resolution ---
```

- [ ] **Step 4: Update the `userContext` object construction in `auth.service.ts`**

Replace the `userContext` construction (after the permission block):

```typescript
    const userContext: UserContext = {
      userId: user.id,
      clinicId: user.clinicId ?? null,
      clinicName: user.clinic?.name ?? null,
      clinicSlug: user.clinic?.slug ?? null,
      role: resolvedRoleCode,      // backward compat
      roleId: resolvedRoleId,
      roleCode: resolvedRoleCode,
      roleName: resolvedRoleName,
      systemRole: resolvedSystemRole,
      permissions,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword,
      preferredLocale: (user.preferredLocale as unknown as Locale) ?? Locale.TH,
      authorizedBranches,
      businessPartnerId: resolvedBpId,
      currencyCode: user.clinic?.currencyCode ?? 'THB',
    };
```

- [ ] **Step 5: Update `AuthProfile` in `auth.controller.ts`**

Open `apps/api/src/modules/identity/controllers/auth.controller.ts`. Find the section that builds `profile` (around line 200). Update it to include the new fields:

```typescript
    const profile: AuthProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword,
      role: userContext.roleCode,           // backward compat
      roleId: userContext.roleId,
      roleCode: userContext.roleCode,
      roleName: userContext.roleName,
      systemRole: userContext.systemRole,
      permissions,
      clinicName: user.clinic?.name ?? null,
      clinicSlug: user.clinic?.slug ?? null,
      branches: authorizedBranches,
      preferredLocale: userContext.preferredLocale,
      businessPartnerId: resolvedBpId,
      currencyCode: user.clinic?.currencyCode ?? 'THB',
    };
```

- [ ] **Step 6: Build to check for errors**

```bash
cd apps/api
npx tsc --noEmit
cd ../..
cd apps/web
npx tsc --noEmit
```

Fix any type errors that arise.

- [ ] **Step 7: Commit**

```bash
git add packages/types/src/api.ts packages/types/src/enums.ts
git add apps/api/src/modules/identity/services/auth.service.ts
git add apps/api/src/modules/identity/controllers/auth.controller.ts
git commit -m "feat(auth): resolve permissions from ClinicRole DB with backward-compat fallback"
```

---

### Task 5: Update `PermissionsGuard` — Add `roleCode` Bypass

**Files:**
- Modify: `apps/api/src/common/guards/permissions.guard.ts`

- [ ] **Step 1: Update the guard to use `roleCode` and `systemRole`**

Open `apps/api/src/common/guards/permissions.guard.ts`. Replace the entire file:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserContext } from '@petiatrics/types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Permissions() annotation — route is accessible to any authenticated user
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { userContext?: UserContext }>();
    const userContext = request.userContext;

    if (!userContext) {
      throw new ForbiddenException('User context not found');
    }

    // SUPER_ADMIN bypasses all permission checks
    if (userContext.systemRole === 'SUPER_ADMIN' || userContext.role === 'SUPER_ADMIN') {
      return true;
    }

    // CLINIC_OWNER has full access to their clinic
    if (userContext.roleCode === 'CLINIC_OWNER' || userContext.role === 'CLINIC_OWNER') {
      return true;
    }

    // CUSTOMER is blocked from all staff/clinic permissions
    if (userContext.systemRole === 'CUSTOMER' || userContext.role === 'CUSTOMER') {
      throw new ForbiddenException('Customers cannot access this resource.');
    }

    const userPermissions = userContext.permissions || [];
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Access denied. Required permission(s): ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
```

- [ ] **Step 2: Also update `RolesGuard` to use `roleCode` for backward compat**

Open `apps/api/src/common/guards/roles.guard.ts`. Replace the check:

```typescript
    // SUPER_ADMIN bypasses all role restrictions
    if (
      userContext.role === 'SUPER_ADMIN' ||
      (userContext as any).systemRole === 'SUPER_ADMIN'
    ) return true;

    const userRole = (userContext as any).roleCode ?? userContext.role;
    if (!requiredRoles.includes(userRole as any)) {
```

- [ ] **Step 3: Restart dev server and test login**

```bash
# In a new terminal
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"owner@happypaws.io","password":"Password@1"}'
```

Expected response includes `roleCode: "CLINIC_OWNER"`, `permissions: [...]` (all action codes).

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"vet@happypaws.io","password":"Password@1"}'
```

Expected: `roleCode: "VET"`, `permissions: ["PATIENT:VIEW","PATIENT:EDIT","VISIT:VIEW",...]`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/guards/permissions.guard.ts
git add apps/api/src/common/guards/roles.guard.ts
git commit -m "feat(guard): update PermissionsGuard to use roleCode/systemRole from dynamic RBAC"
```

---

### Task 6: Verify Full Build & Run Tests

- [ ] **Step 1: Run API unit tests**

```bash
cd apps/api
npm run test
```

Expected: all tests pass. If `RolesGuard` tests fail due to `Role` enum references, update them to use string role codes.

- [ ] **Step 2: Verify API starts cleanly**

Check the running dev server logs (it should already be running with `npm run dev`). Look for any startup errors in the terminal running dev.

- [ ] **Step 3: Test the new endpoints manually**

```bash
# First login as CLINIC_OWNER to get session cookie
# Then test:
curl -X GET http://localhost:3001/api/v1/clinic/roles \
  -H "Cookie: <session-cookie>"
```

Expected: list of 5 roles (CLINIC_OWNER, VET, CASHIER, STAFF, ASSISTANT).

```bash
curl -X GET http://localhost:3001/api/v1/clinic/pages \
  -H "Cookie: <session-cookie>"
```

Expected: list of 6 pages with their actions.

- [ ] **Step 4: Final commit and summary**

```bash
git add .
git commit -m "feat: complete Plan A - dynamic RBAC DB tables, seed, service, and auth integration"
```

---

## Verification Checklist

- [ ] `page_masters` table has 6 rows (PATIENTS, VISITS, INVENTORY, BILLING, PROCUREMENT, SETTINGS)
- [ ] `action_masters` table has 19 rows (all actions from seed)
- [ ] `clinic_roles` table has 7 rows per clinic (5 clinic roles + 2 system roles)
- [ ] `clinic_role_permissions_v2` table has correct permission rows for each role
- [ ] `User` records have `roleId` set
- [ ] Login returns `roleCode`, `roleId`, `roleName`, `systemRole` in session
- [ ] `CLINIC_OWNER` login returns all 19 permission codes
- [ ] `VET` login returns 8 permission codes
- [ ] `GET /clinic/roles` returns role list
- [ ] `GET /clinic/pages` returns page+action list
- [ ] `POST /clinic/roles` creates a custom role
- [ ] `DELETE /clinic/roles/:id` blocks deletion of `CLINIC_OWNER`
- [ ] API unit tests pass
