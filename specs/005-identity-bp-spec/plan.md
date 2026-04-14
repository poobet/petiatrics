# Implementation Plan: Identity & Business Partner Architecture

**Branch**: `005-identity-bp-spec` | **Date**: 2026-04-14 | **Spec**: `specs/005-identity-bp-spec/spec.md`
**Input**: Feature specification from `/specs/005-identity-bp-spec/spec.md`

## Summary

Implement the Identity & Business Partner foundation on top of the existing Petiatrics auth stack rather than replacing it. The current Redis-backed session, branch-header validation, and role guard infrastructure already satisfy most of the zero-trust requirements. The primary work is to introduce a new PostgreSQL Business Partner model family, expose tenant-safe CRUD endpoints in the existing NestJS `IdentityModule`, add shared request/response contracts in `packages/types`, and add a clinic-facing Business Partner management surface in the Next.js app.

The plan is intentionally incremental. Phase A establishes the schema and shared contracts. Phase B adds backend services and authorization rules. Phase C delivers web routes and forms using the existing session store and API client. Phase D closes the slice with contract, integration, and E2E coverage for tenant isolation, lockout, idle-session expiry, and BP soft-delete behaviour.

## Technical Context

**Language/Version**: TypeScript 5.8.x on Node.js 20+  
**Primary Dependencies**: NestJS 11, Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, Redis via ioredis, class-validator, bcrypt, Zustand, next-intl  
**Storage**: PostgreSQL for identity and BP master data, Redis for server-side sessions, MongoDB retained for existing clinical records and audit collections  
**Testing**: Jest + Supertest for API integration, Vitest + React Testing Library for web UI, Playwright for end-to-end flows, contract validation scripts already present in both apps  
**Target Platform**: Browser-based multi-tenant web application deployed as NestJS API + Next.js web app in Docker/Linux environments  
**Project Type**: Turborepo monorepo with `apps/api`, `apps/web`, `packages/database`, `packages/types`, and shared UI/config packages  
**Performance Goals**: Login and BP CRUD requests under 3s in development; role and session revocation reflected in under 1s via Redis session invalidation; BP list queries scoped by clinic and active status with indexed reads  
**Constraints**: `clinicId` must always come from session context; protected requests must send `x-active-branch`; Redis sessions require 12h absolute TTL and 1h idle timeout; no JWT fallback; BP soft-delete only; no procurement, AR, payment, or inventory implementation in this feature  
**Scale/Scope**: One new relational aggregate (`BusinessPartner` + extensions), one existing backend module extension, one new clinic web route area, and roughly 18 to 26 source files changed or created across schema, API, shared types, web UI, and tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still an uninitialized template, so there are no enforceable project-specific gates beyond the repository conventions already in use. Planning defaults to the existing repo patterns: extend current apps and modules, preserve tenant isolation, and avoid introducing new top-level packages.

**Post-design re-check**: PASS. The design extends the existing `IdentityModule`, existing shared types package, existing Prisma schema, and existing clinic route group. No new app, package, or cross-cutting abstraction layer is required.

## Project Structure

### Documentation (this feature)

```text
specs/005-identity-bp-spec/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/
├── database/
│   └── prisma/
│       └── schema.prisma                           ← [CHANGE] add BP models, relations, indexes
└── types/
    └── src/
        ├── api.ts                                 ← [CHANGE] BP DTOs and response contracts
        ├── enums.ts                               ← [CHANGE] BP enums and role helpers if needed
        └── index.ts                               ← [CHANGE] export new contracts

apps/
├── api/
│   └── src/
│       ├── common/
│       │   └── session/
│       │       ├── session.service.ts             ← [CHANGE] 1h idle timeout support
│       │       └── session.guard.ts               ← [CHANGE] refresh idle TTL on valid request
│       └── modules/identity/
│           ├── identity.module.ts                 ← [CHANGE] register BP providers/controllers
│           ├── controllers/
│           │   └── business-partners.controller.ts← [NEW] BP CRUD endpoints
│           ├── dto/
│           │   ├── create-business-partner.dto.ts ← [NEW]
│           │   ├── update-business-partner.dto.ts ← [NEW]
│           │   └── list-business-partners.dto.ts  ← [NEW]
│           └── services/
│               ├── auth.service.ts                ← [CHANGE] password policy and optional BP linkage
│               ├── user.service.ts                ← [CHANGE] optional user-to-BP linking
│               ├── business-partner.service.ts    ← [NEW] aggregate CRUD + soft-delete
│               └── business-partner-mapper.ts     ← [NEW] DTO assembly if needed
└── web/
    ├── app/
    │   └── (clinic)/
    │       └── clinic/
    │           └── business-partners/
    │               ├── page.tsx                   ← [NEW] BP list route
    │               └── business-partners-client.tsx ← [NEW] client UI shell
    ├── components/
    │   └── business-partners/
    │       ├── business-partner-form.tsx          ← [NEW]
    │       ├── business-partner-table.tsx         ← [NEW]
    │       └── extension-fields.tsx               ← [NEW]
    ├── lib/
    │   └── api-client.ts                          ← [VERIFY] branch header already injected
    └── messages/
        ├── en.json                                ← [CHANGE] BP UI copy
        └── th.json                                ← [CHANGE] BP UI copy
```

**Structure Decision**: Web application structure. The feature stays within the existing monorepo boundaries and extends `apps/api/src/modules/identity` for backend work and `apps/web/app/(clinic)/clinic` for clinic-facing UI work.

## Complexity Tracking

No constitution violations to justify. Complexity is controlled by reusing the current session/auth stack, the current `IdentityModule`, and the current Next.js clinic route structure instead of introducing new services or packages.

---

## Phase 0: Research

See `research.md` for the detailed decision log.

**Resolved research themes:**
1. Keep Business Partner work inside the existing `IdentityModule`
2. Model Business Partners in PostgreSQL, not MongoDB
3. Use a single BP root table plus `BpVet` and `BpSupplier` extension tables
4. Implement soft-delete via `isActive` and active-query defaults
5. Reuse the current session + branch guard infrastructure and add sliding idle TTL behaviour
6. Preserve current role enum and map unspecified `ASSISTANT` to read-only until product says otherwise
7. Reuse the existing API envelope and shared types package for all BP contracts
8. Keep BP list and forms in the clinic app, using the current API client and session store

## Phase 1: Design & Contracts

All Phase 1 artifacts are generated for this feature.

- `data-model.md` — BP schema, relation rules, role rules, and session deltas
- `contracts/api.md` — endpoint contracts for login/session implications and BP CRUD APIs
- `quickstart.md` — local migration, verification, and test workflow

## Technical Feasibility

The feature is feasible with moderate schema and application changes because the repo already provides the hard parts of the security model:

- Redis-backed sessions already exist in `apps/api/src/common/session`
- role checks and branch-header validation already exist in `apps/api/src/common/guards`
- the web API client already injects `x-active-branch`
- the web session store already tracks `authorizedBranches` and active branch

The largest delta is data modelling. The current Prisma schema has `Clinic`, `Branch`, `User`, and `UserBranch`, but no `BusinessPartner` aggregate or extension tables. That means the feature starts with a schema migration and shared type expansion before any controller or UI work can compile.

## Necessary File Changes

### Phase A — Schema and shared contracts

| # | File | Change | Risk |
|---|------|--------|------|
| A1 | `packages/database/prisma/schema.prisma` | Add `BpType` enum; add `BusinessPartner`, `BpVet`, and `BpSupplier` models; add optional `businessPartnerId` relation on `User`; add BP indexes on `(clinicId, isActive)` and extension uniqueness constraints | High |
| A2 | `packages/database/prisma/migrations/*` | Generate migration SQL and regenerate Prisma client | Medium |
| A3 | `packages/types/src/enums.ts` | Add `BusinessPartnerType` and any BP role-extension discriminators used by API/web | Low |
| A4 | `packages/types/src/api.ts` | Add BP DTOs, list/filter query shapes, create/update payloads, and optional `businessPartnerId` on `AuthProfile` / `UserContext` if linked users are surfaced | Medium |
| A5 | `packages/types/src/index.ts` | Export the new BP contracts | Low |

### Phase B — Backend services and API

| # | File | Change | Risk |
|---|------|--------|------|
| B1 | `apps/api/src/modules/identity/identity.module.ts` | Register BP controller and service providers | Low |
| B2 | `apps/api/src/modules/identity/services/business-partner.service.ts` | Implement BP create/list/get/update/soft-delete, clinic scoping, extension-table persistence, and active-only defaults | High |
| B3 | `apps/api/src/modules/identity/controllers/business-partners.controller.ts` | Expose CRUD endpoints with `@Roles()` and branch-context enforcement | Medium |
| B4 | `apps/api/src/modules/identity/dto/*.ts` | Add validated DTOs with conditional fields for vet/supplier extensions and search filters | Medium |
| B5 | `apps/api/src/modules/identity/services/auth.service.ts` | Add missing special-character password validation and optional `businessPartnerId` in auth profile/session payload if needed | Medium |
| B6 | `apps/api/src/common/session/session.service.ts` | Support 1-hour idle timeout refresh semantics while preserving 12-hour absolute expiry | High |
| B7 | `apps/api/src/common/session/session.guard.ts` | Refresh idle TTL for valid authenticated requests | Medium |
| B8 | `apps/api/test` or `apps/api/src/**/*.spec.ts` | Add BP authz, tenant isolation, soft-delete, password policy, and idle-timeout coverage | High |

### Phase C — Web clinic experience

| # | File | Change | Risk |
|---|------|--------|------|
| C1 | `apps/web/app/(clinic)/clinic/business-partners/page.tsx` | Add server entry route for BP management | Low |
| C2 | `apps/web/app/(clinic)/clinic/business-partners/business-partners-client.tsx` | Client UI for listing, filtering, create/edit flows, and soft-delete | Medium |
| C3 | `apps/web/components/business-partners/business-partner-form.tsx` | Dynamic BP form with extension-specific fields and user-link options | Medium |
| C4 | `apps/web/components/business-partners/business-partner-table.tsx` | Active/inactive views and action affordances by role | Low |
| C5 | `apps/web/messages/en.json` | Add BP i18n strings | Low |
| C6 | `apps/web/messages/th.json` | Add Thai BP i18n strings | Low |
| C7 | `apps/web/test` / component tests | Cover form branching, read-only role states, and API error rendering | Medium |

### Phase D — Contracts, quick verification, and E2E

| # | File | Change | Risk |
|---|------|--------|------|
| D1 | `specs/005-identity-bp-spec/contracts/api.md` | Maintain endpoint contract source-of-truth | Low |
| D2 | `apps/api/scripts/validate-contracts.js` and `apps/web/scripts/validate-contracts.mjs` | Verify whether BP endpoints need to be added to existing contract validation manifests | Medium |
| D3 | `apps/web/test:e2e` or existing Playwright location | Add login → branch selection → BP CRUD → soft-delete scenario | Medium |

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Current schema has no `BusinessPartner` root, so API and UI work cannot start until the migration lands | High | Land schema + shared types first and regenerate Prisma client before backend work |
| The current session service appears to use a single TTL; the spec requires both absolute and idle expiry | High | Add explicit absolute-expiry field in the session payload or a parallel Redis key strategy, then refresh only idle expiry on authenticated requests |
| Password policy currently enforces length/uppercase/digit but may not enforce special characters | Medium | Add a dedicated validator path and tests in `AuthService` |
| Existing Prisma `Role` enum includes `ASSISTANT`, which the spec does not mention | Medium | Treat `ASSISTANT` as read-only for BP routes until the spec is expanded, and document that decision in research/contracts |
| Historical clinical Mongo documents currently reference `User` ids, not Business Partners | Medium | Keep BP scope limited to identity/master-data for this feature and avoid remapping Mongo records in this slice |
| Soft-deleted BPs must stay referenceable but not show in active pickers | Medium | Add explicit service query modes: active-only list, include-inactive detail, and historical-reference lookups |
| SUPER_ADMIN bypass behaviour in current role guard may allow broader access than intended | Medium | Enforce clinic scoping in service methods even when guard-level role checks pass |
| Dynamic BP forms can drift from DTO rules and create invalid extension payloads | Medium | Reuse shared discriminated request types and add form tests for each BP type |

## Implementation Sequence

### Phase A — Foundation

1. Add Prisma BP schema and relation changes
2. Generate migration and Prisma client
3. Add shared enums and DTO contracts in `packages/types`
4. Update any seeds or fixture data needed for BP-aware tests

### Phase B — Backend security and business logic

1. Implement idle-session refresh while preserving absolute expiry
2. Add missing password special-character validation and tests
3. Implement `BusinessPartnerService`
4. Add controller and DTOs with role + branch enforcement
5. Add API integration tests for CRUD, tenant isolation, and soft-delete

### Phase C — Web delivery

1. Add clinic BP route and list screen
2. Add create/edit form with extension-specific fields
3. Add read-only handling for non-edit roles
4. Add i18n strings and component tests

### Phase D — End-to-end verification

1. Validate API contracts against implementation
2. Add Playwright path for login, branch selection, create BP, update BP, and soft-delete BP
3. Run full test matrix: API, web, E2E, contracts

## Recommended Commit Sequence

1. `feat(database): add business partner schema and relations`
2. `feat(types): add business partner API contracts`
3. `feat(api): implement session idle timeout and password policy updates`
4. `feat(api): add business partner services and controller`
5. `test(api): cover BP authz tenant isolation and soft delete`
6. `feat(web): add business partner clinic routes and components`
7. `test(web): cover BP forms and read-only modes`
8. `test(e2e): add login branch and BP management flow`
