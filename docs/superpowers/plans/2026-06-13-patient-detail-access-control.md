# Patient Detail Access Control and Routing Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open patient, vaccination, and visit read endpoints to all clinic staff roles and B2C customers (under strict ownership check) on the NestJS API, and fix incorrect Next.js links using `/patients/...` instead of `/clinic/patients/...`.

**Architecture:** We will modify class-level `@Roles()` guards on `PatientController`, `VaccinationController`, and `VisitController` to allow all clinic roles plus the `CUSTOMER` role. The `PermissionsGuard` will be updated to bypass global `:VIEW` permission requirements for B2C customers, and we will enforce strict ownership validations (`pet.ownerUserId === user.userId`) inside the read endpoints. Incorrect links on the Next.js frontend will be updated to point to `/clinic/patients/...`.

**Tech Stack:** NestJS, TypeScript, MongoDB, Next.js, Jest

---

### Task 1: Add Permissions Guard Bypass Unit Tests

**Files:**
- Modify: `apps/api/src/common/guards/permissions.guard.spec.ts`

- [ ] **Step 1: Add new test cases to permissions.guard.spec.ts**
  Open [permissions.guard.spec.ts](file:///d:/Deaw/petiatrics/apps/api/src/common/guards/permissions.guard.spec.ts) and add test cases verifying that `PermissionsGuard` returns `true` for a `CUSTOMER` role when checking read-only permissions (`PATIENT:VIEW`, `VISIT:VIEW`), but throws a `ForbiddenException` for edit/write permissions.

  TargetContent:
  ```typescript
    it('should throw ForbiddenException if user lacks required permissions', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['VIEW_BILLING', 'MANAGE_BILLING']);

      const request = {
        userContext: {
          role: Role.VET,
          permissions: ['VIEW_BILLING'], // lacks MANAGE_BILLING
        },
      };

      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  ```

  ReplacementContent:
  ```typescript
    it('should throw ForbiddenException if user lacks required permissions', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['VIEW_BILLING', 'MANAGE_BILLING']);

      const request = {
        userContext: {
          role: Role.VET,
          permissions: ['VIEW_BILLING'], // lacks MANAGE_BILLING
        },
      };

      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should return true if user is CUSTOMER and all required permissions are read-only', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['PATIENT:VIEW', 'VISIT:VIEW']);

      const request = {
        userContext: {
          role: Role.CUSTOMER,
          permissions: [],
        },
      };

      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException if user is CUSTOMER and any required permission is write', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['PATIENT:VIEW', 'PATIENT:EDIT']);

      const request = {
        userContext: {
          role: Role.CUSTOMER,
          permissions: [],
        },
      };

      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  ```

- [ ] **Step 2: Run test suite to verify tests fail**
  Run: `npx jest src/common/guards/permissions.guard.spec.ts` under `apps/api`
  Expected: 2 failing tests related to CUSTOMER bypass.

- [ ] **Step 3: Commit**
  ```bash
  git add apps/api/src/common/guards/permissions.guard.spec.ts
  git commit -m "test(api): add tests for PermissionsGuard customer read-only bypass"
  ```

---

### Task 2: Implement Permissions Guard Bypass

**Files:**
- Modify: `apps/api/src/common/guards/permissions.guard.ts`

- [ ] **Step 1: Modify permissions.guard.ts**
  Open [permissions.guard.ts](file:///d:/Deaw/petiatrics/apps/api/src/common/guards/permissions.guard.ts) and add bypass logic for read-only permissions when the user role is `Role.CUSTOMER`.

  TargetContent:
  ```typescript
    // SUPER_ADMIN bypasses all permissions checks
    if (userContext.role === Role.SUPER_ADMIN) return true;

    const userPermissions = userContext.permissions || [];
  ```

  ReplacementContent:
  ```typescript
    // SUPER_ADMIN bypasses all permissions checks
    if (userContext.role === Role.SUPER_ADMIN) return true;

    // CUSTOMER role bypasses read-only permission checks (enforced via ownership checks in handlers)
    if (userContext.role === Role.CUSTOMER) {
      const isReadOnly = requiredPermissions.every(perm => perm.endsWith(':VIEW'));
      if (isReadOnly) return true;
    }

    const userPermissions = userContext.permissions || [];
  ```

- [ ] **Step 2: Run test suite to verify tests pass**
  Run: `npx jest src/common/guards/permissions.guard.spec.ts` under `apps/api`
  Expected: PASS

- [ ] **Step 3: Commit**
  ```bash
  git add apps/api/src/common/guards/permissions.guard.ts
  git commit -m "feat(api): implement PermissionsGuard read-only bypass for customers"
  ```

---

### Task 3: Modify TenantId Decorator for CUSTOMER Users

**Files:**
- Modify: `apps/api/src/common/decorators/tenant.decorator.ts`

- [ ] **Step 1: Update TenantId decorator**
  Open [tenant.decorator.ts](file:///d:/Deaw/petiatrics/apps/api/src/common/decorators/tenant.decorator.ts) and ensure it doesn't throw if `clinicId` is null for `Role.CUSTOMER` requests.

  TargetContent:
  ```typescript
  export const TenantId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
      const request = ctx.switchToHttp().getRequest<Request & { userContext?: UserContext }>();
      const clinicId = request.userContext?.clinicId;
      if (!clinicId) {
        throw new Error('TenantId decorator used on a route without a session context.');
      }
      return clinicId;
    },
  );
  ```

  ReplacementContent:
  ```typescript
  import { Role } from '@petiatrics/types';

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

- [ ] **Step 2: Commit**
  ```bash
  git add apps/api/src/common/decorators/tenant.decorator.ts
  git commit -m "feat(api): support null clinicId for customer sessions in TenantId decorator"
  ```

---

### Task 4: Add getOneCrossClinic to Vaccination & Visit Services

**Files:**
- Modify: `apps/api/src/modules/clinical/services/vaccination.service.ts`
- Modify: `apps/api/src/modules/clinical/services/visit.service.ts`

- [ ] **Step 1: Update vaccination.service.ts**
  Open [vaccination.service.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/services/vaccination.service.ts) and add `getOneCrossClinic` method.

  TargetContent:
  ```typescript
    async getOne(clinicId: string, id: string): Promise<IVaccinationRecord> {
      const doc = await this.vaccinationModel
        .findOne({ _id: id, clinicId })
        .exec();
      if (!doc) throw new NotFoundException(`Vaccination record ${id} not found.`);
      return doc;
    }
  }
  ```

  ReplacementContent:
  ```typescript
    async getOne(clinicId: string, id: string): Promise<IVaccinationRecord> {
      const doc = await this.vaccinationModel
        .findOne({ _id: id, clinicId })
        .exec();
      if (!doc) throw new NotFoundException(`Vaccination record ${id} not found.`);
      return doc;
    }

    async getOneCrossClinic(id: string): Promise<IVaccinationRecord> {
      const doc = await this.vaccinationModel
        .findOne({ _id: id })
        .exec();
      if (!doc) throw new NotFoundException(`Vaccination record ${id} not found.`);
      return doc;
    }
  }
  ```

- [ ] **Step 2: Update visit.service.ts**
  Open [visit.service.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/services/visit.service.ts) and add `getOneCrossClinic` method.

  TargetContent:
  ```typescript
    async getOne(clinicId: string, visitId: string): Promise<IVisitRecord> {
      const doc = await this.visitModel
        .findOne({ _id: visitId, clinicId })
        .exec();
      if (!doc) throw new NotFoundException(`Visit ${visitId} not found.`);
      return doc;
    }
  }
  ```

  ReplacementContent:
  ```typescript
    async getOne(clinicId: string, visitId: string): Promise<IVisitRecord> {
      const doc = await this.visitModel
        .findOne({ _id: visitId, clinicId })
        .exec();
      if (!doc) throw new NotFoundException(`Visit ${visitId} not found.`);
      return doc;
    }

    async getOneCrossClinic(visitId: string): Promise<IVisitRecord> {
      const doc = await this.visitModel
        .findOne({ _id: visitId })
        .exec();
      if (!doc) throw new NotFoundException(`Visit ${visitId} not found.`);
      return doc;
    }
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/api/src/modules/clinical/services/vaccination.service.ts apps/api/src/modules/clinical/services/visit.service.ts
  git commit -m "feat(api): implement cross-clinic fetchers in vaccination and visit services"
  ```

---

### Task 5: Implement Access Control in Patient Controller

**Files:**
- Modify: `apps/api/src/modules/clinical/controllers/patient.controller.ts`

- [ ] **Step 1: Modify roles and enforce customer checks in patient.controller.ts**
  Open [patient.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/controllers/patient.controller.ts).
  Add `ASSISTANT`, `CASHIER`, `STAFF`, and `CUSTOMER` to class-level `@Roles()` decorator.
  Import `ForbiddenException` from `@nestjs/common` and inject `PrismaClient` to fetch business partner clinics for customer cross-clinic `findAll` queries.

  TargetContent:
  ```typescript
  import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
  } from '@nestjs/common';
  import { Roles } from '../../../common/guards/roles.decorator';
  import { Permissions } from '../../../common/decorators/permissions.decorator';
  import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
  import { Role } from '@petiatrics/types';
  import { UserContext } from '@petiatrics/types';
  import { Audit } from '../../../common/interceptors/audit.interceptor';
  import { PatientService, CreatePatientDto, UpdatePatientDto } from '../services/patient.service';

  @Controller('patients')
  @Roles(Role.VET, Role.CLINIC_OWNER)
  export class PatientController {
    constructor(private readonly patientService: PatientService) {}
  ```

  ReplacementContent:
  ```typescript
  import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    ForbiddenException,
  } from '@nestjs/common';
  import { Roles } from '../../../common/guards/roles.decorator';
  import { Permissions } from '../../../common/decorators/permissions.decorator';
  import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
  import { Role } from '@petiatrics/types';
  import { UserContext } from '@petiatrics/types';
  import { Audit } from '../../../common/interceptors/audit.interceptor';
  import { PatientService, CreatePatientDto, UpdatePatientDto } from '../services/patient.service';
  import { PrismaClient } from '@prisma/client';

  @Controller('patients')
  @Roles(
    Role.CLINIC_OWNER,
    Role.VET,
    Role.ASSISTANT,
    Role.CASHIER,
    Role.STAFF,
    Role.CUSTOMER,
  )
  export class PatientController {
    constructor(
      private readonly patientService: PatientService,
      private readonly prisma: PrismaClient,
    ) {}
  ```

- [ ] **Step 2: Update findAll and findOne methods**
  Update `findAll` and `findOne` to support ownership validation and cross-clinic fetching for `Role.CUSTOMER`.

  TargetContent:
  ```typescript
    @Get()
    @Permissions('PATIENT:VIEW')
    findAll(
      @TenantId() clinicId: string,
      @Query('search') search?: string,
      @Query('ownerUserId') ownerUserId?: string,
    ) {
      return this.patientService.findAll(clinicId, search, ownerUserId);
    }

    @Get(':id')
    @Permissions('PATIENT:VIEW')
    findOne(
      @TenantId() clinicId: string,
      @Param('id') id: string,
    ) {
      return this.patientService.findById(clinicId, id);
    }
  ```

  ReplacementContent:
  ```typescript
    @Get()
    @Permissions('PATIENT:VIEW')
    async findAll(
      @TenantId() clinicId: string | null,
      @CurrentUser() user: UserContext,
      @Query('search') search?: string,
      @Query('ownerUserId') ownerUserId?: string,
    ) {
      if (user.role === Role.CUSTOMER) {
        // Enforce owner scope and fetch across all linked clinics
        const bps = await this.prisma.businessPartner.findMany({
          where: { linkedUserId: user.userId, isActive: true },
          select: { clinicId: true },
        });
        const clinicIds = bps.map((bp) => bp.clinicId);
        return this.patientService.findAllByOwnerCrossClinic(clinicIds, user.userId);
      }
      return this.patientService.findAll(clinicId!, search, ownerUserId);
    }

    @Get(':id')
    @Permissions('PATIENT:VIEW')
    async findOne(
      @TenantId() clinicId: string | null,
      @CurrentUser() user: UserContext,
      @Param('id') id: string,
    ) {
      if (user.role === Role.CUSTOMER) {
        const pet = await this.patientService.findByIdCrossClinic(id);
        if (pet.ownerUserId !== user.userId) {
          throw new ForbiddenException('You do not have permission to access this patient.');
        }
        return pet;
      }
      return this.patientService.findById(clinicId!, id);
    }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/api/src/modules/clinical/controllers/patient.controller.ts
  git commit -m "feat(api): implement staff roles and B2C customer ownership checks in PatientController"
  ```

---

### Task 6: Implement Access Control in Vaccination Controller

**Files:**
- Modify: `apps/api/src/modules/clinical/controllers/vaccination.controller.ts`

- [ ] **Step 1: Modify roles and checks in vaccination.controller.ts**
  Open [vaccination.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/controllers/vaccination.controller.ts).
  Add clinic staff and CUSTOMER roles to `@Roles()`.
  Inject `PatientService` to allow patient ownership lookup.
  Update endpoints to check ownership of the pet.

  TargetContent:
  ```typescript
  import {
    Body,
    Controller,
    Get,
    Param,
    Post,
  } from '@nestjs/common';
  import { Roles } from '../../../common/guards/roles.decorator';
  import { Permissions } from '../../../common/decorators/permissions.decorator';
  import { TenantId } from '../../../common/decorators/tenant.decorator';
  import { Role } from '@petiatrics/types';
  import { Audit } from '../../../common/interceptors/audit.interceptor';
  import { VaccinationService, CreateVaccinationDto } from '../services/vaccination.service';

  @Controller('patients/:patientId/vaccinations')
  @Roles(Role.VET, Role.CLINIC_OWNER)
  export class VaccinationController {
    constructor(private readonly vaccinationService: VaccinationService) {}
  ```

  ReplacementContent:
  ```typescript
  import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    ForbiddenException,
  } from '@nestjs/common';
  import { Roles } from '../../../common/guards/roles.decorator';
  import { Permissions } from '../../../common/decorators/permissions.decorator';
  import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
  import { Role, UserContext } from '@petiatrics/types';
  import { Audit } from '../../../common/interceptors/audit.interceptor';
  import { VaccinationService, CreateVaccinationDto } from '../services/vaccination.service';
  import { PatientService } from '../services/patient.service';

  @Controller('patients/:patientId/vaccinations')
  @Roles(
    Role.CLINIC_OWNER,
    Role.VET,
    Role.ASSISTANT,
    Role.CASHIER,
    Role.STAFF,
    Role.CUSTOMER,
  )
  export class VaccinationController {
    constructor(
      private readonly vaccinationService: VaccinationService,
      private readonly patientService: PatientService,
    ) {}
  ```

- [ ] **Step 2: Update read methods in vaccination.controller.ts**
  Enforce ownership checks on list and getOne methods.

  TargetContent:
  ```typescript
    @Get()
    @Permissions('VISIT:VIEW')
    list(
      @TenantId() clinicId: string,
      @Param('patientId') patientId: string,
    ) {
      return this.vaccinationService.listByPatient(clinicId, patientId);
    }

    @Get(':id')
    @Permissions('VISIT:VIEW')
    getOne(
      @TenantId() clinicId: string,
      @Param('id') id: string,
    ) {
      return this.vaccinationService.getOne(clinicId, id);
    }
  ```

  ReplacementContent:
  ```typescript
    @Get()
    @Permissions('VISIT:VIEW')
    async list(
      @TenantId() clinicId: string | null,
      @CurrentUser() user: UserContext,
      @Param('patientId') patientId: string,
    ) {
      if (user.role === Role.CUSTOMER) {
        const pet = await this.patientService.findByIdCrossClinic(patientId);
        if (pet.ownerUserId !== user.userId) {
          throw new ForbiddenException('You do not have permission to access records for this pet.');
        }
        return this.vaccinationService.listByPatient(pet.clinicId, patientId);
      }
      return this.vaccinationService.listByPatient(clinicId!, patientId);
    }

    @Get(':id')
    @Permissions('VISIT:VIEW')
    async getOne(
      @TenantId() clinicId: string | null,
      @CurrentUser() user: UserContext,
      @Param('id') id: string,
    ) {
      if (user.role === Role.CUSTOMER) {
        const vax = await this.vaccinationService.getOneCrossClinic(id);
        const pet = await this.patientService.findByIdCrossClinic(vax.patientId.toString());
        if (pet.ownerUserId !== user.userId) {
          throw new ForbiddenException('You do not have permission to access records for this pet.');
        }
        return vax;
      }
      return this.vaccinationService.getOne(clinicId!, id);
    }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/api/src/modules/clinical/controllers/vaccination.controller.ts
  git commit -m "feat(api): implement staff roles and B2C customer ownership checks in VaccinationController"
  ```

---

### Task 7: Implement Access Control in Visit Controller

**Files:**
- Modify: `apps/api/src/modules/clinical/controllers/visit.controller.ts`

- [ ] **Step 1: Modify roles and checks in visit.controller.ts**
  Open [visit.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/controllers/visit.controller.ts).
  Add clinic staff and CUSTOMER roles to `@Roles()`.
  Inject `PatientService`.
  Update list and getOne methods to check pet ownership.

  TargetContent:
  ```typescript
  import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
  } from '@nestjs/common';
  import { Roles } from '../../../common/guards/roles.decorator';
  import { Permissions } from '../../../common/decorators/permissions.decorator';
  import { ActiveBranch, CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
  import { Role } from '@petiatrics/types';
  import { UserContext } from '@petiatrics/types';
  import { Audit } from '../../../common/interceptors/audit.interceptor';
  import {
    VisitService,
    CreateVisitDto,
    UpdateVisitDto,
    AmendVisitDto,
  } from '../services/visit.service';

  @Controller('patients/:patientId/visits')
  @Roles(Role.VET, Role.CLINIC_OWNER)
  export class VisitController {
    constructor(private readonly visitService: VisitService) {}
  ```

  ReplacementContent:
  ```typescript
  import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    ForbiddenException,
  } from '@nestjs/common';
  import { Roles } from '../../../common/guards/roles.decorator';
  import { Permissions } from '../../../common/decorators/permissions.decorator';
  import { ActiveBranch, CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
  import { Role } from '@petiatrics/types';
  import { UserContext } from '@petiatrics/types';
  import { Audit } from '../../../common/interceptors/audit.interceptor';
  import {
    VisitService,
    CreateVisitDto,
    UpdateVisitDto,
    AmendVisitDto,
  } from '../services/visit.service';
  import { PatientService } from '../services/patient.service';

  @Controller('patients/:patientId/visits')
  @Roles(
    Role.CLINIC_OWNER,
    Role.VET,
    Role.ASSISTANT,
    Role.CASHIER,
    Role.STAFF,
    Role.CUSTOMER,
  )
  export class VisitController {
    constructor(
      private readonly visitService: VisitService,
      private readonly patientService: PatientService,
    ) {}
  ```

- [ ] **Step 2: Update read methods in visit.controller.ts**
  Enforce ownership checks on list and getOne methods.

  TargetContent:
  ```typescript
    @Get()
    @Permissions('VISIT:VIEW')
    list(
      @TenantId() clinicId: string,
      @Param('patientId') patientId: string,
    ) {
      return this.visitService.findByPatient(clinicId, patientId);
    }

    @Get(':visitId')
    @Permissions('VISIT:VIEW')
    getOne(
      @TenantId() clinicId: string,
      @Param('visitId') visitId: string,
    ) {
      return this.visitService.getOne(clinicId, visitId);
    }
  ```

  ReplacementContent:
  ```typescript
    @Get()
    @Permissions('VISIT:VIEW')
    async list(
      @TenantId() clinicId: string | null,
      @CurrentUser() user: UserContext,
      @Param('patientId') patientId: string,
    ) {
      if (user.role === Role.CUSTOMER) {
        const pet = await this.patientService.findByIdCrossClinic(patientId);
        if (pet.ownerUserId !== user.userId) {
          throw new ForbiddenException('You do not have permission to access records for this pet.');
        }
        return this.visitService.findByPatient(pet.clinicId, patientId);
      }
      return this.visitService.findByPatient(clinicId!, patientId);
    }

    @Get(':visitId')
    @Permissions('VISIT:VIEW')
    async getOne(
      @TenantId() clinicId: string | null,
      @CurrentUser() user: UserContext,
      @Param('visitId') visitId: string,
    ) {
      if (user.role === Role.CUSTOMER) {
        const visit = await this.visitService.getOneCrossClinic(visitId);
        const pet = await this.patientService.findByIdCrossClinic(visit.patientId.toString());
        if (pet.ownerUserId !== user.userId) {
          throw new ForbiddenException('You do not have permission to access records for this pet.');
        }
        return visit;
      }
      return this.visitService.getOne(clinicId!, visitId);
    }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/api/src/modules/clinical/controllers/visit.controller.ts
  git commit -m "feat(api): implement staff roles and B2C customer ownership checks in VisitController"
  ```

---

### Task 8: Update Broken UI Patient Links

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/patients/patients-client.tsx`
- Modify: `apps/web/app/(clinic)/clinic/patients/[id]/patient-profile-client.tsx`
- Modify: `apps/web/app/(clinic)/clinic/patients/[id]/visits/new/page.tsx`
- Modify: `apps/web/app/(clinic)/clinic/patients/[id]/visits/[visitId]/visit-detail-client.tsx`
- Modify: `apps/web/app/(clinic)/clinic/clients/[id]/client-detail-client.tsx`

- [ ] **Step 1: Fix patients-client.tsx**
  Open [patients-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/patients-client.tsx) and change the patient link.

  TargetContent:
  ```typescript
                      href={`/patients/${p._id}`}
  ```

  ReplacementContent:
  ```typescript
                      href={`/clinic/patients/${p._id}`}
  ```

- [ ] **Step 2: Fix patient-profile-client.tsx**
  Open [patient-profile-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/[id]/patient-profile-client.tsx) and change the "New Visit" and visit list links.

  TargetContent:
  ```typescript
        <Link href={`/patients/${patient._id}/visits/new`}>
          <Button>+ New Visit</Button>
        </Link>
  ```
  ... and ...
  ```typescript
                <Link
                  key={v._id}
                  href={`/patients/${patient._id}/visits/${v._id}`}
                  className="block rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                >
  ```

  ReplacementContent:
  ```typescript
        <Link href={`/clinic/patients/${patient._id}/visits/new`}>
          <Button>+ New Visit</Button>
        </Link>
  ```
  ... and ...
  ```typescript
                <Link
                  key={v._id}
                  href={`/clinic/patients/${patient._id}/visits/${v._id}`}
                  className="block rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                >
  ```

- [ ] **Step 3: Fix visits/new/page.tsx**
  Open [page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/[id]/visits/new/page.tsx) and update links.

  TargetContent:
  ```typescript
      router.push(`/patients/${patientId}/visits/${visit._id}`);
  ```
  ... and ...
  ```typescript
            onClick={() => router.push(`/patients/${patientId}`)}
  ```

  ReplacementContent:
  ```typescript
      router.push(`/clinic/patients/${patientId}/visits/${visit._id}`);
  ```
  ... and ...
  ```typescript
            onClick={() => router.push(`/clinic/patients/${patientId}`)}
  ```

- [ ] **Step 4: Fix visit-detail-client.tsx**
  Open [visit-detail-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/[id]/visits/[visitId]/visit-detail-client.tsx) and update back-links.

  TargetContent:
  ```typescript
          <Link href={`/patients/${patientId}`}>
  ```

  ReplacementContent:
  ```typescript
          <Link href={`/clinic/patients/${patientId}`}>
  ```

- [ ] **Step 5: Fix client-detail-client.tsx**
  Open [client-detail-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/clients/[id]/client-detail-client.tsx) and update pet link.

  TargetContent:
  ```typescript
                      <Link href={`/patients/${pet._id}`} className="text-primary hover:underline text-xs font-semibold">
  ```

  ReplacementContent:
  ```typescript
                      <Link href={`/clinic/patients/${pet._id}`} className="text-primary hover:underline text-xs font-semibold">
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add apps/web/app/(clinic)/clinic/patients/patients-client.tsx apps/web/app/(clinic)/clinic/patients/[id]/patient-profile-client.tsx apps/web/app/(clinic)/clinic/patients/[id]/visits/new/page.tsx apps/web/app/(clinic)/clinic/patients/[id]/visits/[visitId]/visit-detail-client.tsx apps/web/app/(clinic)/clinic/clients/[id]/client-detail-client.tsx
  git commit -m "fix(web): update patients navigation and links to use /clinic/patients prefix"
  ```

---

### Task 9: Verification and Clean Build

**Files:**
- Test: All API and Web builds

- [ ] **Step 1: Run full API tests**
  Run: `npm run test` under `apps/api`
  Expected: PASS

- [ ] **Step 2: Run Next.js build**
  Run: `npm run build` in root directory
  Expected: Clean build without typescript or lint errors.
