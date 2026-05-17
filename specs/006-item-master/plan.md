# Implementation Plan: Item Master ERP Foundation

**Branch**: `006-item-master` | **Date**: 2026-05-16 | **Spec**: `specs/006-item-master/spec.md`
**Input**: Feature specification from `/specs/006-item-master/spec.md`

## Summary

Implement the Item Master ERP Foundation by evolving the existing inventory `Product` slice into the canonical clinic item aggregate instead of introducing a second competing catalog. The work adds clinic-scoped item categorization, reusable units of measure with per-item conversions, pricing and tax defaults, service-vs-stocked behavior, medical flags, preferred vendor linkage, and an ERP-style clinic UI that reuses the existing tabbed master-data patterns from Business Partners.

The plan keeps inventory ownership in `apps/api/src/modules/inventory`, preserves the existing session and branch validation model, reuses Mongo-backed audit logging through the current `@Audit()` interceptor, and extends the current Next.js clinic inventory workspace rather than creating a disconnected admin surface. The main architectural change is a relational expansion of the current `Product` schema so downstream clinical and stock flows keep pointing at one item identity.

## Technical Context

**Language/Version**: TypeScript 5.8.x on Node.js 20+  
**Primary Dependencies**: NestJS 11, Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, MongoDB via Mongoose for audit logs, Redis via ioredis, class-validator, zod, react-hook-form, next-intl  
**Storage**: PostgreSQL for item master, categories, units, product stock state, and global `TaxCode`; MongoDB for immutable audit logs; Redis for session state and branch-aware authentication context  
**Testing**: Jest for API unit/integration tests, Supertest for API route coverage, Vitest + React Testing Library for web components/forms, Playwright for clinic E2E flows  
**Target Platform**: Dockerized browser-based clinic web application backed by NestJS API on Linux-compatible deployment targets  
**Project Type**: Turborepo monorepo with Next.js frontend, NestJS backend, Prisma database package, shared type package, and shared UI package  
**Performance Goals**: Item list/filter responses under 3 seconds in development for ordinary clinic catalogs; create/update operations remain interactive with single-request save flows; no added latency that breaks current clinic CRUD expectations  
**Constraints**: `clinicId` must always come from trusted server session context; `x-active-branch` remains required for protected clinic routes; cross-domain SQL joins are prohibited; `TaxCode` remains global and not tenant-owned; audit logging must remain append-only; Thai and English copy must ship together  
**Scale/Scope**: One substantial master-data expansion across Prisma schema, inventory API/controllers/services, shared types, clinic inventory UI, i18n messages, and focused tests; approximately 25 to 40 source files touched when implemented

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Domain Boundaries Are Enforceable**. PASS. The design keeps item master ownership inside the existing `InventoryModule`. It avoids introducing a duplicate item service in `IdentityModule` or direct coupling to Business Partner internals beyond an explicit `defaultSupplierId` foreign-key/reference contract and public selector usage.
- **Principle II: Tenant Isolation Comes From Trusted Server Context**. PASS. All item, category, and unit writes and reads remain clinic-scoped relational records keyed by `clinicId` derived from session context through `@TenantId()` and existing scoped Prisma patterns, never from client payloads.
- **Principle III: Session Security And Auditability Are Mandatory**. PASS. The plan reuses HttpOnly session auth, branch validation, and the current `@Audit()` interceptor flow for material item mutations. No bearer-token or unaudited mutation path is introduced.
- **Principle IV: Specs, Plans, Tasks, And Tests Must Align**. PASS. This plan directly maps to the approved spec and includes verification coverage for normalized item codes, role enforcement, tax reference behavior, unit conversions, and bilingual UI.
- **Principle V: Production Parity And Bilingual Delivery Are Defaults**. PASS. The feature stays within the current Dockerized monorepo stack and explicitly includes Thai and English message updates for all user-facing item-master screens.

**Post-design re-check**: PASS. Phase 1 artifacts preserve one canonical item aggregate, keep clinic scoping explicit on new relational tables, use existing deployment/runtime infrastructure, and avoid speculative new packages or services.

## Project Structure

### Documentation (this feature)

```text
specs/006-item-master/
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
│   │   └── schema.prisma
│   └── src/
├── types/
│   └── src/
│       ├── api.ts
│       ├── enums.ts
│       └── index.ts
└── ui/
    └── src/

apps/
├── api/
│   └── src/
│       ├── common/
│       │   ├── decorators/
│       │   ├── guards/
│       │   └── interceptors/
│       └── modules/
│           ├── audit/
│           ├── identity/
│           │   └── controllers/
│           │       └── reference.controller.ts
│           └── inventory/
│               ├── controllers/
│               │   ├── product.controller.ts
│               │   └── stock.controller.ts
│               ├── dto/
│               ├── services/
│               │   ├── product.service.ts
│               │   └── stock.service.ts
│               └── inventory.module.ts
└── web/
    ├── app/
    │   └── (clinic)/
    │       └── clinic/
    │           └── inventory/
    │               ├── page.tsx
    │               ├── inventory-client.tsx
    │               ├── products/
    │               │   ├── new/page.tsx
    │               │   └── [id]/edit/page.tsx
    │               └── items/
    ├── components/
    │   └── business-partners/
    ├── components/
    │   └── inventory/
    ├── lib/
    │   ├── api-client.ts
    │   └── session-store.ts
    ├── messages/
    │   ├── en.json
    │   └── th.json
    └── test/
        └── e2e/
```

**Structure Decision**: Web application. The implementation stays inside the current `inventory` backend boundary and the existing clinic inventory route group. Existing business-partner components are used as UI reference patterns, but item-master logic lives in inventory-specific files.

## Complexity Tracking

No constitution violations require exception handling. Complexity is controlled by evolving the existing `Product` aggregate and inventory routes instead of creating a parallel item subsystem.

---

## Phase 0: Research

See `research.md` for the decision log.

**Resolved research themes:**
1. Use the current `InventoryModule` as the owning backend slice for item master
2. Evolve the existing relational `Product` model into the canonical item aggregate
3. Add clinic-scoped `ItemCategory` and `UnitOfMeasure` records plus per-item conversion rows
4. Reuse global `TaxCode` references and add `isTaxInclusive` without hardcoded tax rates
5. Preserve current Mongo-backed audit logging via `@Audit()` on item mutations
6. Reuse existing branch/session guards and clinic-scoped Prisma patterns
7. Reuse the business-partner tabbed form structure and clinic CRUD UX patterns for the item workspace
8. Keep stock movement logic intact while widening the product master-data schema

## Phase 1: Design & Contracts

All Phase 1 artifacts are generated for this feature.

- `data-model.md` — canonical item aggregate, category/unit relationships, pricing/tax fields, and migration boundaries
- `contracts/api.md` — clinic item CRUD, selector/reference endpoints, and payload shapes
- `quickstart.md` — migration, manual verification, and test workflow for the feature slice

## Technical Feasibility

The feature is feasible because the repository already contains most of the cross-cutting primitives that item master needs:

- a clinic-scoped relational `Product` model that can be expanded rather than duplicated
- an `InventoryModule` with existing product CRUD and stock services
- session and tenant decorators that already derive clinic ownership from Redis-backed session state
- an append-only audit path via `@Audit()` and the `AuditInterceptor`
- a proven master-data UI pattern in Business Partners using `Tabs`, `react-hook-form`, `zod`, and `next-intl`

The main implementation cost is schema evolution. The current product slice is intentionally minimal and uses raw string fields (`category`, `unit`) plus inventory-state fields on the same row. This feature introduces normalized category/unit relationships, service-vs-stocked behavior, pricing/tax metadata, medical/procurement flags, and filtered high-density UI while keeping existing stock and clinical references attached to the same item identity.

## Necessary File Changes

### Phase A — Schema and shared contracts

| # | File | Change | Risk |
|---|------|--------|------|
| A1 | `packages/database/prisma/schema.prisma` | Expand `Product` into the canonical item aggregate; add item type enum; replace raw category/unit strings with relational references or migration-compatible fields; add pricing, tax, service, medical, and preferred-vendor fields; add `ItemCategory`, `UnitOfMeasure`, and `ItemUnitConversion` models; preserve stock fields needed by existing stock services | High |
| A2 | `packages/database/prisma/migrations/*` | Create migration for product-to-item expansion, new reference tables, and backfill/default handling for existing rows | High |
| A3 | `packages/types/src/enums.ts` | Add item type/category-related enums and any reference enums shared by API and web | Medium |
| A4 | `packages/types/src/api.ts` | Add item payloads/responses, reference-data shapes, filter query types, and selector response contracts | High |
| A5 | `packages/types/src/index.ts` | Export new item contracts and enums | Low |

### Phase B — Backend item master and reference endpoints

| # | File | Change | Risk |
|---|------|--------|------|
| B1 | `apps/api/src/modules/inventory/inventory.module.ts` | Register any new DTOs/services/controllers needed for expanded item master and selector endpoints | Medium |
| B2 | `apps/api/src/modules/inventory/services/product.service.ts` | Replace minimal product CRUD with item-master-aware create/list/get/update/deactivate logic, normalization of item codes, filter handling, tax-code validation, unit conversion validation, and preferred-vendor validation | High |
| B3 | `apps/api/src/modules/inventory/controllers/product.controller.ts` | Update routes and role matrix for item CRUD, deactivation, and filtered list queries; apply `@Audit()` to all material mutations | High |
| B4 | `apps/api/src/modules/inventory/services/stock.service.ts` | Adapt stock logic to the evolved product shape while preserving current quantity/movement semantics | Medium |
| B5 | `apps/api/src/modules/identity/controllers/reference.controller.ts` or new inventory-owned reference controller | Expose read-only selectors for item categories and units while preserving existing tax-code selector usage and domain ownership boundaries | Medium |
| B6 | `apps/api/src/common/interceptors/audit.interceptor.ts` | Verify current audit payload is sufficient for item entity logging; adjust only if item entity identification needs a custom resolver | Low |

### Phase C — Web clinic item workspace

| # | File | Change | Risk |
|---|------|--------|------|
| C1 | `apps/web/app/(clinic)/clinic/inventory/page.tsx` | Load item-master list data and low-stock summary using the expanded API contracts | Medium |
| C2 | `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx` | Replace simple product table with dense item workspace, search/filter controls, active-state handling, and ERP-style sticky actions | High |
| C3 | `apps/web/app/(clinic)/clinic/inventory/products/new/page.tsx` | Replace simple add-product flow with tabbed item form entry | High |
| C4 | `apps/web/app/(clinic)/clinic/inventory/products/[id]/edit/page.tsx` | Add item edit flow mirroring the business-partner edit pattern | High |
| C5 | `apps/web/components/inventory/*` | Create focused item form, tabs, validation schema, dense table/grid, and optional category/unit helpers modeled after the business-partner components | High |
| C6 | `apps/web/lib/api-client.ts` | Verify existing branch-aware client already satisfies the new item routes | Low |
| C7 | `apps/web/messages/en.json` and `apps/web/messages/th.json` | Add item-master copy, labels, validation text, and statuses in both languages | Medium |

### Phase D — Verification and regression coverage

| # | File | Change | Risk |
|---|------|--------|------|
| D1 | `apps/api/src/modules/inventory/**/*.spec.ts` | Add tests for normalized code uniqueness, category/unit validation, tax-code reference validation, type-specific rules, preferred vendor validation, and deactivation behavior | High |
| D2 | `apps/web/components/inventory/**/*.spec.tsx` | Add form and grid tests for tab persistence, conditional fields, bilingual labels, and inline validation | High |
| D3 | `apps/web/test/e2e/*.spec.ts` | Cover login, branch selection, item create/edit/deactivate, item filtering, and read-only access rules | Medium |
| D4 | `apps/api/src/modules/inventory/services/stock.service.spec.ts` | Confirm existing stock flows still work against the widened item aggregate | Medium |

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| A second item catalog could be created next to `Product`, causing domain drift | High | Evolve `Product` in place and keep downstream product references on one canonical row |
| Category and unit normalization can break existing product CRUD and stock flows | High | Stage schema migration carefully, backfill existing string fields into relational rows, and keep stock-service compatibility tests |
| Case-insensitive/trimmed code uniqueness can remain only an application rule | High | Canonicalize code before persistence and enforce a clinic-scoped unique constraint on the canonical stored value |
| Service items could incorrectly participate in stock workflows | High | Validate type-specific rules in service/controller and keep stock operations guarded to stocked items only |
| Preferred vendor linkage could cross clinic boundaries through BP IDs | High | Validate `defaultSupplierId` against the same clinic and supplier-capable BP filters |
| Tax-code usage may become a hidden hardcoded percentage in item logic | High | Persist only `TaxCode` references and `isTaxInclusive`; keep billing math explicitly out of the item-master save path |
| UI scope could sprawl into category-management and procurement workflows | Medium | Keep this slice centered on item CRUD + selectors; defer richer procurement and stock-lot execution to later tasks unless directly required |

## Implementation Sequence

### Phase A — Relational foundation

1. Expand Prisma item schema and add category/unit/conversion tables
2. Generate migration and client
3. Add shared enums and contracts

### Phase B — Inventory API

1. Replace minimal product service/controller logic with item-master-aware CRUD
2. Add item reference selectors and validation rules
3. Preserve stock-service compatibility and audit metadata

### Phase C — Clinic UI

1. Upgrade the clinic inventory workspace into the item master list/filter page
2. Add tabbed create/edit item forms using the business-partner UX pattern
3. Add bilingual messages and UI validation coverage

### Phase D — Verification

1. Run API tests for item rules and tenant isolation
2. Run web component tests for form behavior and translations
3. Run Playwright E2E for clinic item CRUD and filtering

