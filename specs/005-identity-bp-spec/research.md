# Research: Identity & Business Partner Architecture

## Decision 1: Extend the existing IdentityModule instead of creating a new module

- **Decision**: Implement Business Partner services, DTOs, and controller endpoints inside `apps/api/src/modules/identity`.
- **Rationale**: Authentication, user management, and tenant context already live there. BP records are identity-adjacent master data and share the same authorization, audit, and session semantics.
- **Alternatives considered**:
  - Create a dedicated `BusinessPartnersModule` — rejected because it introduces extra module wiring without real bounded-context separation yet.
  - Put BP endpoints under a new clinic module — rejected because BP linkage to users and auth rules would still force cross-module dependency on `IdentityModule`.

## Decision 2: Store Business Partners in PostgreSQL, not MongoDB

- **Decision**: Add BP models to `packages/database/prisma/schema.prisma` and keep MongoDB untouched in this slice.
- **Rationale**: Business Partners are transactional master data referenced by relational identity, billing, procurement, and payment workflows. PostgreSQL is the correct source of truth.
- **Alternatives considered**:
  - Store BP documents in MongoDB — rejected because future ERP-style references and relational constraints would become harder to enforce.
  - Split BP root in Postgres and extensions in MongoDB — rejected because it creates inconsistent transaction boundaries.

## Decision 3: Use one BP root table with role-extension tables

- **Decision**: Model `BusinessPartner` as the root entity with optional 1:1 `BpVet` and `BpSupplier` extension tables.
- **Rationale**: This matches the specification and allows a single BP identity to evolve without duplicating shared fields like clinic, name, type, and active state.
- **Alternatives considered**:
  - Separate tables per BP type — rejected because common list/search/update flows would require unions and duplicated logic.
  - JSON extension payload on the root BP row — rejected because typed validation and unique constraints like vet license numbers become weaker.

## Decision 4: Link Users to Business Partners optionally

- **Decision**: Add an optional `businessPartnerId` relation on `User`.
- **Rationale**: The spec requires strict separation between BP and User while still allowing a BP to gain system access later. Optional linkage supports customer-only BPs and user-backed staff/vet BPs.
- **Alternatives considered**:
  - Keep `User` separate with no BP relation — rejected because it prevents reliable linkage and duplicates person data.
  - Make `businessPartnerId` mandatory immediately — rejected because existing rows and some super-admin flows may not be backfilled yet.

## Decision 5: Implement BP deletion as soft-delete with active-query defaults

- **Decision**: Add `isActive` to `BusinessPartner`, never hard-delete BP rows, and make list/select queries active-only by default.
- **Rationale**: The architecture explicitly requires historical integrity for future invoices, payments, and supplier references.
- **Alternatives considered**:
  - Hard delete if no references exist — rejected because reference rules will expand in later features and create inconsistent behaviour.
  - Move inactive BPs into an archive table — rejected because it complicates joins and future reconciliation logic.

## Decision 6: Reuse the current auth/session infrastructure and add sliding idle timeout behaviour

- **Decision**: Keep the existing Redis-backed session design, but extend it so authenticated traffic refreshes the 1-hour idle timeout without extending the 12-hour absolute lifetime.
- **Rationale**: The current stack already does session creation, revocation, cookie handling, and branch-scoped auth correctly. Only the idle-timeout nuance appears to be missing.
- **Alternatives considered**:
  - Replace sessions with JWTs — rejected because the spec explicitly forbids JWTs.
  - Ignore idle timeout and rely on absolute TTL — rejected because it would violate the clarified requirement.

## Decision 7: Keep password policy enforcement in AuthService, not only in UI

- **Decision**: Enforce the minimum 8-character, uppercase, lowercase, digit, and special-character rule server-side where passwords are created or changed.
- **Rationale**: UI validation is not authoritative. Server-side enforcement is required for staff creation, password change, and any future admin reset flow.
- **Alternatives considered**:
  - Enforce only in frontend forms — rejected because API callers could bypass it.
  - Centralize it in database constraints — rejected because password hashes, not raw passwords, are stored.

## Decision 8: Default existing `ASSISTANT` role to read-only for BP features

- **Decision**: Because the current Prisma `Role` enum includes `ASSISTANT` but the spec does not mention it, treat `ASSISTANT` as read-only on BP routes until product explicitly changes the matrix.
- **Rationale**: This is the least-privilege option and avoids silently granting write access to an unspecified role.
- **Alternatives considered**:
  - Treat `ASSISTANT` like `STAFF` — rejected because that expands edit permissions beyond the approved clarification.
  - Block `ASSISTANT` from viewing BP data — rejected because the earlier clarification established broad authenticated visibility intent.

## Decision 9: Keep BP APIs under clinic-scoped routes and service-level clinic checks

- **Decision**: Expose BP endpoints under `/api/v1/clinic/business-partners` and enforce clinic ownership in service methods even when role guards pass.
- **Rationale**: Route naming matches the rest of the clinic surface, and service-level checks protect against accidental overreach by `SUPER_ADMIN` or future guard changes.
- **Alternatives considered**:
  - Put endpoints under `/admin/business-partners` — rejected because day-to-day BP management belongs to clinic operations, not the super-admin dashboard.
  - Rely only on `@Roles()` and branch guard — rejected because clinic scoping still must be enforced against entity data.

## Decision 10: Build a dedicated clinic BP page with dynamic form sections

- **Decision**: Add a new clinic page and supporting components for BP list/create/edit flows rather than hiding BP management inside the staff page.
- **Rationale**: BP management includes customers and suppliers in addition to staff-linked actors, so a separate route provides clearer boundaries and leaves room for filters and inactive records.
- **Alternatives considered**:
  - Reuse the staff page for all BP records — rejected because suppliers/customers do not fit the staff-centric UI or actions.
  - Build a modal-only experience from an existing dashboard — rejected because list/search/filter complexity warrants a dedicated route.

## Decision 11: Reuse the existing API envelope and shared request/response types

- **Decision**: All BP endpoints return the existing `{ data, meta, error }` envelope and use contracts defined in `packages/types`.
- **Rationale**: The repo already standardizes this shape. Reusing it keeps frontend integration simple and preserves contract-validation workflows.
- **Alternatives considered**:
  - Return raw JSON for BP endpoints only — rejected because it breaks consistency.
  - Keep DTOs local to the API app — rejected because the web app would duplicate shapes.

## Decision 12: Limit this slice to identity/master-data readiness, not downstream document migration

- **Decision**: Do not rewire existing Mongo clinical documents or add procurement/AR/payment references in this feature.
- **Rationale**: The spec explicitly excludes those domains. BP needs to be introduced cleanly first so later features can reference it deliberately.
- **Alternatives considered**:
  - Retrofit visit records and owner references immediately — rejected because it expands the scope into clinical and billing domains.
  - Add placeholder foreign keys for future documents now — rejected because unused relations add migration noise without immediate value.