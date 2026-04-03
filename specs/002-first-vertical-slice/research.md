# Research: First Vertical Slice

## Decision 1: Reuse the existing monorepo and test toolchain

- Decision: Implement the slice inside the current npm workspace and Turborepo structure using `apps/api`, `apps/web`, `packages/database`, and `packages/types`, with Jest/Supertest for API tests, Vitest/RTL for web tests, and Playwright for end-to-end verification.
- Rationale: The repository is already structured for this split and already exposes `test`, `test:e2e`, and `test:contracts` scripts. Reusing the current layout keeps the plan small and directly actionable.
- Alternatives considered:
  - Introduce a dedicated auth microservice: rejected because it adds operational complexity before the first authenticated slice is proven.
  - Create a separate frontend app for admin routing: rejected because route groups already exist in the Next.js app.

## Decision 2: Migrate the auth domain to the approved 002 role and branch model

- Decision: Treat the approved 002 spec as authoritative and migrate Prisma schema, shared enums, and auth-facing types from the current 001 role model (`PLATFORM_ADMIN`, `CLINIC_MANAGER`, etc.) to the canonical 002 values (`SUPER_ADMIN`, `CLINIC_OWNER`, `VET`, `ASSISTANT`, `CASHIER`, `STAFF`) while introducing `Branch` and `UserBranch` as relational models.
- Rationale: The spec was clarified explicitly to make the 002 enum values canonical. The current codebase still reflects the broader 001 platform role model and has no branch join model, so planning must include this reconciliation rather than hiding it.
- Alternatives considered:
  - Keep the current 001 enum values and map labels in the UI only: rejected because it would contradict the approved spec and spread translation logic across backend and frontend.
  - Support both enums temporarily: rejected because it would multiply edge cases in auth, seeding, and route guards for little value on a non-released branch.

## Decision 3: Preserve the existing `User.status` pattern instead of introducing a new `isActive` boolean

- Decision: Keep the repository's existing `User.status` approach for active/inactive state and use it to satisfy the slice's deactivation requirement, rather than replacing it with a new `isActive` boolean field from the blueprint example.
- Rationale: The API and seed code already use `ACTIVE`, `INACTIVE`, and `LOCKED` semantics. Reusing that model avoids an unnecessary backwards move while still satisfying the requirement that inactive users cannot log in.
- Alternatives considered:
  - Replace `status` with `isActive`: rejected because it would discard an already-implemented lifecycle and complicate existing auth logic.
  - Keep both `status` and `isActive`: rejected because it creates redundant state.

## Decision 4: Expand the Redis session payload and add a dedicated branch guard

- Decision: Keep the existing `SessionService` and `SessionGuard`, but expand the session payload to include `authorizedBranches` and add a dedicated `BranchContextGuard` that validates `x-active-branch`, then injects `{ clinicId, activeBranchId }` onto the request context.
- Rationale: Session lookup is already implemented and globally wired. Adding a second focused guard follows NestJS guard composition cleanly and keeps session auth separate from branch authorization.
- Alternatives considered:
  - Put branch validation directly into `SessionGuard`: rejected because it conflates authentication with per-route branch policy.
  - Validate branch headers inside each controller: rejected because it is repetitive and easy to bypass.

## Decision 5: Keep the existing fetch-based API client and add branch injection there

- Decision: Do not replace the current web fetch wrapper with Axios. Instead, extend the existing `apps/web/lib/api-client.ts` implementation so it reads the active branch from a new Zustand store, adds `x-active-branch` when available, and centralizes `401` session-expiry handling.
- Rationale: The current web app already depends on a typed fetch wrapper and not on Axios. Replacing it would add churn without improving the vertical slice's behavior. The requirement is automatic branch-context propagation, not a specific HTTP library.
- Alternatives considered:
  - Introduce Axios to match the blueprint example literally: rejected because it would discard existing working infrastructure for no functional gain.
  - Keep fetch but inject headers ad hoc at each call site: rejected because the spec explicitly requires developers not to wire branch headers manually.

## Decision 6: Use middleware for cookie presence and layouts for authoritative role redirects

- Decision: Enforce unauthenticated-route protection in Next.js middleware via session-cookie presence, then use server layouts and `/auth/me` to perform authoritative role routing to `/admin` or `/clinic` dashboards. Do not implement return-URL preservation.
- Rationale: Middleware can reliably check for the HttpOnly cookie but cannot inspect Redis directly. The current app already uses layout-level `/auth/me` validation. This hybrid model satisfies the approved routing behavior without inventing a secondary token system.
- Alternatives considered:
  - Make middleware call the API on every request for role checks: rejected because it adds latency and coupling to edge execution.
  - Store a non-HttpOnly role cookie as the primary routing authority: rejected because the spec treats server-side session context as authoritative.

## Decision 7: Standardize cookie behavior to the stricter feature requirements

- Decision: Retain the existing session cookie name but update auth behavior to enforce `HttpOnly`, `SameSite=Strict`, and production-only `Secure`, with TTL sourced from configuration.
- Rationale: The current controller sets `sameSite: 'lax'`, which does not meet the approved spec. Tightening cookie attributes is a direct feature requirement and does not require architectural change.
- Alternatives considered:
  - Keep `SameSite=Lax`: rejected because it conflicts with the approved spec.
  - Use a different cookie name for the slice: rejected because the existing guard and middleware already share a stable cookie key.

## Decision 8: Use placeholder dashboards as the completion UI for this slice

- Decision: The admin and clinic route groups will land on minimal placeholder dashboards that show the authenticated user's name, role, clinic name, active branch name, and logout action. Multi-branch users also get the branch selector in the top navigation.
- Rationale: The user clarified that this slice should not pull in downstream domain screens. A placeholder dashboard gives a clean acceptance target for authentication, role routing, and branch-state hydration.
- Alternatives considered:
  - Render the existing broader clinic shell and menus: rejected because it leaks 001 platform scope into this slice.
  - Render a blank body with nav only: rejected because it weakens manual verification and acceptance tests.

## Decision 9: Cover the slice with contract, integration, and end-to-end tests

- Decision: Verify login/logout/session/branch behavior with API integration tests, web unit tests for store and branch-switching behavior, and Playwright flows for protected-route redirects and branch-aware dashboard behavior.
- Rationale: The highest risks in this slice are cross-layer: cookie behavior, route gating, session expiry, and branch header injection. Those risks are not adequately covered by a single test layer.
- Alternatives considered:
  - Unit-test only: rejected because it would not validate cookies, redirects, or branch headers.
  - E2E-only: rejected because it would be slower and less precise when debugging guard/store behavior.
