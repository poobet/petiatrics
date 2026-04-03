# Implementation Plan: First Vertical Slice - Auth, Session Management, Role-Based Routing & Branch Context

**Branch**: `002-first-vertical-slice` | **Date**: 2026-03-31 | **Spec**: `D:\Deaw\petiatrics\specs\002-first-vertical-slice\spec.md`
**Input**: Feature specification from `/specs/002-first-vertical-slice/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver the first production-grade vertical slice for Petiatrics by turning the existing monorepo scaffolding into a branch-aware, session-based authentication foundation. The implementation will reconcile the current 001-platform code with the approved 002 spec by adding relational branch models, expanding Redis session context to carry authorized branches, introducing a dedicated branch-validation guard on the NestJS API, and wiring the Next.js app to a client-side app store that drives placeholder dashboards, branch switching, and automatic request context propagation.

The plan deliberately reuses what is already present in the repository instead of restarting the stack: the existing Turbo workspace, NestJS session service, Next.js App Router layouts, shared type package, and fetch-based API client remain the foundation. The feature work therefore focuses on targeted schema/type migration, stricter cookie and routing semantics, and end-to-end verification of the zero-trust rule that `clinicId` and `activeBranchId` always come from the session plus validated header path rather than client-submitted payload fields.

## Technical Context

**Language/Version**: TypeScript 5.8.x on Node.js 20+  
**Primary Dependencies**: Next.js 15 App Router, React 19, NestJS 11, Prisma 6, ioredis, bcrypt, class-validator, next-intl, Turborepo, shared `@petiatrics/*` packages, Zustand for web app session/branch state  
**Storage**: PostgreSQL for clinic/branch/user auth data, Redis for server-side sessions, MongoDB present in the platform but not central to this slice  
**Testing**: Jest + Supertest for API/integration, Vitest + React Testing Library for web UI/store behavior, Playwright for login/routing/branch flow E2E, contract validation scripts in both apps  
**Target Platform**: Browser-based web application served by Next.js and NestJS on Linux/Docker-backed environments  
**Project Type**: Turborepo monorepo web platform with frontend app, backend API, and shared packages  
**Performance Goals**: Login to dashboard under 3 seconds under normal conditions, unauthenticated protected-route redirects before protected content renders, session/login/logout flow remains functional at 100 concurrent sessions  
**Constraints**: Zero-trust tenant isolation, HttpOnly cookie auth, no return-URL preservation, `/pet-owner` out of scope, placeholder dashboards only, canonical role enum values must match the approved 002 spec, preserve existing envelope API style where possible  
**Scale/Scope**: 4 user stories, 30 functional requirements, 2 runtime apps plus shared database/types/config packages, schema and type migration required because existing code still reflects the broader 001 platform model

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution file is still an uncustomized placeholder template and does not define enforceable governance rules.

Pre-Phase 0 gate result: PASS with operational constraints.

- No explicit constitution gates block planning.
- The approved feature spec and repository architecture act as the effective governing constraints for this slice.
- Binding constraints for this plan are:
  - server-derived tenant context only
  - canonical role enum values from the 002 spec
  - reuse the existing monorepo structure instead of introducing a new app split
  - no domain workflows beyond login, logout, routing, placeholder dashboards, and branch context verification

Post-Phase 1 re-check: PASS.

- Research, data model, and API contract preserve strict tenant isolation.
- Design artifacts keep the existing monorepo and modular NestJS structure intact.
- The plan narrows scope to the approved vertical slice and avoids accidental carry-over of broader 001 portal features.

## Project Structure

### Documentation (this feature)

```text
specs/002-first-vertical-slice/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   └── session/
│   │   ├── modules/
│   │   │   ├── identity/
│   │   │   │   ├── controllers/
│   │   │   │   └── services/
│   │   │   └── inventory/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   └── package.json
└── web/
    ├── app/
    │   ├── (admin)/
    │   ├── (auth)/
    │   ├── (clinic)/
    │   ├── (pet-owner)/
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   └── layout/
    ├── lib/
    ├── messages/
    ├── public/
    ├── middleware.ts
    └── package.json

packages/
├── config/
│   └── src/
├── database/
│   ├── prisma/
│   ├── mongo/
│   └── src/
├── types/
│   └── src/
└── ui/
    └── src/

docker-compose.yml
package.json
turbo.json
```

**Structure Decision**: Use the existing Turborepo monorepo and extend the current app/package boundaries rather than introducing new top-level services. The slice will touch `apps/api` for session and branch guards, `apps/web` for login/routing/store/dashboard behavior, `packages/database` for Prisma branch models and seed data, and `packages/types` for shared auth and branch types. This keeps the implementation aligned with the code that already exists while isolating the vertical-slice changes to the minimum required surface.

## Complexity Tracking

No constitution violations require justification at this stage.

