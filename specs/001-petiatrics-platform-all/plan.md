# Implementation Plan: Petiatrics Full Platform

**Branch**: `001-petiatrics-platform-all` | **Date**: 2026-03-26 | **Spec**: `d:\Deaw\petiatrics\specs\001-petiatrics-platform-all\spec.md`
**Input**: Feature specification from `/specs/001-petiatrics-platform-all/spec.md`

## Summary

Build Petiatrics as a Docker-based full-stack TypeScript monorepo with a single Next.js application serving three route-group portals and a NestJS modular monolith backend. The implementation will preserve strict domain boundaries across Identity, Clinical, Inventory, Billing, and Audit while using PostgreSQL for structured tenant-safe relational data, MongoDB for clinical and audit documents, and Redis for session-based authentication and short-lived coordination state.

The plan prioritizes platform foundations first: tenant isolation, session auth, role-based portal entry, and shared UI/application shell. From there it layers the clinic workflows that create end-to-end value: patient registration, appointment scheduling, visit documentation, inventory linkage, invoicing, and pet-owner self-service. API contracts will be versioned at `/api/v1`, all infrastructure will run in Docker for local, CI, and production parity, and the web app will launch with Thai/English i18n support from day one.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS  
**Primary Dependencies**: Next.js App Router, React 19, NestJS, Prisma, Mongoose, Redis, Tailwind CSS, Radix UI, Storybook, Turborepo, next-intl or equivalent i18n layer  
**Storage**: PostgreSQL 16, MongoDB 7, Redis 7, object storage for attachments  
**Testing**: Vitest + React Testing Library for web UI, Jest/Supertest for NestJS, Playwright for end-to-end portal flows, contract validation against OpenAPI  
**Target Platform**: Web browsers for admin/clinic portals, mobile browsers/PWA for pet-owner portal, Linux Docker containers for API/web/infrastructure  
**Project Type**: Dockerized monorepo web platform (frontend + backend + shared packages)  
**Performance Goals**: appointment calendar under 2s, pet-owner booking under 2 minutes, visit finalization under 3 minutes, invoice draft generation under 3s, stock propagation under 5s  
**Constraints**: strict tenant isolation on every read/write, session-based auth only, Docker required across dev/CI/prod, offline-capable PWA read flows, Thai/English i18n at launch, no cross-domain SQL joins, immutable audit log  
**Scale/Scope**: Phase 0 platform spanning 3 portals, 5 bounded contexts, 30+ functional requirements, multi-tenant clinics with configurable subscription tiers and clinic-level security settings

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution file is still the default placeholder template and does not define enforceable project principles yet.

Pre-Phase 0 gate result: PASS with operational assumptions.

- No active constitution rules block the plan.
- Planning will still follow the architecture constraints already documented in `documents/0-phase-architecture.md`.
- Domain boundaries, tenant isolation, Docker parity, and immutable audit logging are treated as binding architectural constraints for this feature.

Post-Phase 1 re-check: PASS.

- Design artifacts preserve the modular-monolith boundary model.
- Data design keeps clinic scoping explicit across relational and document stores.
- Contracts remain versioned and tenant-safe.

## Project Structure

### Documentation (this feature)

```text
specs/001-petiatrics-platform-all/
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
documents/
├── 0-phase-architecture.md
└── display/
    ├── app/
    │   ├── App.tsx
    │   ├── routes.ts
    │   ├── components/
    │   ├── data/
    │   ├── layouts/
    │   └── pages/
    └── styles/

apps/
├── api/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── identity/
│   │   │   ├── clinical/
│   │   │   ├── appointments/
│   │   │   ├── inventory/
│   │   │   ├── billing/
│   │   │   └── audit/
│   │   ├── common/
│   │   └── main.ts
│   ├── test/
│   └── Dockerfile
└── web/
    ├── app/
    │   ├── (admin)/
    │   ├── (clinic)/
    │   ├── (pet-owner)/
    │   ├── api/
    │   └── layout.tsx
    ├── components/
    ├── lib/
    ├── messages/
    ├── public/
    ├── tests/
    └── Dockerfile

packages/
├── database/
│   ├── prisma/
│   ├── mongo/
│   └── src/
├── ui/
├── types/
└── config/

docker-compose.yml
docker-compose.prod.yml
```

**Structure Decision**: Use the monorepo web-platform structure defined by the architecture document. The current repository already contains a display prototype under `documents/display`; implementation work will promote that prototype into `apps/web` and add the missing backend and shared-package structure in `apps/api` and `packages/*`. This keeps frontend and backend independently testable while preserving a single repository and shared type system.

## Complexity Tracking

No constitution violations require justification at this stage.
