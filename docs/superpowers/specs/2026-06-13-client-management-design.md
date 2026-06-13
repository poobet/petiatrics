# Design Specification: Client Management Module & Contextual Pet Addition

**Date**: 2026-06-13
**Feature Branch**: `feature/multi-clinic-bp-architecture`

---

## 1. Goal & Context

In the new B2C Business Partner (BP) architecture, walk-in pet owners are registered as clinic customers. 
To streamline clinic operations, this feature introduces a dedicated Client Management module inside the Clinic Portal. Staff can view a directory of clients, register walk-in pet owners (creating both a Customer `User` and their linked `BusinessPartner` record), view a client's detail dashboard aggregating their demographics/BP info along with a roster of their pets, and contextually add pets with locked owner linkage.

---

## 2. Requirements

1. **Client Directory (List)**:
   - Route: `/clinic/clients`
   - Shows all user accounts in the current clinic with the `CUSTOMER` role.
   - Includes their auto-generated Business Partner (BP) code and contact info.
2. **Client Registration (Create)**:
   - Route: `/clinic/clients/new`
   - Form for staff to input a client's name, email, phone, Line ID, Tax ID, and address details.
   - Automatically registers the user as a `CUSTOMER` and triggers BP creation transactional logic.
3. **Client Profile Dashboard (Details)**:
   - Route: `/clinic/clients/[id]`
   - Aggregates demographic details and shows a table of all pets belonging to this `ownerUserId`.
   - Features an "+ Add Pet" button that passes the owner ID to the pet form.
4. **Standalone Pet Form & Auto-selection**:
   - Route: `/clinic/patients/new`
   - Form to create a new pet/patient.
   - Reads `ownerId` from the URL parameters (`?ownerId=[id]`). If present, locks and disables the Owner dropdown to that ID. If not present, shows a searchable Combobox of all `CUSTOMER` users.

---

## 3. Database & API Architecture

### User & Business Partner Relation (Prisma)
- PostgreSQL stores the tenant-scoped relationship: `User` has a unique `clinicId` and role `CUSTOMER`, and is linked 1-to-1 per clinic to a `BusinessPartner` of type `CUSTOMER`.
- MongoDB stores the patient records: `IPetProfile` contains `clinicId` and `ownerUserId` (referencing PostgreSQL `User.id`).

### Backend Endpoints

#### 1. Clients Controller (`apps/api/src/modules/identity/controllers/clients.controller.ts`)
Exposes endpoints prefix `/clinic/clients`:
- `GET /`: Lists all `User` records with `role: CUSTOMER` belonging to the caller's clinic, including their linked `businessPartners`. Guarded by `@Permissions('PATIENT:VIEW')`.
- `GET /:id`: Retrieves a single customer user, including their linked business partner details. Guarded by `@Permissions('PATIENT:VIEW')`.
- `POST /`: Creates a walk-in client. Generates a random temporary password for the customer, creates the `User` with role `CUSTOMER`, executes `UserService.createCustomerBpWithCode` to generate the BusinessPartner with auto-sequenced code (e.g. `C-0001`), updates the business partner details (phone, address, taxId, lineId), and returns the created user. Guarded by `@Permissions('PATIENT:EDIT')`.

#### 2. Patients Controller Update (`apps/api/src/modules/clinical/controllers/patient.controller.ts`)
- Update `GET /patients` to accept an optional query parameter `ownerUserId`.
- Passes `ownerUserId` to `PatientService.findAll` to retrieve only pets associated with that client.

---

## 4. Frontend User Experience (UX)

### `/clinic/clients` (Directory)
- Displays a clean data table of clients.
- Columns: Name (clickable link to details), BP Code, Email, Phone.
- Search input to filter client-side.
- Button "+ Create Client" linking to `/clinic/clients/new`.

### `/clinic/clients/new` (Registration Form)
- Inputs for name (required), email, phone, Line ID, Tax ID, and Address details.
- Validates fields, posts to `/clinic/clients`, and redirects to `/clinic/clients/[id]`.

### `/clinic/clients/[id]` (Detail Page)
- **Left Column / Top**: Demographics and Business Partner details card (sticky information).
- **Right Column / Bottom**: Pets roster card displaying a table of all pets belonging to `ownerUserId`.
- **"+ Add Pet" button**: Links to `/clinic/patients/new?ownerId=[id]`.

### `/clinic/patients/new` (Add Pet Page)
- Standalone page for pet creation.
- Uses `useSearchParams` to fetch `ownerId`.
- Searchable combobox select to search/filter clinic clients if `ownerId` is not provided. Disabled and pre-selected if `ownerId` is provided.
- Form fields: Name (required), Species (select), Breed (text), Weight (number).

---

## 5. Verification Plan

### Automated Tests
- Write integration test in `apps/api/src/modules/identity/controllers/clients.controller.spec.ts` (or similar) to verify clients creation and list filtering.
- Run `npm run build` or `npx turbo run build` to verify Next.js build compilation.

### Manual Verification
- Use visual companion/browser subagent to verify the Clients list, Client creation, Client details page, and Contextual patient creation flow.
