# Blueprint and Technical Requirements: The First Vertical Slice

## 1. Executive Summary
This document defines the technical specifications for "The First Vertical Slice" of the Petiatrics platform. This initial milestone establishes the foundational architecture for Authentication, Multi-Tenant Session Management, Role-Based Routing, and Branch Context Injection. It serves as the definitive boilerplate and architectural standard for all subsequent feature development.

**Primary Objective:** Implement a secure, session-based authentication flow that strictly isolates tenant data (`clinic_id`) on the backend while providing a seamless, multi-branch context-switching experience on the frontend without relying on stateless JWTs for authorization.

**Target Tech Stack:**
* **Frontend:** Next.js (App Router), Tailwind CSS, Zustand, Axios.
* **Backend:** NestJS, Prisma ORM.
* **Database:** PostgreSQL (Relational Data), Redis (Session Store).

---

## 2. Database Schema Design (Prisma / PostgreSQL)
The data model must strictly enforce the "Single-Tenant, Multi-Branch" architecture. A User belongs to exactly one Clinic but can have access to one or multiple Branches within that Clinic.

```prisma
// schema.prisma

model Clinic {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String   @db.VarChar(255)
  status    String   @default("ACTIVE") // ACTIVE, SUSPENDED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branches  Branch[]
  users     User[]
}

model Branch {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  clinicId  String   @db.Uuid
  name      String   @db.VarChar(255)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  clinic    Clinic       @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  users     UserBranch[]

  @@index([clinicId])
}

model User {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  clinicId     String   @db.Uuid
  email        String   @unique @db.VarChar(255)
  passwordHash String   @db.Text
  role         Role     @default(STAFF)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  clinic       Clinic       @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  branches     UserBranch[]

  @@index([clinicId])
  @@index([email])
}

model UserBranch {
  userId   String @db.Uuid
  branchId String @db.Uuid

  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch   Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@id([userId, branchId])
}

enum Role {
  SUPER_ADMIN
  CLINIC_OWNER
  VET
  ASSISTANT
  CASHIER
  STAFF
}
```

---

## 3. Backend Specifications (NestJS)

### 3.1 Authentication & Session Management
The backend must abandon traditional stateless JWTs in favor of secure, stateful sessions backed by Redis. This allows for immediate session revocation and strict server-side control over the tenant context.

* **Endpoint:** `POST /api/auth/login`
    * **Payload:** `{ email, password }`
    * **Logic:**
        1. Validate credentials against the `User` table via Prisma.
        2. Fetch the user's `clinicId`, `role`, and an array of authorized `Branch` objects.
        3. Generate a secure, cryptographically random `sessionId` (e.g., using `uuid` or `crypto.randomBytes`).
        4. Store the session context in **Redis** with a TTL (e.g., 24 hours).
            * *Redis Key:* `session:{sessionId}`
            * *Redis Value (JSON):* `{ "userId": "...", "clinicId": "...", "role": "VET", "authorizedBranches": ["branch_id_1", "branch_id_2"] }`
        5. Set an `HttpOnly`, `Secure`, `SameSite=Strict` cookie containing the `sessionId`.
        6. Return a non-sensitive JSON payload to the frontend for UI rendering: `{ id, email, role, branches: [{ id, name }] }`.

### 3.2 Branch Context Interceptor (The `x-active-branch` Header)
To ensure that inventory deductions and billing occur at the correct physical location, the backend must process a custom HTTP header sent by the frontend.

* **Implementation:** Create a globally scoped `NestJS Guard` or `Interceptor` (e.g., `BranchContextGuard`).
* **Logic:**
    1. Extract the `sessionId` from the incoming HttpOnly cookie.
    2. Retrieve the session context from Redis. If invalid/expired, throw `401 Unauthorized`.
    3. Extract the `x-active-branch` header from the incoming request.
    4. **Critical Validation:** Verify that the `x-active-branch` value exists within the `authorizedBranches` array retrieved from the Redis session.
        * If valid: Inject the `branchId` and `clinicId` into the request object (e.g., `req.tenantContext = { clinicId, activeBranchId }`).
        * If invalid/missing (and the route requires branch context): Throw `403 Forbidden`.
    5. **Zero-Trust Principle:** The `clinicId` must *never* be accepted from the frontend payload. It must strictly be derived from the Redis session.

---

## 4. Frontend Specifications (Next.js & Zustand)

### 4.1 Next.js Middleware Routing
The frontend must enforce route protection at the edge before rendering any React components.

* **File:** `src/middleware.ts`
* **Logic:**
    1. Intercept all requests to protected route groups (`/(admin)/*`, `/(clinic)/*`, `/(pet-owner)/*`).
    2. Check for the existence of the `sessionId` cookie.
    3. If the cookie is missing, immediately redirect the user to `/login`.
    4. *Optional Optimization:* Decode a secondary, non-HttpOnly cookie (e.g., `ui_context`) set during login to determine the user's role and ensure they are not accessing the wrong portal (e.g., a `VET` trying to access `/(admin)`). If a mismatch occurs, redirect to their designated dashboard.

### 4.2 State Management (Zustand)
Manage the active branch state globally to ensure all components and API calls share the same context.

* **Store Definition (`useAppStore`):**
    ```typescript
    interface AppState {
      user: UserProfile | null;
      authorizedBranches: Branch[];
      activeBranch: Branch | null;
      setUser: (user: UserProfile, branches: Branch[]) => void;
      setActiveBranch: (branchId: string) => void;
      clearSession: () => void;
    }
    ```

### 4.3 Branch Selector UX (Smart Defaults)
The UI must abstract complexity based on the user's specific authorization profile.

* **Component:** `<GlobalTopNav />`
* **Logic:**
    1. Read `authorizedBranches` and `activeBranch` from the Zustand store.
    2. **Condition 1 (Single Branch):** If `authorizedBranches.length === 1`, automatically set `activeBranch` to that branch in the store. **Do not render** the branch switcher dropdown in the UI.
    3. **Condition 2 (Multi-Branch):** If `authorizedBranches.length > 1`, render a Dropdown UI component. Set the default `activeBranch` to the first item in the array (or a saved preference in `localStorage`). Allow the user to manually switch contexts via the dropdown.

### 4.4 Axios Interceptor Configuration
Ensure that every outbound API request automatically carries the active branch context without requiring manual parameter injection by developers.

* **File:** `src/lib/api-client.ts`
* **Logic:**
    ```typescript
    import axios from 'axios';
    import { useAppStore } from '@/store/useAppStore';

    const apiClient = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      withCredentials: true, // Crucial for sending the HttpOnly session cookie
    });

    apiClient.interceptors.request.use((config) => {
      const activeBranch = useStore.getState().activeBranch;
      if (activeBranch) {
        config.headers['x-active-branch'] = activeBranch.id;
      }
      return config;
    });

    export default apiClient;
    ```

---

## 5. Acceptance Criteria (Definition of Done)

The AI Coding Agent must ensure the following criteria are met to consider this vertical slice complete:

1.  **Database Migration:** Prisma migrations successfully generate the `Clinic`, `Branch`, `User`, and `UserBranch` tables.
2.  **Authentication Success:** Submitting valid credentials via the Next.js login form results in a Redis session creation and an HttpOnly cookie being set on the client.
3.  **Middleware Protection:** Navigating to `/clinic/dashboard` without a valid cookie triggers an automatic redirect to `/login`.
4.  **Smart UI Rendering:**
    * Logging in as a user with 1 branch hides the branch switcher in the top navigation.
    * Logging in as a user with 2+ branches displays the branch switcher and correctly updates the Zustand store when a new branch is selected.
5.  **Contextual API Requests:** Outbound requests from the frontend inherently include the `x-active-branch` header based on the Zustand state.
6.  **Backend Verification:** A test protected endpoint (e.g., `GET /api/inventory/test`) successfully reads the `x-active-branch` header, validates it against the Redis session, and returns data isolated to that specific `clinicId` and `branchId`.
7.  **Security Constraint:** Any attempt to pass `clinic_id` in a standard JSON POST body is ignored by the backend, which strictly relies on the session context. Attempts to pass an unauthorized `x-active-branch` header result in a `403 Forbidden` response.