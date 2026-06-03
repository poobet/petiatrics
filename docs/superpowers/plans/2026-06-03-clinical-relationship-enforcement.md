# Clinical Relationship Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce strict relationships and medical record segregation between Pet Owners, Pets, and Visit records, ensuring MongoDB schemas require `ownerUserId`, the backend automatically resolves it on creation, the owner portal APIs validate ownership securely, and the frontend owner portal loads visits through a secure endpoint.

**Architecture:** Add `ownerUserId` to MongoDB `VisitRecord` schema and its compound index. Resolve `ownerUserId` automatically in `VisitService.create` from the pet profile. Add ownership validation guards in `OwnerController` (throwing `ForbiddenException` for unauthorized queries) and implement a secure owner-specific single visit record endpoint. Align the owner portal UI to fetch visit details using this new secure route.

**Tech Stack:** NestJS, TypeScript, MongoDB (Mongoose), Next.js (App Router), Prisma

---

### Task 1: MongoDB Schema & Seed Script Updates

**Files:**
- Modify: `packages/database/mongo/visit-record.schema.ts`
- Modify: `packages/database/src/seed.ts`

- [ ] **Step 1: Update IVisitRecord interface and Schema definition**
  Update the `IVisitRecord` interface in [visit-record.schema.ts](file:///d:/Deaw/petiatrics/packages/database/mongo/visit-record.schema.ts) to declare `ownerUserId` (string). Update `VisitRecordSchema` to include `ownerUserId` as a required and indexed String field, and add a compound index for `clinicId`, `patientId`, and `ownerUserId`.

  Replace lines 26-43:
  ```typescript
  export interface IVisitRecord extends mongoose.Document {
    clinicId: string;
    branchId: string;
    patientId: mongoose.Types.ObjectId;
    ownerUserId: string; // UUID of owner User in PostgreSQL
    appointmentId?: string | null; // UUID of Appointment in PostgreSQL
    vetId: string; // UUID of User in PostgreSQL
    visitDate: Date;
    soap: ISOAP;
    prescriptions: IPrescription[];
    attachments: IAttachment[];
    status: VisitStatus;
    finalizedAt?: Date | null;
    amendedAt?: Date | null;
    amendedBy?: string | null;
    amendmentReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
  ```

  Replace lines 75-105:
  ```typescript
  const VisitRecordSchema = new mongoose.Schema<IVisitRecord>(
    {
      clinicId: { type: String, required: true, index: true },
      branchId: { type: String, required: true, index: true },
      patientId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'PetProfile' },
      ownerUserId: { type: String, required: true, index: true },
      appointmentId: { type: String, default: null },
      vetId: { type: String, required: true },
      visitDate: { type: Date, required: true, default: Date.now },
      soap: { type: SOAPSchema, required: true, default: {} },
      prescriptions: { type: [PrescriptionSchema], default: [] },
      attachments: { type: [AttachmentSchema], default: [] },
      status: {
        type: String,
        enum: ['draft', 'finalized', 'amended'],
        default: 'draft',
      },
      finalizedAt: { type: Date, default: null },
      amendedAt: { type: Date, default: null },
      amendedBy: { type: String, default: null },
      amendmentReason: { type: String, default: null },
    },
    {
      timestamps: true,
      collection: 'visit_records',
    },
  );

  VisitRecordSchema.index({ clinicId: 1, patientId: 1, ownerUserId: 1 });
  VisitRecordSchema.index({ clinicId: 1, vetId: 1 });
  VisitRecordSchema.index({ clinicId: 1, status: 1 });
  ```

- [ ] **Step 2: Update Seed Script to populate ownerUserId**
  Update the MongoDB seed block in [seed.ts](file:///d:/Deaw/petiatrics/packages/database/src/seed.ts) to populate `ownerUserId: ownerUser.id` for seeded visits.

  Replace lines 360-410:
  ```typescript
      const existingVisits = await VisitRecord.find({ clinicId: clinic.id }).lean();
      if (existingVisits.length === 0) {
        const visitData = [
          {
            clinicId: clinic.id,
            branchId: branchMain.id,
            patientId: petIds[0],
            ownerUserId: ownerUser.id,
            vetId,
            visitDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            soap: {
              subjective: 'Owner reports lethargy and reduced appetite for 2 days.',
              objective: 'Temperature 38.9°C, heart rate 110 bpm. Mild dehydration noted.',
              assessment: 'Mild gastroenteritis. No systemic involvement.',
              plan: 'Supportive care. Bland diet x5 days. Recheck if not improving.',
            },
            prescriptions: [
              {
                drug: 'Metronidazole 125mg',
                dosage: '1 tablet',
                frequency: 'Twice daily',
                duration: '5 days',
                productId: null,
                inventoryLinked: false,
              },
            ],
            attachments: [],
            status: 'finalized',
            finalizedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
          {
            clinicId: clinic.id,
            branchId: branchMain.id,
            patientId: petIds.length > 1 ? petIds[1] : petIds[0],
            ownerUserId: ownerUser.id,
            vetId,
            visitDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            soap: {
              subjective: 'Annual wellness check.',
              objective: 'BCS 5/9. Teeth tartar grade 1. All lymph nodes normal.',
              assessment: 'Healthy adult cat. Dental prophylaxis recommended.',
              plan: 'Rabies booster administered. Schedule dental cleaning in 3 months.',
            },
            prescriptions: [],
            attachments: [],
            status: 'finalized',
            finalizedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
          },
        ];
        for (const v of visitData) {
          await VisitRecord.create(v);
          console.log('✓ Visit record created');
        }
      }
  ```

- [ ] **Step 3: Run Database Seeding**
  Run the seed script in packages/database directory to verify compilation and database seed functionality.
  Run: `npm run db:seed`
  Expected: Output ends with `🎉 Seed complete!` and no MongoDB schema/validation errors.

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git add packages/database/mongo/visit-record.schema.ts packages/database/src/seed.ts
  git commit -m "db: update visit record schema and seed with ownerUserId"
  ```

---

### Task 2: Backend Services Relationship Enforcements

**Files:**
- Modify: `apps/api/src/modules/clinical/services/patient.service.ts`
- Modify: `apps/api/src/modules/clinical/services/visit.service.ts`

- [ ] **Step 1: Add findAllByOwner helper to PatientService**
  Add the helper method `findAllByOwner` to [patient.service.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/services/patient.service.ts).

  Replace lines 74-76:
  ```typescript
    async findAllByOwner(clinicId: string, ownerUserId: string): Promise<IPetProfile[]> {
      return this.findAll(clinicId, undefined, ownerUserId);
    }
  }
  ```

- [ ] **Step 2: Inject PetProfile model and resolve ownerUserId in VisitService**
  Modify [visit.service.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/services/visit.service.ts) to inject the `PetProfileModel` and look up the pet during visit creation to retrieve and populate the `ownerUserId`.

  Update imports at line 10:
  ```typescript
  import { IVisitRecord, IPetProfile, MODEL_NAMES } from '@petiatrics/database';
  ```

  Update constructor injection (lines 57-62):
  ```typescript
    constructor(
      @InjectModel(MODEL_NAMES.VISIT_RECORD)
      private readonly visitModel: Model<IVisitRecord>,
      @InjectModel(MODEL_NAMES.PET_PROFILE)
      private readonly petProfileModel: Model<IPetProfile>,
      private readonly events: EventEmitter2,
      private readonly stockService: StockService,
    ) {}
  ```

  Update `create` method implementation (lines 64-78):
  ```typescript
    async create(clinicId: string, dto: CreateVisitDto): Promise<IVisitRecord> {
      const pet = await this.petProfileModel
        .findOne({ _id: dto.patientId, clinicId })
        .exec();
      if (!pet) {
        throw new NotFoundException(`Patient ${dto.patientId} not found.`);
      }

      const doc = new this.visitModel({
        clinicId,
        branchId: dto.branchId,
        patientId: dto.patientId,
        ownerUserId: pet.ownerUserId, // Enforce relationship binding
        vetId: dto.vetId,
        chiefComplaint: dto.chiefComplaint,
        soap: dto.soap ?? {},
        prescriptions: dto.prescriptions ?? [],
        attachments: [],
        status: 'draft',
        visitDate: new Date(),
      });
      return doc.save();
    }
  ```

- [ ] **Step 3: Build backend and verify compilation**
  Run: `npm run build` from the workspace root.
  Expected: Successful compilation without TypeScript errors.

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git add apps/api/src/modules/clinical/services/patient.service.ts apps/api/src/modules/clinical/services/visit.service.ts
  git commit -m "feat: resolve ownerUserId from pet profile on visit record creation"
  ```

---

### Task 3: Backend OwnerController Security Checks

**Files:**
- Modify: `apps/api/src/modules/clinical/controllers/owner.controller.ts`

- [ ] **Step 1: Implement ownership validation guard and secure endpoints**
  Update [owner.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/controllers/owner.controller.ts) to import `ForbiddenException` and `NotFoundException`. Implement `validatePetOwnership` helper and apply it to pet record, vaccination, and the new single-visit record endpoints.

  Replace the entire content of [owner.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/controllers/owner.controller.ts):
  ```typescript
  import {
    Controller,
    Get,
    Param,
    ForbiddenException,
    NotFoundException,
  } from '@nestjs/common';
  import { Roles } from '../../../common/guards/roles.decorator';
  import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
  import { Role, UserContext } from '@petiatrics/types';
  import { PatientService } from '../services/patient.service';
  import { VisitService } from '../services/visit.service';
  import { VaccinationService } from '../services/vaccination.service';

  @Controller('owner')
  @Roles(Role.STAFF)
  export class OwnerController {
    constructor(
      private readonly patientService: PatientService,
      private readonly visitService: VisitService,
      private readonly vaccinationService: VaccinationService,
    ) {}

    private async validatePetOwnership(clinicId: string, petId: string, userId: string): Promise<void> {
      const pet = await this.patientService.findById(clinicId, petId);
      if (pet.ownerUserId !== userId) {
        throw new ForbiddenException('You do not have permission to access records for this pet.');
      }
    }

    @Get('pets')
    getPets(@TenantId() clinicId: string, @CurrentUser() user: UserContext) {
      // Owners only see their own pets by filtering on ownerUserId
      return this.patientService.findAllByOwner(clinicId, user.userId);
    }

    @Get('pets/:id/records')
    async getPetRecords(
      @TenantId() clinicId: string,
      @CurrentUser() user: UserContext,
      @Param('id') petId: string,
    ) {
      await this.validatePetOwnership(clinicId, petId, user.userId);
      return this.visitService.findByPatient(clinicId, petId);
    }

    @Get('pets/:id/vaccinations')
    async getPetVaccinations(
      @TenantId() clinicId: string,
      @CurrentUser() user: UserContext,
      @Param('id') petId: string,
    ) {
      await this.validatePetOwnership(clinicId, petId, user.userId);
      return this.vaccinationService.listByPatient(clinicId, petId);
    }

    @Get('pets/:id/records/:visitId')
    async getPetRecord(
      @TenantId() clinicId: string,
      @CurrentUser() user: UserContext,
      @Param('id') petId: string,
      @Param('visitId') visitId: string,
    ) {
      await this.validatePetOwnership(clinicId, petId, user.userId);
      const visit = await this.visitService.getOne(clinicId, visitId);
      if (visit.patientId.toString() !== petId) {
        throw new NotFoundException('Visit record not found for this pet.');
      }
      return visit;
    }
  }
  ```

- [ ] **Step 2: Build backend to verify code correctness**
  Run: `npm run build`
  Expected: Successful compilation without errors.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add apps/api/src/modules/clinical/controllers/owner.controller.ts
  git commit -m "sec: enforce pet ownership checks on owner records and add secure visit detail endpoint"
  ```

---

### Task 4: Frontend UI Alignment for Owner Portal

**Files:**
- Modify: `apps/web/app/(pet-owner)/my/pets/[id]/visits/[visitId]/page.tsx`

- [ ] **Step 1: Align fetch endpoint to use secure owner route**
  Update the pet owner visit detail page at [page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(pet-owner)/my/pets/[id]/visits/[visitId]/page.tsx) to fetch from the newly created secure endpoint `/api/v1/owner/pets/:id/records/:visitId` instead of the general clinic-facing `/api/v1/patients/:id/visits/:visitId` endpoint.

  Replace lines 37-41:
  ```typescript
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/v1/owner/pets/${id}/records/${visitId}`, {
      headers: { Cookie: `petiatrics_sid=${sid}` },
      cache: 'no-store',
    });
  ```

- [ ] **Step 2: Build workspace and run check**
  Run: `npm run build`
  Expected: Complete successful build of all packages and apps (web & api).

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add apps/web/app/\(pet-owner\)/my/pets/\[id\]/visits/\[visitId\]/page.tsx
  git commit -m "ui: align owner visit detail page fetch url to secure owner endpoint"
  ```
