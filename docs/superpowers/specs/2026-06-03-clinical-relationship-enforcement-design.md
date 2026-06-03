# Design Specification: Clinical Relationship Enforcement and Segregation

This document specifies the design for enforcing strict relationships and medical record segregation between Pet Owners, Pets (Patients), and Visit/Medical Records in MongoDB schemas, NestJS backend services/controllers, and the Next.js UI.

## Goal

Ensure that:
1. Every `VisitRecord` MongoDB document explicitly contains `ownerUserId` (linking to PostgreSQL user ID) and `patientId` (linking to MongoDB `PetProfile` ObjectId).
2. The `VisitService` resolves and enforces these relationships securely at the service layer upon visit creation.
3. Access to pet profiles, records, and vaccinations in the owner portal (`OwnerController`) is strictly validated against the currently authenticated pet owner's UUID.
4. The frontend UI operates on a per-pet basis and handles owner-portal visit retrieval securely.

---

## 1. Database Schema Updates

### 1.1 MongoDB: Visit Record Schema ([visit-record.schema.ts](file:///d:/Deaw/petiatrics/packages/database/mongo/visit-record.schema.ts))
* Update `IVisitRecord` interface:
  ```typescript
  ownerUserId: string; // PostgreSQL User UUID
  ```
* Update `VisitRecordSchema` definition:
  ```typescript
  ownerUserId: { type: String, required: true, index: true }
  ```
* Add a compound index to support fast and safe queries:
  ```typescript
  VisitRecordSchema.index({ clinicId: 1, patientId: 1, ownerUserId: 1 });
  ```

### 1.2 Database Seeding ([seed.ts](file:///d:/Deaw/petiatrics/packages/database/src/seed.ts))
* Update the seed script block where `VisitRecord` documents are created:
  Ensure `ownerUserId` is specified and populated from the corresponding pet's owner ID (`ownerUser.id`).

---

## 2. Backend Services & Controllers

### 2.1 Patient Service ([patient.service.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/services/patient.service.ts))
* Ensure a method exists to retrieve all pets belonging to a specific owner:
  ```typescript
  async findAllByOwner(clinicId: string, ownerUserId: string): Promise<IPetProfile[]> {
    return this.findAll(clinicId, undefined, ownerUserId);
  }
  ```

### 2.2 Visit Service ([visit.service.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/services/visit.service.ts))
* Enforce `ownerUserId` resolution upon visit creation:
  In `VisitService.create(clinicId, dto: CreateVisitDto)`:
  * Look up the `PetProfile` by `dto.patientId` (e.g. `this.petProfileModel.findOne({ _id: dto.patientId, clinicId })`).
  * If the pet is not found, throw a `NotFoundException` (`"Patient not found."`).
  * Assign `ownerUserId: pet.ownerUserId` on the new `VisitRecord` document.

### 2.3 Owner Controller ([owner.controller.ts](file:///d:/Deaw/petiatrics/apps/api/src/modules/clinical/controllers/owner.controller.ts))
* Add security checks on all endpoints querying a specific pet's details/records. For any pet ID passed:
  * Query `PatientService.findById(clinicId, petId)`.
  * Verify that `pet.ownerUserId === user.userId`.
  * If not matching, throw a `ForbiddenException("You do not have permission to access records for this pet.")`.
* Add a new endpoint to securely retrieve a single visit record for a pet:
  * **GET** `/owner/pets/:id/records/:visitId`
  * Verifies pet ownership first, fetches the visit, validates that `visit.patientId` matches the pet ID, and returns the visit.

---

## 3. Frontend UI Alignment

### 3.1 Clinic Portal: Patient Profile Client ([patient-profile-client.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(clinic)/clinic/patients/[id]/patient-profile-client.tsx))
* Verify that the client fetches visit records scoped strictly to the current patient:
  `/api/v1/patients/${patient._id}/visits`
  * This maps to the clinic-facing `VisitController` which fetches visits filtered by `patientId`.

### 3.2 Pet Owner Portal: Pet Detail View ([page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(pet-owner)/my/pets/[id]/page.tsx))
* Verify that the page fetches visits and vaccinations scoped to the pet ID:
  `/api/v1/owner/pets/${id}/records`
  `/api/v1/owner/pets/${id}/vaccinations`
  * With the security checks in place on `OwnerController`, this ensures owners can only access records of their own pets.

### 3.3 Pet Owner Portal: Visit Detail View ([page.tsx](file:///d:/Deaw/petiatrics/apps/web/app/(pet-owner)/my/pets/[id]/visits/[visitId]/page.tsx))
* Update the fetch URL to use the secure owner-scoped single visit endpoint:
  `/api/v1/owner/pets/${id}/records/${visitId}`
  * This replaces the direct clinic-facing endpoint request (`/api/v1/patients/${id}/visits/${visitId}`) which is restricted to clinic roles.

---

## 4. Verification Plan

### 4.1 Automated/Service Tests
* Run database seed script: `npm run db:seed` and verify it succeeds under the new MongoDB schemas.
* Verify through tests/cURL requests:
  * Creating a visit for a non-existent pet throws `404 Not Found`.
  * Creating a visit for a valid pet successfully resolves and saves the pet's `ownerUserId` on the visit document.
  * Accessing `/api/v1/owner/pets/:id/records` with a pet ID belonging to a different owner throws `403 Forbidden`.
  * Accessing `/api/v1/owner/pets/:id/records/:visitId` with a pet ID/visit ID belonging to a different owner throws `403 Forbidden`.

### 4.2 Manual Verification
* Log in to the Clinic Portal, view a patient profile, and verify that visits are loaded successfully.
* Log in to the Pet Owner Portal, select a pet, view visit history, and view individual visit details.
