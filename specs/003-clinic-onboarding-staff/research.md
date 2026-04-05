# Research: Clinic Onboarding, Staff Creation, and Dual Authentication

## Decision 1: Extend the existing IdentityModule rather than introduce a new module

- **Decision**: Add the registration, approval, rejection, and slug generation logic as new service methods and controller actions inside the existing `IdentityModule` (`apps/api/src/modules/identity/`). Do not create a separate `RegistrationModule` or `OnboardingModule`.
- **Rationale**: All new behaviour touches the same three entities (Clinic, User, and auth flow) already owned by `IdentityModule`. The module is already split into `AuthService`, `ClinicService`, and `UserService`, giving a natural home for each responsibility. Introducing a new module would add a cross-module import for the same Prisma client and session provider without any isolation benefit at this stage.
- **Alternatives considered**:
  - Separate `OnboardingModule` — rejected because it would require exporting `ClinicService` to `IdentityModule` for slug lookups during login, creating a dependency cycle risk.
  - Add registration logic to `AppModule` — rejected because it bypasses the module-boundary pattern already established in the codebase.

## Decision 2: Generate clinic slug from clinic name at creation time using server-side slugification

- **Decision**: At clinic creation (triggered by `POST /auth/register-request`), generate a slug from `clinicName` by lowercasing, replacing non-alphanumeric runs with hyphens, stripping leading/trailing hyphens, and appending a short numeric disambiguator (e.g., `-2`, `-3`) if a collision exists. Store the slug as a unique, non-nullable column on the `Clinic` table. Do not expose slug generation as a client-configurable field.
- **Rationale**: The spec requires immutability and uniqueness without user involvement. A deterministic server-side algorithm with a numeric suffix for conflicts satisfies this cleanly. The existing `ClinicService.create()` is the single place where clinic rows are born, so adding slug generation there is safe.
- **Alternatives considered**:
  - Use a UUID-based slug — rejected because it produces ugly and unmemorable usernames (`somchai@a3f7b2c1`).
  - Let the admin supply a slug at approval time — rejected because the spec explicitly states slugs are auto-generated and immutable.
  - Use `nanoid` for disambiguation — rejected because a numeric counter is shorter and more predictable for clinic owners who will communicate usernames verbally.

## Decision 3: Use a single `identifier` field for login and resolve path via Prisma slug lookup

- **Decision**: Replace `LoginDto.email` with `LoginDto.identifier`. Inside `AuthService.login()`, apply the resolution pseudocode from the spec: split on `@`, look up `clinicSlug` in the `Clinic` table, and branch to either `user.findFirst({ where: { username, clinicId } })` or `user.findFirst({ where: { email } })`. Use one extra Prisma query for the slug lookup; do not compute slug ownership in application code.
- **Rationale**: The resolution logic depends on a database state check (does this slug exist?). Doing it in the database avoids race conditions and keeps the logic auditable. A single extra Prisma read per login is negligible given the session is cached in Redis immediately after.
- **Alternatives considered**:
  - Distinguish email vs. username by regex only (no DB lookup) — rejected because a clinic slug could match a valid email domain (e.g., `user@gmail.com` where `gmail` never matches a slug, but the code can't prove that without a DB lookup at runtime).
  - Cache known slugs in Redis — rejected as premature optimization for this slice. Can be added later as a read-through cache.
  - Create two separate login endpoints — rejected because the spec requires one unified `identifier` field.

## Decision 4: Add `PENDING` and `REJECTED` to existing enums rather than a separate status field

- **Decision**: Extend `ClinicStatus` with `PENDING` and `REJECTED`, and extend `UserStatus` with `PENDING`. Update `packages/types/src/enums.ts` and `packages/database/prisma/schema.prisma` together in the same migration. Remove the `default(ACTIVE)` on `Clinic.status` and `default(INVITED)` on `User.status` to force callers to explicitly set the starting state.
- **Rationale**: The repository already uses a discriminated status enum pattern on both models. Extending the existing enum is the minimal change that satisfies the lifecycle requirements without introducing a parallel state field or a separate pending-request table.
- **Alternatives considered**:
  - Separate `ClinicRegistrationRequest` table — rejected because the spec treats a pending clinic _as_ a clinic in a pending state, not as a separate registry entity. A separate table would require a promotion step that duplicates data.
  - Add a `isPending` boolean alongside `status` — rejected because it creates redundant state that can diverge.

## Decision 5: Make `User.email` nullable and add `User.username` + `User.mustChangePassword`

- **Decision**: Migrate `User.email` from `String @unique` to `String? @unique` and add `username String? @unique` and `mustChangePassword Boolean @default(false)`. Add a `name String` field too, since the spec requires a staff name field and the current schema has no such column on `User`. The unique constraint on nullable columns in PostgreSQL correctly allows multiple `NULL` values, so both fields are safe.
- **Rationale**: Email must be optional for staff accounts. Username is the login identifier for staff. `mustChangePassword` provides the forced change flag without session coupling. Adding `name` closes the gap between the spec's staff creation fields and the current schema.
- **Alternatives considered**:
  - Encode `mustChangePassword` in the Redis session only — rejected because it would be lost if the session is purged and the user logs in again with a new session (e.g., different device).
  - Store both email and username in a single polymorphic `loginIdentifier` column — rejected because it destroys the ability to index on either field independently and complicates the backwards-compatibility requirement.

## Decision 6: Enforce `mustChangePassword` via a session flag and a dedicated redirect in the clinic layout

- **Decision**: When `AuthService.login()` builds the session context, include `mustChangePassword: boolean` in the `UserContext` payload stored in Redis. The clinic layout server component checks this flag from `/auth/me` (which must include it in `AuthProfile`) and redirects to `/clinic/change-password` if `true`. The forced-change page calls a new `POST /auth/change-password` endpoint that clears the flag on success.
- **Rationale**: The clinic layout already performs an authoritative `/auth/me` check on every navigation. Embedding the flag there costs one extra field in the Redis payload (< 1 byte) and avoids adding a middleware check that would require decoding the session on the edge.
- **Alternatives considered**:
  - Check the flag in middleware — rejected because Next.js middleware cannot call Redis directly.
  - Set `status = PENDING_PASSWORD_CHANGE` instead — rejected because it would break the existing status lifecycle and add a fourth active-but-restricted state that collides with `ACTIVE`.

## Decision 7: Apply a custom per-endpoint throttle on the public registration route

- **Decision**: The app already uses `@nestjs/throttler` with a global 100 req/min guard. Apply an additional `@Throttle({ registerRequest: { ttl: 900_000, limit: 5 } })` override directly on the `POST /auth/register-request` handler to enforce the spec's 5 req/15 min per-IP rule. Use the throttler's `name` key to stack it alongside the global guard without replacing it.
- **Rationale**: NestJS throttler v5 supports named throttles that stack with the global guard. No new library is needed; the override is a single decorator on the controller method.
- **Alternatives considered**:
  - Introduce a Redis-based custom rate-limiter — rejected because the required throttler is already wired as a global guard and the override pattern satisfies the requirement with far less code.
  - Rate-limit at the reverse-proxy level — rejected because the dev/docker environment may not have Nginx/Caddy in front of the API, making the spec's guarantee unverifiable in development.

## Decision 8: Add approve and reject as PATCH endpoints on the existing AdminController

- **Decision**: Add `PATCH /api/v1/admin/clinics/:id/approve` and `PATCH /api/v1/admin/clinics/:id/reject` directly to `AdminController`. Both delegate to new `ClinicService.approve()` and `ClinicService.reject()` methods that update clinic status and co-update the associated clinic-owner user status in a single Prisma transaction.
- **Rationale**: `AdminController` already owns clinic CRUD. The existing `@Roles(Role.SUPER_ADMIN)` decorator at controller level covers both new routes automatically. Using a Prisma `$transaction` keeps clinic and user status changes atomic.
- **Alternatives considered**:
  - Use a saga or domain event for approval — rejected as over-engineering for a two-table update on the same database.
  - Add a dedicated `ApprovalController` — rejected because it adds controller overhead for two endpoints that logically belong to the admin clinic management surface.

## Decision 9: Replace the invite endpoint rather than coexist; preserve existing INVITED users

- **Decision**: Remove `POST /clinic/staff/invite` from `StaffController` and replace it with `POST /clinic/staff` that accepts `usernamePrefix`, `name`, `role`, `temporaryPassword`, `phone`, and `branchIds`. The new endpoint creates `ACTIVE` users immediately with `mustChangePassword: true`. Existing `INVITED`-status users in the database are not touched; they can still log in via email if they have one.
- **Rationale**: The spec explicitly calls for replacement. Keeping both endpoints would mean maintaining two provisioning paths diverging in their data model. Existing INVITED users are covered by the backwards-compatibility requirement (FR-033): they have email values and will continue to resolve through the email login path.
- **Alternatives considered**:
  - Keep the invite endpoint and add a new create endpoint alongside it — rejected per the clarification decision in the spec.
  - Migrate existing INVITED users to `username` format — rejected because it would break existing sessions and is explicitly out of scope for this slice.

## Decision 10: Update `UserContext` and `AuthProfile` types to accommodate optional email and new username/flag fields

- **Decision**: In `packages/types/src/api.ts`, make `UserContext.email` optional (`email?: string | null`), add `username?: string | null`, and add `mustChangePassword?: boolean`. Update `AuthProfile` similarly. All existing consumers of `email` in the codebase must be audited; the only confirmed consumer is `auth.service.ts` (profile construction) and `auth.controller.ts` (`/auth/me` response).
- **Rationale**: Shared types are the contract between API and web. Updating them in `packages/types` allows TypeScript to surface all breakage points at compile time rather than at runtime.
- **Alternatives considered**:
  - Keep `email` as required and use a sentinel value like `""` for staff — rejected because it would hide a data-model change behind a string hack and prevent proper null checks.

## Decision 11: Add `name` field to User; update StaffController list to return `name` and `username`

- **Decision**: Add `name String` (non-nullable) to the Prisma `User` model. Update `GET /clinic/staff` to select `id`, `username`, `name`, `role`, `status`. The staff list no longer returns `email` since staff may have none; `name` provides the human-readable label.
- **Rationale**: The spec requires staff management UI to show enough information for an owner to identify staff members. Without `name`, the staff list would only show a username. The current schema lacks a `name` field entirely.
- **Alternatives considered**:
  - Continue using `email` as the display label — rejected because email is optional for staff and would produce empty rows.
  - Add a separate `Profile` model — rejected as over-engineering for a name field.

## Decision 12: Add a public registration route group in the Next.js app

- **Decision**: Add `apps/web/app/(auth)/register/page.tsx` as a client page behind a `@Public()` equivalent — i.e., not requiring the session cookie. Update `middleware.ts` to add `/register` to `PUBLIC_PATHS` so unauthenticated users can reach it. After successful form submission, show an inline pending-confirmation state on the same page rather than navigating to a new route.
- **Rationale**: The spec requires a publicly accessible registration form. A new page in the existing `(auth)` route group is the minimal addition that fits Next.js App Router conventions.
- **Alternatives considered**:
  - A modal on the login page — rejected because it would mix two separate user flows in one component and make the pending-confirmation state harder to persist.
  - A separate app (`apps/register`) — rejected as far beyond scope.
