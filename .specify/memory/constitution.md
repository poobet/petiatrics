# Petiatrics Constitution

## Core Principles

### I. Domain Boundaries Are Enforceable
Petiatrics is a modular monolith with strict bounded contexts. Cross-domain SQL joins are prohibited. Cross-domain coordination must happen through explicit events, published interfaces, or versioned contracts. A change fails constitutional review if it couples modules through direct schema reach-through, bypasses an owning module's API, or introduces shared persistence shortcuts that blur ownership.

### II. Tenant Isolation Comes From Trusted Server Context
Every clinic-scoped write and read path must enforce tenant isolation from trusted server-side session context, not from client-provided identifiers. Clinic-specific relational tables and document collections must carry clinic scope explicitly. A change fails constitutional review if it accepts tenant scope from the client without server validation, omits clinic scoping where required, or adds data access paths that can bypass tenant filters.

### III. Session Security And Auditability Are Mandatory
Authentication is session-based and backed by server-side state to support immediate revocation and consistent policy enforcement. Security-sensitive flows must preserve HttpOnly session handling, role-aware authorization, and immutable audit capture for material mutations. A change fails constitutional review if it replaces the session model with unmanaged bearer-token behavior, weakens authorization boundaries, or allows audit records to be silently altered or discarded.

### IV. Specs, Plans, Tasks, And Tests Must Align
Work starts with explicit requirements and continues through traceable planning and verification. Every meaningful feature or architectural change must keep its `spec.md`, `plan.md`, `tasks.md`, and tests consistent with the governing rules in this constitution. A change fails constitutional review if implementation proceeds without updated acceptance criteria, if `plan.md` omits a real constitution check, or if tasks and tests do not cover tenant, contract, and workflow risks introduced by the change.

### V. Production Parity And Bilingual Delivery Are Defaults
The repository is delivered as a Docker-based monorepo with environment parity across local development, CI, and production. User-facing functionality must be designed for Thai and English from the start rather than treated as post-launch polish. A change fails constitutional review if it depends on non-containerized local-only infrastructure, skips required environment configuration discipline, or introduces user-visible flows that cannot be localized within the established bilingual model.

## Operating Constraints

- The canonical platform architecture is a full-stack TypeScript monorepo with Next.js App Router in `apps/web`, NestJS in `apps/api`, and shared packages under `packages/`.
- PostgreSQL is the system of record for highly structured, transactional, and financial data. MongoDB is reserved for flexible clinical and audit-oriented documents. Redis backs session state and short-lived coordination concerns.
- API contracts should remain versioned under `/api/v1` unless an approved amendment introduces a new strategy.
- The route-group portal model is authoritative: `(admin)`, `(clinic)`, and `(pet-owner)` remain distinct experience surfaces within the unified web application.
- Client payloads must not be treated as the source of truth for `clinic_id`, role scope, or any equivalent tenant boundary.
- Audit logging is expected for material mutations and should preserve actor identity and before/after context where applicable.
- Simplicity is preferred over speculative abstraction. New services, packages, or infrastructure layers require a concrete boundary or operational need, not anticipation alone.

## Spec-Driven Workflow Rules

- Every new or materially updated `plan.md` must include a constitution check that cites the relevant principles from this document instead of using placeholder assumptions.
- Every `research.md` and `data-model.md` that touches clinic data, permissions, audit, or contracts must state how tenant isolation, domain ownership, and storage choices remain compliant.
- Every `tasks.md` must include verification work for the changed slice, with tests or other executable checks that match the risk level of the change.
- Contract changes must identify impacted consumers and preserve explicit versioning and migration intent.
- Exceptions are allowed only when they are written down, scoped, time-bounded, and approved by the ratifying authority before implementation is considered compliant.
- If a proposal conflicts with a core principle and no approved exception exists, the correct action is to change the proposal, not reinterpret the constitution.

## Governance

This constitution supersedes ad hoc engineering preferences and placeholder planning assumptions for this repository. The current ratifying authority is the project owner or lead architect.

Amendments must include:

- the exact principle, constraint, or workflow rule being added, removed, or changed
- the rationale for the change
- any required migration note for active specs, plans, tasks, or code paths affected by the change
- the version bump justification

Versioning rules:

- MAJOR: removes or redefines a core principle or adds a breaking governance rule
- MINOR: adds a new principle, constraint, or workflow obligation without invalidating the existing model
- PATCH: clarifies wording, fixes ambiguity, or improves guidance without changing obligations

Constitution compliance must be checked during planning, review, and release preparation for material changes. When a conflict exists between this constitution and lower-level project documents, this constitution wins until it is formally amended.

**Version**: 1.0.0 | **Ratified**: 2026-05-16 | **Last Amended**: 2026-05-16
