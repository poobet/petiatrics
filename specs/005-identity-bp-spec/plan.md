# Implementation Plan: Identity & Business Partner Architecture

**Branch**: `005-identity-bp-spec` | **Date**: 2026-04-14 | **Spec**: `specs/005-identity-bp-spec/spec.md`
**Input**: Feature specification from `/specs/005-identity-bp-spec/spec.md`

## Summary

Implement the Identity & Business Partner foundation on top of the existing Petiatrics auth stack rather than replacing it. The current Redis-backed session, branch-header validation, and role guard infrastructure already satisfy most of the zero-trust requirements. The primary work is to evolve the PostgreSQL Business Partner model into an enterprise-grade Thai BP architecture: add Thai core compliance fields, add a global seeded TaxCode reference table, add Infor LN-style BP role activation, preserve strict tenant isolation for clinic-owned BP data, and expose tenant-safe CRUD endpoints in the existing NestJS `IdentityModule`.

This plan intentionally separates master-data readiness from downstream billing behavior. This feature will establish BP-level tax defaults and VAT inference rules only. Runtime invoice VAT determination and ItemMaster-driven line taxation are explicitly deferred to a later billing phase. No invoice calculation behavior will be changed in this slice.

Phase A establishes the schema and shared contracts. Phase B adds backend services, validation, and authorization rules. Phase C delivers web routes and forms using the existing session store and API client. Phase D closes the slice with contract, integration, and E2E coverage for tenant isolation, BP soft-delete behavior, Thai compliance fields, TaxCode selection, and LN role assignment.

## Technical Context

**Language/Version**: TypeScript 5.8.x on Node.js 20+  
**Primary Dependencies**: NestJS 11, Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, Redis via ioredis, class-validator, bcrypt, Zustand, next-intl  
**Storage**: PostgreSQL for identity and BP master data, Redis for server-side sessions, MongoDB retained for existing clinical records and audit collections  
**Testing**: Jest + Supertest for API integration, Vitest + React Testing Library for web UI, Playwright for end-to-end flows, contract validation scripts already present in both apps  
**Target Platform**: Browser-based multi-tenant web application deployed as NestJS API + Next.js web app in Docker/Linux environments  
**Project Type**: Turborepo monorepo with `apps/api`, `apps/web`, `packages/database`, `packages/types`, and shared UI/config packages  
**Performance Goals**: Login and BP CRUD requests under 3s in development; role and session revocation reflected in under 1s via Redis session invalidation; BP list queries scoped by clinic and active status with indexed reads  
**Constraints**: `clinicId` must always come from session context; protected requests must send `x-active-branch`; Redis sessions require 12h absolute TTL and 1h idle timeout; no JWT fallback; BP soft-delete only; `TaxCode` is a global system-seeded reference table and must not be tenant-owned; `BusinessPartner` remains clinic-owned and tenant-scoped; runtime invoice VAT calculation changes are out of scope for this feature; no procurement, AR, payment, or inventory tax-engine implementation in this slice  
**Scale/Scope**: One expanded relational aggregate (`BusinessPartner` with Thai core fields, role activation, and tax-code defaults), one global reference table (`TaxCode`), one existing backend module extension, one new clinic web route area, and roughly 20 to 30 source files changed or created across schema, API, shared types, web UI, and tests

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
│   ├── prisma/
│   │   └── schema.prisma                           ← [CHANGE] add TaxCode, BpRole, BpRoleActive, Thai BP fields, relations, indexes
│   └── src/
│       └── prisma-tenant.ts                       ← [VERIFY] confirm clinic scoping strategy for BP-owned tables only
└── types/
    └── src/
        ├── api.ts                                 ← [CHANGE] BP DTOs and response contracts for Thai core fields, tax code defaults, active roles
        ├── enums.ts                               ← [CHANGE] BP enums, TaxCode type enums, BpRole enums
        └── index.ts                               ← [CHANGE] export new contracts

apps/
├── api/
│   └── src/
│       ├── common/
│       │   └── session/
│       │       ├── session.service.ts             ← [CHANGE] 1h idle timeout support
│       │       └── session.guard.ts               ← [CHANGE] refresh idle TTL on valid request
│       └── modules/
│           ├── identity/
│           │   ├── identity.module.ts             ← [CHANGE] register BP providers/controllers
│           │   ├── controllers/
│           │   │   └── business-partners.controller.ts ← [CHANGE] BP CRUD remains the main clinic API surface
│           │   ├── dto/
│           │   │   ├── create-business-partner.dto.ts  ← [CHANGE]
│           │   │   ├── update-business-partner.dto.ts  ← [CHANGE]
│           │   │   └── list-business-partners.dto.ts   ← [CHANGE]
│           │   └── services/
│           │       ├── auth.service.ts            ← [CHANGE] password policy and optional BP linkage
│           │       ├── user.service.ts            ← [CHANGE] optional user-to-BP linking
│           │       └── business-partner.service.ts← [CHANGE] Thai core fields, TaxCode references, LN roles, soft-delete
│           └── billing/
│               └── services/
│                   └── invoice.service.ts         ← [NO CHANGE] runtime VAT behavior deferred for this phase
└── web/
    ├── app/
    │   └── (clinic)/
    │       └── clinic/
    │           └── business-partners/
    │               ├── page.tsx                   ← [VERIFY] route remains valid
    │               └── business-partners-client.tsx ← [CHANGE] support Thai BP fields, TaxCode defaults, LN roles
    ├── components/
    │   └── business-partners/
    │       ├── business-partner-form.tsx          ← [CHANGE]
    │       ├── business-partner-table.tsx         ← [CHANGE]
    │       └── extension-fields.tsx               ← [CHANGE]
    ├── lib/
    │   └── api-client.ts                          ← [VERIFY] branch header injection already satisfies BP routes
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
3. Use a single BP root table with Thai compliance fields plus `BpVet` and `BpSupplier` extension tables
4. Add a global `TaxCode` reference table seeded by the system, not tenant-owned
5. Add `BpRoleActive` to represent the 8 standard Infor LN partner roles
6. Implement soft-delete via `isActive` and active-query defaults
7. Reuse the current session + branch guard infrastructure and add sliding idle TTL behavior
8. Preserve current role enum and map unspecified `ASSISTANT` to read-only until product says otherwise
9. Reuse the existing API envelope and shared types package for all BP contracts
10. Defer runtime invoice VAT changes and ItemMaster-driven tax calculation to a later billing phase
11. Keep BP list and forms in the clinic app, using the current API client and session store

## Phase 1: Design & Contracts

All Phase 1 artifacts are generated for this feature.

- `data-model.md` — BP schema, relation rules, Thai compliance rules, tax defaults, role rules, and session deltas
- `contracts/api.md` — endpoint contracts for login/session implications and revised BP CRUD APIs
- `quickstart.md` — local migration, verification, and test workflow

## Technical Feasibility

The feature is feasible with moderate schema and application changes because the repo already provides the hard parts of the security model:

- Redis-backed sessions already exist in `apps/api/src/common/session`
- role checks and branch-header validation already exist in `apps/api/src/common/guards`
- the web API client already injects `x-active-branch`
- the web session store already tracks `authorizedBranches` and active branch
- the current BP CRUD surface already exists and can be evolved instead of replaced

The largest delta is data-model evolution. The current Prisma schema has `Clinic`, `Branch`, `User`, and a first-pass `BusinessPartner` aggregate, but it does not yet include Thai core BP fields, global `TaxCode` references, or LN role activation. Shared contracts, DTOs, service logic, UI forms, and tests currently assume supplier-local `taxId` and `creditTermDays` fields, so those layers must be realigned after the schema update.

This feature does not need to change runtime invoice tax calculation. Billing currently hardcodes an invoice-level tax rate, and that behavior is intentionally deferred. The only tax behavior in scope now is storing BP default tax references and documenting how VAT registration is inferred from the selected default VAT `TaxCode`.

## Necessary File Changes

### Phase A — Schema and shared contracts

| # | File | Change | Risk |
|---|------|--------|------|
| A1 | `packages/database/prisma/schema.prisma` | Add `TaxCode` model as a global seeded reference table; add `BpRole` enum and `BpRoleActive` model; expand `BusinessPartner` with `taxId`, `isHeadOffice`, `branchCode`, structured address, `parentBpId`, `defaultVatCodeId`, `defaultWhtCodeId`, `creditTermDays`; simplify `BpSupplier` to supplier-only extension fields; retain optional `businessPartnerId` on `User` | High |
| A2 | `packages/database/prisma/migrations/*` | Generate migration SQL and regenerate Prisma client | High |
| A3 | `packages/database/src/prisma-tenant.ts` | Verify tenant helper strategy and confirm only clinic-owned tables are auto-scoped; `TaxCode` must remain global | Medium |
| A4 | `packages/types/src/enums.ts` | Add `BpRole` enum and any `TaxCode` type enum required by API/web | Medium |
| A5 | `packages/types/src/api.ts` | Replace supplier-local tax and credit fields in DTOs with BP-core Thai fields, `TaxCode` default ids, and active role arrays; keep optional `businessPartnerId` in auth context | High |
| A6 | `packages/types/src/index.ts` | Export the new BP contracts and enums | Low |

### Phase B — Backend security and business logic

| # | File | Change | Risk |
|---|------|--------|------|
| B1 | `apps/api/src/modules/identity/identity.module.ts` | Keep BP controller/service registration aligned to the revised DTO and schema surface | Low |
| B2 | `apps/api/src/modules/identity/dto/create-business-partner.dto.ts` | Add Thai core field validation, `TaxCode` id validation, BP hierarchy inputs, LN role list validation, and revised supplier extension validation | High |
| B3 | `apps/api/src/modules/identity/dto/update-business-partner.dto.ts` | Add partial update rules for Thai fields, tax defaults, role activation, and hierarchy | High |
| B4 | `apps/api/src/modules/identity/dto/list-business-partners.dto.ts` | Keep active/inactive filters and add any search fields required by Thai BP identification | Medium |
| B5 | `apps/api/src/modules/identity/services/business-partner.service.ts` | Implement create/list/get/update/soft-delete with clinic scoping, `TaxCode` reference checks, parent-child validation, BP role activation persistence, and response mapping | High |
| B6 | `apps/api/src/modules/identity/controllers/business-partners.controller.ts` | Keep existing route surface and authorization matrix while accepting the revised payloads | Medium |
| B7 | `apps/api/src/modules/identity/services/auth.service.ts` | Preserve password policy and optional BP linkage; no tax logic required here | Low |
| B8 | `apps/api/src/modules/identity/services/user.service.ts` | Preserve same-clinic BP linkage validation after BP model expansion | Medium |
| B9 | `apps/api/src/common/session/session.service.ts` | Support 1-hour idle timeout refresh semantics while preserving 12-hour absolute expiry | Medium |
| B10 | `apps/api/src/common/session/session.guard.ts` | Refresh idle TTL for valid authenticated requests | Medium |

### Phase C — Web clinic experience

| # | File | Change | Risk |
|---|------|--------|------|
| C1 | `apps/web/app/(clinic)/clinic/business-partners/business-partners-client.tsx` | Adapt list/create/edit flows to revised BP contracts, `TaxCode` defaults, and active roles | Medium |
| C2 | `apps/web/components/business-partners/business-partner-form.tsx` | Replace supplier-local financial fields with Thai BP core fields, `TaxCode` selectors, role selection, and hierarchy inputs | High |
| C3 | `apps/web/components/business-partners/extension-fields.tsx` | Limit extension-specific rendering to truly extension-only fields such as vet license and supplier-specific metadata | High |
| C4 | `apps/web/components/business-partners/business-partner-table.tsx` | Display Thai BP identifiers and active/inactive state consistently | Medium |
| C5 | `apps/web/messages/en.json` | Add UI labels for Thai BP fields, `TaxCode` labels, and LN roles | Low |
| C6 | `apps/web/messages/th.json` | Add Thai translations for the same | Low |

### Phase D — Contracts and verification

| # | File | Change | Risk |
|---|------|--------|------|
| D1 | `specs/005-identity-bp-spec/contracts/api.md` | Rewrite API examples and field definitions to the revised BP contract | High |
| D2 | `apps/api/src/modules/identity/services/business-partner.service.spec.ts` | Replace supplier-local assumptions with BP-core tax defaults, Thai fields, and LN roles | High |
| D3 | `apps/api/src/modules/identity/controllers/business-partners.controller.spec.ts` | Keep controller coverage aligned to the revised payloads and role rules | Medium |
| D4 | `apps/web/components/business-partners/*.spec.tsx` | Update UI tests for `TaxCode` selection, Thai compliance fields, and role assignment | High |
| D5 | `apps/web/test/e2e/business-partners.spec.ts` | Keep CRUD and soft-delete E2E coverage, but validate only BP defaults, not invoice runtime tax calculation | Medium |

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Current schema and shared contracts still encode supplier-local `taxId` and `creditTermDays` | High | Update schema and shared types first, then regenerate downstream DTOs and tests |
| `TaxCode` may accidentally be implemented as tenant-owned data | High | Document and enforce `TaxCode` as a global seeded reference table with no `clinicId` |
| BP hierarchy could allow cross-clinic parent-child linkage | High | Validate `parentBpId` against the same clinic in service logic and tests |
| Existing Prisma tenant helper does not currently cover `BusinessPartner` or distinguish global reference data | Medium | Either expand the helper for BP-owned tables or keep manual scoping and test every query path |
| UI form complexity increases significantly with Thai compliance fields, tax-code defaults, and LN roles | Medium | Keep extension fields limited to true extensions and move shared financial and compliance fields into the BP core form |
| Billing service still hardcodes invoice-level `taxRateBps` | Medium | Explicitly defer runtime billing changes and avoid partial tax-engine work in this slice |
| Contract drift between plan/tasks and current spec could restart implementation with the wrong payload shape | High | Update `plan.md` and `tasks.md` before any implementation resumes |

## Implementation Sequence

### Phase A — Foundation

1. Add `TaxCode`, `BpRole`, `BpRoleActive`, and expanded `BusinessPartner` schema changes
2. Generate migration and Prisma client
3. Update shared enums and DTO contracts in `packages/types`
4. Rewrite feature API contracts to the revised BP shape
5. Update fixtures or seeds, including global `TaxCode` seed data

### Phase B — Backend behavior

1. Preserve existing session hardening behavior
2. Implement revised BP DTO validation
3. Implement `BusinessPartnerService` support for Thai core fields, `TaxCode` defaults, hierarchy, and active roles
4. Keep controller authorization and branch enforcement unchanged
5. Add API integration tests for tenant isolation, soft-delete, Thai compliance fields, and `TaxCode` inference inputs

### Phase C — Web delivery

1. Update BP list and edit flows to the revised contracts
2. Update forms for Thai BP fields, `TaxCode` selectors, and LN role selection
3. Keep extension-specific UI limited to vet and supplier extension-only data
4. Add i18n strings and component tests

### Phase D — Verification

1. Validate API contracts against implementation
2. Add or update Playwright coverage for login, branch selection, BP create, BP update, and BP soft-delete
3. Do not change invoice runtime VAT logic in this phase

## Recommended Commit Sequence

1. `feat(database): expand business partner schema for Thai core fields and global tax codes`
2. `feat(types): realign BP contracts and enums to tax-code defaults and active roles`
3. `docs(contracts): update BP API contracts for Thai architecture`
4. `feat(api): update BP DTOs and service for tax-code defaults, hierarchy, and active roles`
5. `test(api): rewrite BP API tests for Thai architecture`
6. `feat(web): update BP UI for Thai fields and tax-code defaults`
7. `test(web): realign BP UI and E2E coverage`
