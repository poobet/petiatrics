# Research: Petiatrics Full Platform

## Decision 1: Monorepo with a single Next.js app and a NestJS modular monolith

- Decision: Implement Petiatrics as a Turborepo monorepo with `apps/web` for all three portals and `apps/api` for a single NestJS backend.
- Rationale: The spec requires rapid delivery across three portals with shared authentication, shared UI primitives, shared types, and unified session management. A single Next.js app with route groups keeps the UX cohesive and reduces duplicated infrastructure. A NestJS modular monolith matches the architecture requirement to move fast while enforcing bounded contexts and event-driven cross-domain integration.
- Alternatives considered:
  - Three separate frontend apps: rejected because it duplicates auth, UI, and deployment concerns too early.
  - Microservices from day one: rejected because Phase 0 prioritizes delivery speed and domain modeling over operational complexity.

## Decision 2: Session-based authentication backed by Redis

- Decision: Use server-managed sessions stored in Redis and transported via secure HttpOnly cookies.
- Rationale: The architecture explicitly avoids JWTs to enable real-time revocation and exact role/clinic enforcement. Redis provides low-latency session lookup, lockout counters, and lightweight coordination for auth-related state.
- Alternatives considered:
  - JWT access/refresh tokens: rejected because revocation and role changes are weaker and more complex.
  - Database-backed sessions only: rejected because Redis is better suited for short-lived session state and high request volume.

## Decision 3: Polyglot persistence with Prisma + Mongoose

- Decision: Keep relational operational data in PostgreSQL via Prisma and flexible clinical/audit documents in MongoDB via Mongoose.
- Rationale: Billing, inventory, clinics, users, and subscription settings need transactional guarantees and queryable relational structure. Clinical records, attachments, SOAP content, and audit diffs benefit from schema flexibility and document-oriented storage. This follows the approved architecture directly.
- Alternatives considered:
  - PostgreSQL only: rejected because document-heavy medical and audit records would become awkward and slower to evolve.
  - MongoDB only: rejected because billing, inventory, and tenancy constraints need stronger relational guarantees.

## Decision 4: Tenant isolation enforced at the repository/data-access layer

- Decision: Every clinic-scoped query must include server-injected `clinic_id` filtering via Prisma client extensions and Mongoose query middleware.
- Rationale: Tenant isolation is the highest-risk platform concern. Enforcing scoping in controllers or services alone is too error-prone. Centralized data-access enforcement minimizes accidental leakage and aligns with the architecture document.
- Alternatives considered:
  - Controller/service-level checks only: rejected because repeated manual filtering is brittle.
  - Postgres RLS only in Phase 0: rejected because MongoDB still needs equivalent enforcement and the architecture positions RLS as a later enhancement.

## Decision 5: API-first contract for all portal workflows

- Decision: Define the backend surface as a versioned `/api/v1` HTTP API with a stable envelope and role-based access rules.
- Rationale: The platform spans multiple portals and a future mobile expansion path. An explicit API contract enables parallel frontend/backend work, contract testing, and backward-compatible versioning.
- Alternatives considered:
  - Frontend-coupled server actions only: rejected because the backend serves more than one portal and needs independent contract clarity.
  - GraphQL: rejected because the spec already defines resource-oriented REST flows and GraphQL adds unnecessary complexity for Phase 0.

## Decision 6: Free-form appointment scheduling with interval overlap detection

- Decision: Store appointments with `scheduled_at` plus `duration_minutes`, and prevent overlaps per veterinarian using time-range conflict checks.
- Rationale: The clarification phase explicitly chose free-form scheduling. This supports varied visit lengths without overfitting the model to fixed slots.
- Alternatives considered:
  - Fixed 30-minute slots: rejected because it does not fit mixed veterinary procedures.
  - Per-service slot templates only: rejected because the user explicitly chose free-form booking.

## Decision 7: Visit record lifecycle drives billing

- Decision: Model visit records as `Draft -> Finalized -> Amended`, where `Finalized` means clinically complete and billing-eligible.
- Rationale: This resolves the ambiguity between “complete” and “finalized”, gives billing a clear trigger, and preserves amendment traceability.
- Alternatives considered:
  - Draft/final only: rejected because post-24h manager amendments need an explicit state.
  - Separate clinical completion and billing completion states: rejected because it complicates Phase 0 without added business value.

## Decision 8: i18n from day one for Thai and English

- Decision: Externalize UI copy and notification text into locale resources with `th` and `en` support at launch.
- Rationale: The clarification phase selected full i18n from day one. Locale selection affects login, navigation, notifications, dates, and currency formatting and should be foundational rather than retrofitted.
- Alternatives considered:
  - English first: rejected by clarified requirements.
  - Thai-only: rejected because admin and future expansion use cases benefit from bilingual support.

## Decision 9: Docker as the mandatory execution environment

- Decision: Require Docker Compose for local infrastructure and Docker images for API and web deployments across CI and production.
- Rationale: The architecture document now explicitly requires Docker for environment parity. This reduces onboarding friction, standardizes dependency setup, and matches the target deployment model.
- Alternatives considered:
  - Host-installed databases for development: rejected because it creates drift and setup inconsistency.
  - Non-container production deploys: rejected because they diverge from the desired operational model.

## Decision 10: Testing strategy layered by contract, integration, and end-to-end workflow

- Decision: Use UI component tests, NestJS module/service tests, contract tests against the OpenAPI document, and Playwright end-to-end tests for the critical clinic and pet-owner journeys.
- Rationale: The feature spans UI, API, multi-tenant security, and cross-domain events. No single test layer is sufficient. Contract tests protect the API surface while end-to-end tests verify the value-delivery journeys from the spec.
- Alternatives considered:
  - Unit tests only: rejected because they cannot validate tenant isolation and end-to-end workflows.
  - E2E-heavy strategy only: rejected because it is too slow and brittle for rapid iteration.