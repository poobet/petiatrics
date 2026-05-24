# Branch-Scoped Inventory Design

## Summary

Refactor inventory stock handling so product masters remain clinic-scoped while stock balances, replenishment, deductions, low-stock detection, and stock movement history become branch-scoped. Existing clinic-level quantities will be migrated into the clinic's main branch, active branch context becomes mandatory for all stock-sensitive inventory APIs, and frontend inventory screens will render data only for the currently selected branch.

## Goals

- Keep `Product` as a clinic-scoped item master.
- Make stock balances branch-scoped with a single source of truth.
- Require active branch context for all stock-sensitive inventory reads and writes.
- Scope inventory list balances, low-stock indicators, replenish flow, and stock movements to the active branch.
- Migrate existing clinic-level stock into each clinic's main branch without inventing cross-branch history.

## Non-Goals

- Turning products themselves into branch-scoped records.
- Preserving a clinic-wide `product.quantity` compatibility field as a source of truth.
- Backfilling historically accurate per-branch stock movements for legacy data.
- Adding a separate branch picker inside inventory forms beyond the existing active-branch selector.

## Current State

- `Product.quantity` is currently the stock source of truth at clinic scope.
- `StockMovement` rows are clinic-scoped and do not capture branch.
- `StockService.replenish()` and `StockService.deduct()` mutate `product.quantity` directly.
- Inventory list, low-stock, replenish, and stock movement screens implicitly operate at clinic scope.
- The web app already tracks an active branch in client session state and sends `x-active-branch` on browser requests through `apiClient`, but inventory stock APIs do not yet enforce it consistently.
- Visit-driven stock deduction currently runs through an async finalization listener, and the visit domain does not yet persist branch context for inventory deduction.

## Recommended Approach

Use a dedicated branch stock balance table as the only source of truth for stock quantities.

### Why this approach

- It preserves clinic-scoped item masters while making stock ownership explicit per branch.
- It avoids running two quantity models in parallel, which would drift quickly.
- It keeps stock-sensitive reads fast and straightforward compared with recomputing balances from movements on every request.
- It gives a clear place to enforce uniqueness and locking around `clinicId + branchId + productId`.

## Data Model

### Main branch resolution

The current schema has no dedicated `isMain` or `isPrimary` flag on `Branch`.

For this design, the clinic's `main branch` is resolved deterministically as:

- the branch with the earliest `createdAt`
- tie-breaker: the lowest PostgreSQL raw UUID sort order for `id` as evaluated by the database, not lexical string comparison in application code

Reference SQL ordering for migration queries:

- `ORDER BY created_at ASC, id ASC` where `id` is the native PostgreSQL `uuid` column type

This rule exists only for migration and backfill of legacy clinic-scoped stock data. Runtime inventory operations must still require explicit active branch context and must never fall back to this branch.

### Product

`Product` remains clinic-scoped and continues to store master data such as:

- code
- name
- item type
- category
- base unit
- reorder threshold
- pricing and tax defaults

`Product.quantity` is removed from the runtime stock model and should no longer be read or written by inventory logic.

### New table: BranchStockBalance

Add a new table, tentatively named `BranchStockBalance`, with these fields:

- `id`
- `clinicId`
- `branchId`
- `productId`
- `quantity`
- `createdAt`
- `updatedAt`

Constraints and indexes:

- Unique constraint on `clinicId + branchId + productId`
- Index on `clinicId + branchId`
- Index on `productId`

Referential behavior:

- `Clinic -> BranchStockBalance`: cascade is acceptable only if the whole clinic is hard-deleted
- `Branch -> BranchStockBalance`: restrict delete while balances exist; hard delete of branches with inventory history is unsupported in this phase
- `Product -> BranchStockBalance`: restrict delete while balances exist; products should continue using inactive/archive semantics rather than hard delete

Enforcement:

- the restrict behavior should be enforced by database foreign keys
- if an application flow still attempts such a delete, it should surface as `409 Conflict`

Behavior:

- Only stocked products should have rows here.
- Service items should not have `BranchStockBalance` rows.
- Missing row for a stocked item is treated as zero on reads until a mutation initializes it.

### StockMovement

Extend `StockMovement` with required `branchId`.

Also add nullable `idempotencyKey` for compensating reversals, with a unique constraint scoped to `clinicId + idempotencyKey` when the key is present.

Referential behavior:

- `Branch -> StockMovement`: restrict delete after movement history exists so audit trails remain intact; hard delete of referenced branches is unsupported in this phase
- `Product -> StockMovement`: restrict delete after movement history exists so audit trails remain intact

Behavior:

- Every future movement must include `branchId`.
- Historical movements are backfilled to the clinic's main branch because no reliable per-branch history exists today.

## Migration Strategy

Perform the migration in one forward-only sequence.

Migration execution rules:

- use a two-phase deployment:
	- Phase A: expand schema and backfill while old runtime logic is still active
	- Phase B: deploy runtime cutover after backfill validation passes
- Phase A to Phase B transition requires a short maintenance window for inventory mutations: replenish, deduct, and visit finalization that consumes stock must be write-blocked after backfill starts and remain blocked until Phase B is live
- schema changes and bulk backfill should run in a controlled deployment window
- each backfill statement must be idempotent so a failed deployment can be retried safely
- if any backfill step fails, deployment stops before runtime code is switched to branch-scoped reads and writes
- runtime cutover happens only after backfill completes successfully

### Step 1: Schema changes

- Create `BranchStockBalance`
- Add nullable `branchId` to `StockMovement`
- Add nullable `idempotencyKey` to `StockMovement`
- Add `branchId` to the Mongo `VisitRecord` schema and `IVisitRecord` contract
- Keep existing runtime logic reading `Product.quantity` during this phase

### Step 2: Backfill balances

For each clinic:

- Resolve the clinic's main branch using earliest `createdAt`, then lowest PostgreSQL UUID sort order for `id`
- Skip clinics with zero branches and flag them for manual remediation before Phase B cutover
- Insert one `BranchStockBalance` row per stocked product for that branch using the current `Product.quantity`
- Do not create rows for service items
- Use idempotent SQL semantics equivalent to `INSERT ... ON CONFLICT (clinic_id, branch_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity` so reruns converge on the same seeded balance state before cutover
- Backfill all non-service products regardless of `isActive` so inactive legacy items keep consistent stock history

Phase A safety rule:

- inventory mutations are write-blocked between the start of final validated backfill and Phase B cutover so `BranchStockBalance` cannot drift from late `Product.quantity` writes
- enforcement mechanism: backend checks a deployment-controlled `INVENTORY_WRITE_BLOCKED` flag before replenish, visit-finalization deduct, and any other stock mutation path, returning `503 Service Unavailable` with a maintenance message while the flag is enabled

Backfill rerun rule:

- Step 2 and Step 3 reruns are allowed only before Phase B cutover is enabled
- once branch-scoped runtime writes are live, rerunning seed backfill statements is forbidden because it could overwrite live branch balances

### Step 3: Backfill movements

For each existing `StockMovement` row:

- Set `branchId` to the clinic's main branch
- Use idempotent update semantics so reruns do not modify already-backfilled rows beyond setting the same `branchId`

### Step 4: Cut over reads and writes

- Deploy backend and frontend code that reads and writes `BranchStockBalance`
- Apply guard enforcement for stock-sensitive HTTP endpoints
- Stop inventory application logic from reading or writing `Product.quantity`

### Step 5: Post-cutover cleanup

- Make `StockMovement.branchId` required after production validation passes
- Keep `Product.quantity` present temporarily for rollback safety, but treat it as deprecated and unused by inventory runtime logic

Rollback policy:

- rollback to the pre-cutover runtime is supported only before any branch-scoped stock writes occur in production
- once Step 4 is live, reverting to old runtime logic that reads `Product.quantity` is forbidden because that column is already stale
- post-cutover recovery must therefore be a forward-fix on the branch-scoped model, not a rollback to clinic-scoped quantity logic

## Branch Context Rules

Active branch context is mandatory for stock-sensitive operations.

### Required behavior

If active branch context is missing:

- stock mutation endpoints must reject the request
- stock list and low-stock endpoints must reject the request
- movement history endpoints must reject the request

No fallback is allowed to:

- first authorized branch
- clinic main branch
- any implicit default

### Resolution source

The canonical request context should come from the existing active-branch mechanism already used by the web app.

Recommended rule:

- backend resolves active branch from authenticated request context or the `x-active-branch` request header
- mutation payloads may also include `branchId` for explicitness and audit clarity, but the server must validate that it matches the resolved active branch if both are supplied

Mismatch rule:

- if both resolved active branch and payload `branchId` are present and do not match, reject with `400 Bad Request`
- the resolved branch from request context remains canonical
- mismatch events should be logged as validation failures for audit and debugging

This keeps one authoritative branch context while still making request bodies explicit where useful.

HTTP enforcement rule:

- stock-sensitive HTTP endpoints must apply the existing branch-context guard before controller logic runs
- guard rejection for missing or unauthorized branch context is treated as the canonical HTTP enforcement path
- controllers should use a dedicated `@ActiveBranch()` decorator that reads the guard-populated `request.activeBranchId` so branch injection follows the same pattern as `@TenantId()` and `@CurrentUser()`
- required guarded HTTP routes in this phase are replenish, stock movements, product list, and low-stock
- `@ActiveBranch()` is intended for guarded routes; if `request.activeBranchId` is absent, the decorator should fail fast with the same forbidden branch-context error instead of returning `undefined`
- branch-context enforcement relies on the existing branch guard as the authorization check for whether the user may act on the selected branch
- when a route uses both session and branch enforcement, session resolution must run first and branch-context validation second
- branch-context resolution must run after session resolution and before controller handler execution

## Backend Design

### Controller layer

Update stock-sensitive endpoints to require active branch context.

Impacted endpoints:

- `POST /api/v1/inventory/stock/replenish`
- internal deduct flow triggered by visit finalization and any future server-side stock-consuming workflows
- `GET /api/v1/inventory/products`
- `GET /api/v1/inventory/products/low-stock`
- stock movement listing endpoint

The controller should pass:

- `clinicId`
- `branchId`
- `actorId`
- request payload

into service methods.

Replenish request DTO shape in this phase:

- `productId: string`
- `quantity: number`
- `referenceId: string`
- `branchId?: string`

Validation responsibility:

- branch guard resolves and authorizes the active branch
- controller reads resolved branch context via `@ActiveBranch()` and compares optional payload `branchId` against it before calling the service
- service layer assumes it receives a validated `branchId`

### Replenish flow

Current behavior:

- loads product by clinic
- updates `Product.quantity`
- writes clinic-scoped movement

New behavior:

- require active branch context
- load clinic-scoped product master
- reject if product is not found or is a service item
- initialize `BranchStockBalance` for `(clinicId, branchId, productId)` with database upsert semantics inside the same transaction as the stock write
- increment branch balance quantity
- write `StockMovement` with `branchId`
- return updated branch-scoped quantity information

Concurrency rule:

- balance initialization and quantity mutation must happen in one transaction
- creation of the first balance row must rely on the unique constraint plus upsert behavior, not a naive read-then-create pattern
- concurrent replenishment requests for the same `(clinicId, branchId, productId)` must converge on one persisted balance row without duplicate-row failures
- implementation should use the equivalent of:
	- transaction start
	- `INSERT ... ON CONFLICT (...) DO UPDATE SET updated_at = branch_stock_balances.updated_at RETURNING id` so every concurrent request receives the canonical persisted row id
	- `SELECT ... FOR UPDATE` or equivalent row locking against that returned balance row id
	- atomic `quantity = quantity + delta` update against the locked row inside the same transaction
	- insert movement using the computed before/after quantities
	- transaction commit
- correctness target: two concurrent `+5` replenishments against a missing balance must end at quantity `10`, never `5`

### Deduct flow

Current behavior:

- reads `Product.quantity`
- decrements it directly

New behavior:

- require branch context at the service boundary
- no new public deduct endpoint is introduced in this phase; deduct remains an internal stock service operation invoked by visit finalization and similar backend workflows
- read `BranchStockBalance` for `(clinicId, branchId, productId)`
- treat missing balance as zero
- reject if insufficient branch stock
- decrement branch balance
- write `StockMovement` with `branchId`
- evaluate low-stock against branch quantity and product reorder threshold
- deduct never initializes a missing `BranchStockBalance` row; missing row means zero available stock and the operation fails

Event contract change:

- branch-scoped deduct depends on visit domain carrying branch context; this phase therefore requires the visit record schema and `IVisitRecord` contract to persist `branchId`
- `visit.branchId` is required at visit creation time, assigned from the caller's active branch context, and must belong to the authenticated user's authorized branches
- if a visit is created without active branch context, creation fails with the same forbidden branch-context error used by other branch-scoped workflows
- `visit.branchId` becomes immutable for the life of the visit record; application-layer enforcement is sufficient in this phase because no visit update flow may expose branch reassignment
- visit finalization spans Mongo plus Postgres, so this phase uses application-level orchestration rather than a cross-database ACID transaction
- finalization order is: validate visit and branch; execute stock deduction in a Postgres transaction; persist finalized visit state in Mongo; emit downstream completion events only after both writes succeed
- if Mongo finalization persistence fails after stock deduction commits, the finalize flow must execute a compensating replenish or movement reversal for the same branch before returning failure
- the compensating reversal must use an idempotency key derived from `visitId + productId + originalMovementId`, persisted through `StockMovement.idempotencyKey`, and enforced by the unique key so retries remain exactly-once
- retry the compensating reversal up to 3 times, then emit an `inventory.compensation_failed` operational event and structured error log for the existing alerting pipeline while keeping the visit unfinalized
- `VisitFinalizedEvent` constructor becomes `(clinicId, visitId, patientId, vetId, branchId, finalizedAt, productIds)` and is emitted only after stock deduction plus visit persistence both succeed
- if a visit cannot produce branch context, visit finalization must fail explicitly rather than defaulting to clinic main branch or first authorized branch
- inventory deduction must not remain a log-and-continue async side effect in this phase because that would create inventory drift
- if stock deduction fails for any reason during finalization, the visit remains unfinalized, the user receives the deduction error, and they may correct stock or prescription data before retrying finalization

Negative stock rule:

- branch stock must never go negative
- deduct must reject whenever `newQuantity < 0`
- missing balance rows therefore behave as zero available stock

### Inventory list

Current behavior:

- returns clinic-scoped product list with clinic-level quantity semantics

New behavior:

- require active branch context
- return clinic-scoped item masters joined with branch balance for the active branch
- stocked items return quantity from `BranchStockBalance`, defaulting to zero when no row exists
- service items remain visible in the inventory list but quantity-related fields must be `null` in the API response and render as a dash in the UI, never as numeric zero
- preserve the current paginated contract of `items`, `total`, `page`, and `perPage`
- do not filter out products that lack a branch balance row; they remain visible with branch quantity `0`

### Low-stock endpoint

Current behavior:

- evaluates product quantity at clinic scope

New behavior:

- require active branch context
- compare `BranchStockBalance.quantity` with `Product.reorderThreshold`
- return only low-stock items for the active branch
- keep the existing `GET /inventory/products/low-stock` endpoint and change its semantics to branch-scoped results
- stocked goods with no `BranchStockBalance` row are excluded from low-stock results until that branch has an initialized balance row
- extend `LowStockEvent` to include `branchId` so low-stock notifications remain branch-specific end to end
- `LowStockEvent.branchId` is required in the same deployment that introduces branch-scoped low-stock behavior; no backward-compatibility shim is required because this is an internal event contract updated together with its consumers
- all in-repo consumers of `LowStockEvent` and `VisitFinalizedEvent` must be updated in the same release before branch-scoped behavior is enabled; external event-version compatibility is out of scope for this phase

### Stock movements endpoint

Current behavior:

- returns clinic-scoped movement history

New behavior:

- require active branch context
- return only movements for the active branch by default
- optional product filter remains branch-scoped
- preserve current ordering by `createdAt desc`
- preserve the current capped response behavior of up to 100 records in this phase, with no new pagination parameters introduced yet

## Frontend Design

### Active branch handling

The existing branch selector remains the only branch picker.

Rules:

- inventory screens derive branch context from the current active branch
- replenish form does not add a separate branch selector
- if no active branch exists, frontend should surface a clear action-oriented error instead of silently retrying without branch context

### Replenish page

Current behavior:

- loads products through inventory list API
- submits replenish payload without explicit branch payload field

New behavior:

- continue using the active branch from shared session/client request context
- submit replenish requests with explicit `branchId` in the payload for audit clarity while also sending the canonical active-branch request context
- if payload includes branchId, it must match the active branch context sent by the client
- refresh product options and displayed balances for the active branch after a successful replenish action

### Inventory list page

Current behavior:

- displays stock values derived from clinic-scoped logic

New behavior:

- render stock balances for the active branch only
- low-stock banner updates when active branch changes
- product table quantities update when active branch changes
- replenish CTA leads into branch-scoped replenish flow using the same active branch context
- service items remain visible in the list but should render a null-or-dash stock state instead of a stocked zero-balance state

### Stock movements tab

Current behavior:

- shows clinic-scoped movement history

New behavior:

- load branch-scoped movements only
- reload on branch change

### Branch switching during in-flight requests

- inventory requests bind to the active branch at the moment the request is created
- in-flight requests are not automatically retried against a newly selected branch
- if a response returns after the user switched branches, that response still belongs to the original request branch and must not overwrite visible state for the newly selected branch
- branch changes should clear transient success state and reload inventory data for the new branch immediately after the selector commits the new active branch
- mutation actions should remain disabled while their own submit request is in flight
- frontend should capture `requestBranchId` at submit/load time and apply the response only if `requestBranchId === currentActiveBranchId` when the response settles
- component-local request metadata is sufficient in this phase; cleanup happens immediately after each request settles, and concurrent requests are evaluated independently against the current branch before mutating visible state

## Error Handling

### Stable error contract

All stock-sensitive inventory endpoints should return explicit errors with stable status codes.

Required cases:

- missing active branch context: `403 Forbidden`
- request branch mismatch between payload and resolved context: `400 Bad Request`
- insufficient branch stock: `400 Bad Request`
- unauthorized branch access: `403 Forbidden`
- missing product: `404 Not Found`
- service item stock mutation attempt: `400 Bad Request`

Response payloads should follow the API's existing error structure consistently and must include a human-readable `message` field usable by the frontend.

For this phase, HTTP errors should preserve the existing Nest-style payload fields `statusCode`, `message`, and `error`.

Canonical messages for this phase:

- missing active branch context: `Please select a branch before managing inventory.`
- request branch mismatch: `Request branch does not match the active branch context.`
- insufficient branch stock: `Insufficient stock for this branch.`

Localization rule:

- backend returns canonical English messages in the stable payload
- frontend maps these failures into the existing i18n system for display and must not depend on backend-localized text

### Missing branch context

Backend response:

- reject with explicit forbidden or validation error according to the stable error contract above
- message should clearly state that active branch selection is required before inventory management

Frontend behavior:

- surface a user-facing message such as: `Please select a branch before managing inventory.`
- do not silently fallback
- render this as an inline alert/banner in the inventory page content area rather than only as a transient toast
- on initial page load without an active branch, disable stock-sensitive tables and actions until branch selection exists
- if the user has zero authorized branches, show the same blocking state with no retry loop

### Invalid branch access

If the supplied branch is not authorized for the user:

- reject request with authorization error
- frontend should present a standard access error state

### Invalid product usage

- replenishing or deducting a service item remains invalid
- missing stocked balance row during reads is treated as zero
- missing stocked balance row during replenish can be initialized lazily after cutover; during Phase A migration the old runtime behavior remains in place
- missing stocked balance row during deduct should behave as zero available stock and fail insufficient-stock validation
- if a product is reclassified from `SERVICE` to `STOCKED_GOOD` after cutover, its first valid replenish creates the initial branch balance row
- a failed replenish attempt before reclassification does not create a balance row; the first successful replenish after reclassification is the canonical initialization point
- historical movements remain valid regardless of later item-type changes
- hard delete of products with existing balance or movement history is forbidden; inactive/archive semantics remain the only supported retirement path

## Testing Strategy

### Database and migration tests

Verify:

- `BranchStockBalance` rows are created for stocked products in the clinic's main branch
- service items do not receive balance rows
- historical `StockMovement` rows are backfilled with main-branch `branchId`

### Service tests

Add or update tests for:

- replenish updates only the active branch balance
- deduct updates only the active branch balance
- missing branch context rejects stock-sensitive operations
- low-stock detection is branch-specific
- service items cannot be replenished or deducted
- insufficient stock is evaluated against the selected branch only
- concurrent replenish initialization does not create duplicate balance rows
- visit finalization performs synchronous deduct with `visit.branchId` before emitting downstream events
- `VisitFinalizedEvent` includes `branchId` for downstream consumers
- `LowStockEvent` includes `branchId` and branch-scoped threshold checks emit that branch value

### Controller tests

Verify:

- branch context is required on stock-sensitive endpoints
- unauthorized branch access is rejected
- returned movement and stock responses are branch-scoped
- branch mismatch between payload and active branch context returns `400 Bad Request`
- stock-sensitive HTTP controllers apply the branch-context guard

### Web tests

Add or update tests for:

- inventory list shows balances for the active branch
- low-stock banner changes with active branch
- replenish form uses active branch context and refreshes branch-specific balances
- stock movements tab shows only the active branch's movements
- branch-required errors render as inline page alerts
- inventory page remains blocked when no active branch is selected

### E2E tests

Cover:

- switching branches changes visible quantity for the same product
- replenishing in branch A does not change branch B balances
- low-stock results differ by branch where expected
- stock movements show only the active branch's records
- requests without active branch context fail clearly
- visit finalization deducts stock only from the visit's branch

### Guarding against legacy `Product.quantity` usage

- add service and integration tests that deliberately seed conflicting values between `Product.quantity` and `BranchStockBalance.quantity`, then assert inventory flows always use branch balance values
- implementation review should reject any new stock-sensitive reads from `Product.quantity`

## Acceptance Criteria

The design is complete when all of the following are true:

- Product masters remain clinic-scoped
- Stock balances are stored per `clinicId + branchId + productId`
- Existing clinic-level stock is migrated into the clinic's main branch
- Historical stock movements are assigned to the clinic's main branch
- Active branch context is mandatory for replenish, deduct, inventory list balances, low-stock, and stock movements
- No inventory stock operation falls back implicitly when branch context is missing
- Inventory list quantities reflect the currently selected branch only
- Replenish updates only the currently selected branch
- Low-stock and movement history are scoped to the currently selected branch
- `Product.quantity` is no longer used as a source of truth

## Risks And Mitigations

### Risk: legacy code paths still read `Product.quantity`

Mitigation:

- search and replace all stock-sensitive reads during implementation
- add tests that would fail if clinic-level quantity is still used
- keep `Product.quantity` only as a temporary deprecated column during rollout, never as a fallback at runtime

### Risk: branch context mismatch between header and payload

Mitigation:

- define one canonical branch-resolution rule on the server
- validate equality if both header and payload branch are present

### Risk: branch-scoped inventory list introduces query overhead

Mitigation:

- fetch branch balances in one batched query or join for the active branch instead of per-product lookups
- validate acceptable list performance during implementation review for clinics with large item catalogs

### Risk: backfilled historical movements imply false branch precision

Mitigation:

- document clearly that legacy movements are assigned to main branch as a migration compromise
- avoid overstating historical branch accuracy in user-facing copy

## Rollout Notes

- Apply schema migration and backfill before enabling the new runtime logic
- Release backend enforcement and frontend branch-scoped rendering together to avoid mixed semantics
- Run the inventory test suite with branch switching scenarios before deployment
- Monitor branch-specific replenish and low-stock behavior immediately after rollout
