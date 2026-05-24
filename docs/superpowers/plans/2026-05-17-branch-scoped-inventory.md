# Branch-Scoped Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert inventory stock from clinic-scoped `Product.quantity` writes to branch-scoped balances, enforce active branch context across inventory APIs, and make visit-driven stock deduction branch-aware.

**Architecture:** Keep `Product` as the clinic-scoped item master and introduce a dedicated `BranchStockBalance` table as the stock source of truth. Inventory writes move into transactional balance + movement updates, product list/low-stock reads join the active branch balance, and visit finalization captures `branchId` up front so stock deduction can happen synchronously before emitting downstream events.

**Tech Stack:** NestJS 11, Prisma + PostgreSQL, Mongoose, Next.js App Router, Zustand, next-intl, Jest, Vitest, Playwright

---

## Scope Decision

This feature stays in one plan.

The schema changes, inventory API changes, clinical visit changes, and inventory UI changes are one coupled vertical slice. Splitting them into separate plans would create non-shippable intermediates where either the backend requires branch context the frontend cannot supply, or visit finalization still deducts from clinic-wide stock.

## File Structure

### Persistence and shared contracts

- Modify: `packages/database/prisma/schema.prisma`
  Adds `BranchStockBalance`, `StockMovement.branchId`, `StockMovement.idempotencyKey`, and relations/indexes.
- Create: `packages/database/prisma/migrations/20260517000100_branch_scoped_inventory/migration.sql`
  Applies Phase A schema expansion and deterministic backfill SQL.
- Modify: `packages/database/mongo/visit-record.schema.ts`
  Adds immutable `branchId` to visit records.
- Modify: `packages/types/src/api.ts`
  Extends inventory response types with branch-scoped quantity fields.
- Modify: `apps/api/src/common/events/domain-events.ts`
  Adds `branchId` to `VisitFinalizedEvent` and `LowStockEvent`.
- Create: `apps/api/src/common/events/domain-events.spec.ts`
  Locks the new event constructor contracts.

### Inventory backend

- Modify: `apps/api/src/common/decorators/tenant.decorator.ts`
  Adds `@ActiveBranch()` alongside `@TenantId()` and `@CurrentUser()`.
- Create: `apps/api/src/modules/inventory/controllers/stock.controller.spec.ts`
  Verifies branch-aware controller delegation and metadata.
- Modify: `apps/api/src/modules/inventory/controllers/stock.controller.ts`
  Requires active branch context on replenish and movements.
- Modify: `apps/api/src/modules/inventory/controllers/product.controller.ts`
  Requires active branch context on list and low-stock endpoints.
- Modify: `apps/api/src/modules/inventory/controllers/product.controller.spec.ts`
  Verifies branch guard/delegation for list and low-stock routes.
- Create: `apps/api/src/modules/inventory/services/inventory-write-guard.service.ts`
  Centralizes the `INVENTORY_WRITE_BLOCKED` maintenance gate.
- Modify: `apps/api/src/modules/inventory/services/stock.service.ts`
  Switches writes to branch balances and branch-scoped movements.
- Modify: `apps/api/src/modules/inventory/services/stock.service.spec.ts`
  Drives branch-scoped replenish, deduct, movement list, and maintenance behavior.
- Modify: `apps/api/src/modules/inventory/services/product.service.ts`
  Joins active-branch balances for item list and low-stock.
- Modify: `apps/api/src/modules/inventory/services/product.service.spec.ts`
  Drives branch list/low-stock behavior.
- Modify: `apps/api/src/modules/inventory/inventory.module.ts`
  Registers `InventoryWriteGuardService`, exports `StockService`, and removes inventory’s async finalize listener.
- Delete: `apps/api/src/modules/inventory/listeners/visit-finalized.listener.ts`
  Inventory deduction moves into `VisitService.finalize()`.

### Clinical backend

- Modify: `apps/api/src/modules/clinical/services/visit.service.ts`
  Captures `branchId` on create and performs synchronous stock deduction on finalize.
- Create: `apps/api/src/modules/clinical/services/visit.service.spec.ts`
  Drives branch capture, finalize ordering, and compensating reversal behavior.
- Modify: `apps/api/src/modules/clinical/controllers/visit.controller.ts`
  Passes `@ActiveBranch()` into visit create/finalize flows.
- Modify: `apps/api/src/modules/clinical/clinical.module.ts`
  Imports `InventoryModule` so `VisitService` can inject `StockService`.

### Web inventory UX

- Modify: `apps/web/app/(clinic)/clinic/inventory/page.tsx`
  Stops doing branch-sensitive server fetches and passes only branch-neutral data.
- Create: `apps/web/app/(clinic)/clinic/inventory/use-inventory-branch-data.ts`
  Client-side branch-bound loader for items, low-stock, and movements.
- Modify: `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx`
  Uses active branch state, blocks when branch is missing, reloads on branch changes, and ignores stale responses.
- Modify: `apps/web/app/(clinic)/clinic/inventory/replenish/page.tsx`
  Sends explicit `branchId`, blocks when branch is missing, and refreshes branch-scoped balances.
- Modify: `apps/web/lib/api-client.ts`
  Extends `fetchPaginated()` so browser-side paginated requests also send `x-active-branch`.

### Regression coverage

- Modify: `apps/web/test/e2e/inventory-replenish.spec.ts`
  Covers missing-branch and branch-bound replenish behavior.
- Create: `apps/web/test/e2e/inventory-branch-scoping.spec.ts`
  Covers branch switch quantity changes, low-stock branch scoping, and movements scoping.

## Task 1: Add Shared Branch Inventory Contracts

**Files:**
- Create: `apps/api/src/common/events/domain-events.spec.ts`
- Modify: `apps/api/src/common/events/domain-events.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260517000100_branch_scoped_inventory/migration.sql`
- Modify: `packages/database/mongo/visit-record.schema.ts`
- Modify: `packages/types/src/api.ts`
- Test: `apps/api/src/common/events/domain-events.spec.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { LowStockEvent, VisitFinalizedEvent } from './domain-events';

describe('domain event contracts', () => {
  it('VisitFinalizedEvent carries branchId before finalizedAt', () => {
    const event = new VisitFinalizedEvent(
      'clinic-1',
      'visit-1',
      'patient-1',
      'vet-1',
      'branch-1',
      new Date('2026-05-17T10:00:00.000Z'),
      ['product-1'],
    );

    expect(event.branchId).toBe('branch-1');
    expect(event.productIds).toEqual(['product-1']);
  });

  it('LowStockEvent carries branchId for branch-scoped alerts', () => {
    const event = new LowStockEvent('clinic-1', 'branch-1', 'product-1', 'Drug', 2, 5);
    expect(event.branchId).toBe('branch-1');
    expect(event.currentQuantity).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api test -- src/common/events/domain-events.spec.ts --runInBand`

Expected: FAIL with TypeScript/Jest errors because `VisitFinalizedEvent` and `LowStockEvent` do not expose `branchId` yet.

- [ ] **Step 3: Write the minimal shared-contract implementation**

```ts
// apps/api/src/common/events/domain-events.ts
export class VisitFinalizedEvent {
  constructor(
    public readonly clinicId: string,
    public readonly visitId: string,
    public readonly patientId: string,
    public readonly vetId: string,
    public readonly branchId: string,
    public readonly finalizedAt: Date,
    public readonly productIds: string[],
  ) {}
}

export class LowStockEvent {
  constructor(
    public readonly clinicId: string,
    public readonly branchId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly currentQuantity: number,
    public readonly reorderThreshold: number,
  ) {}
}
```

```prisma
// packages/database/prisma/schema.prisma
model BranchStockBalance {
  id        String   @id @default(uuid())
  clinicId  String
  branchId  String
  productId String
  quantity  Decimal  @default(0) @db.Decimal(10, 3)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  clinic  Clinic  @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  branch  Branch  @relation(fields: [branchId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@unique([clinicId, branchId, productId])
  @@index([clinicId, branchId])
  @@index([productId])
  @@map("branch_stock_balances")
}

model Product {
  // ...existing fields...
  branchStockBalances BranchStockBalance[]
  stockMovements      StockMovement[]
}

model StockMovement {
  id             String    @id @default(uuid())
  clinicId       String
  branchId       String?
  productId      String
  idempotencyKey String?
  delta          Decimal   @db.Decimal(10, 3)
  quantityBefore Decimal   @db.Decimal(10, 3)
  quantityAfter  Decimal   @db.Decimal(10, 3)
  reason         StockMovementReason
  referenceType  StockMovementRefType
  referenceId    String
  actorId        String
  createdAt      DateTime  @default(now())

  clinic  Clinic  @relation(fields: [clinicId], references: [id])
  branch  Branch? @relation(fields: [branchId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@unique([clinicId, idempotencyKey])
  @@index([clinicId, branchId, createdAt])
  @@index([clinicId, productId])
  @@map("stock_movements")
}
```

```sql
-- packages/database/prisma/migrations/20260517000100_branch_scoped_inventory/migration.sql
CREATE TABLE "branch_stock_balances" (
  "id" TEXT PRIMARY KEY,
  "clinicId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "stock_movements"
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "branch_stock_balances_clinic_branch_product_key"
  ON "branch_stock_balances"("clinicId", "branchId", "productId");
CREATE INDEX "branch_stock_balances_clinic_branch_idx"
  ON "branch_stock_balances"("clinicId", "branchId");
CREATE UNIQUE INDEX "stock_movements_clinic_idempotency_key"
  ON "stock_movements"("clinicId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

WITH main_branch AS (
  SELECT DISTINCT ON (b."clinicId")
    b."clinicId",
    b.id AS "branchId"
  FROM branches b
  ORDER BY b."clinicId", b."createdAt" ASC, b.id ASC
)
INSERT INTO "branch_stock_balances" (
  "id",
  "clinicId",
  "branchId",
  "productId",
  "quantity",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."clinicId",
  mb."branchId",
  p.id,
  p.quantity,
  NOW(),
  NOW()
FROM products p
JOIN main_branch mb ON mb."clinicId" = p."clinicId"
WHERE p."itemType" <> 'SERVICE'
ON CONFLICT ("clinicId", "branchId", "productId")
DO UPDATE SET "quantity" = EXCLUDED."quantity";

WITH main_branch AS (
  SELECT DISTINCT ON (b."clinicId")
    b."clinicId",
    b.id AS "branchId"
  FROM branches b
  ORDER BY b."clinicId", b."createdAt" ASC, b.id ASC
)
UPDATE "stock_movements" sm
SET "branchId" = mb."branchId"
FROM main_branch mb
WHERE sm."clinicId" = mb."clinicId"
  AND sm."branchId" IS NULL;
```

```ts
// packages/database/mongo/visit-record.schema.ts
export interface IVisitRecord extends Document {
  clinicId: string;
  branchId: string;
  patientId: Types.ObjectId;
  // ...existing fields...
}

const VisitRecordSchema = new Schema<IVisitRecord>({
  clinicId: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, required: true, ref: 'PetProfile' },
  // ...existing fields...
});
```

```ts
// packages/types/src/api.ts
export interface ItemSummaryResponse {
  id: string;
  code: string;
  name: string;
  itemType: ItemType;
  category: { id: string; name: string } | null;
  baseUnit: { id: string; name: string; symbol: string | null } | null;
  standardCost: number;
  baseSellingPrice: number;
  isTaxInclusive: boolean;
  defaultTaxCode: { id: string; code: string; rate: number; type: string } | null;
  isControlledSubstance: boolean;
  requiresBatchAndExpiryTracking: boolean;
  defaultSupplier: { id: string; name: string } | null;
  quantity: number | null;
  reorderThreshold: number;
  isActive: boolean;
}
```

- [ ] **Step 4: Run focused verification**

Run: `npm --prefix apps/api test -- src/common/events/domain-events.spec.ts --runInBand`
Expected: PASS

Run: `npx prisma validate --schema packages/database/prisma/schema.prisma`
Expected: `The schema at packages/database/prisma/schema.prisma is valid`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/events/domain-events.spec.ts apps/api/src/common/events/domain-events.ts packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260517000100_branch_scoped_inventory/migration.sql packages/database/mongo/visit-record.schema.ts packages/types/src/api.ts
git commit -m "feat: add branch inventory persistence contracts"
```

### Task 2: Refactor StockService to Branch Balances

**Files:**
- Create: `apps/api/src/modules/inventory/services/inventory-write-guard.service.ts`
- Modify: `apps/api/src/modules/inventory/services/stock.service.ts`
- Modify: `apps/api/src/modules/inventory/services/stock.service.spec.ts`
- Modify: `apps/api/src/modules/inventory/inventory.module.ts`
- Test: `apps/api/src/modules/inventory/services/stock.service.spec.ts`

- [ ] **Step 1: Write the failing stock-service tests**

```ts
it('writes replenishment into the active branch balance instead of Product.quantity', async () => {
  prisma.product.findUnique.mockResolvedValue({
    id: 'p1',
    name: 'Drug',
    itemType: 'STOCKED_GOOD',
    reorderThreshold: 5,
  });
  prisma.branchStockBalance = {
    upsert: jest.fn().mockResolvedValue({ id: 'bal-1' }),
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 10 }),
    update: jest.fn().mockResolvedValue({ id: 'bal-1', quantity: 15 }),
  };
  prisma.stockMovement.create.mockResolvedValue({ id: 'sm-1' });

  await service.replenish(CLINIC_ID, {
    branchId: 'branch-1',
    productId: 'p1',
    quantity: 5,
    referenceId: 'PO-1',
    actorId: 'user-1',
  });

  expect(prisma.product.update).not.toHaveBeenCalled();
  expect(prisma.branchStockBalance.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { quantity: 15 } }),
  );
  expect(prisma.stockMovement.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ branchId: 'branch-1' }) }),
  );
});

it('rejects deduct when the branch has no balance row', async () => {
  prisma.product.findUnique.mockResolvedValue({
    id: 'p1',
    name: 'Drug',
    itemType: 'STOCKED_GOOD',
    reorderThreshold: 5,
  });
  prisma.branchStockBalance = {
    findUnique: jest.fn().mockResolvedValue(null),
  };

  await expect(
    service.deduct(CLINIC_ID, {
      branchId: 'branch-1',
      productId: 'p1',
      quantity: 1,
      visitRecordId: 'visit-1',
      actorId: 'user-1',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('blocks stock writes while INVENTORY_WRITE_BLOCKED=true', async () => {
  process.env.INVENTORY_WRITE_BLOCKED = 'true';
  await expect(
    service.replenish(CLINIC_ID, {
      branchId: 'branch-1',
      productId: 'p1',
      quantity: 1,
      referenceId: 'PO-2',
      actorId: 'user-1',
    }),
  ).rejects.toThrow('Inventory writes are temporarily disabled during maintenance.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api test -- src/modules/inventory/services/stock.service.spec.ts --runInBand`

Expected: FAIL because `ReplenishDto`/`DeductDto` do not accept `branchId`, there is no `branchStockBalance` logic, and no maintenance gate exists.

- [ ] **Step 3: Write the minimal branch-balance implementation**

```ts
// apps/api/src/modules/inventory/services/inventory-write-guard.service.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class InventoryWriteGuardService {
  assertWritable() {
    if (process.env.INVENTORY_WRITE_BLOCKED === 'true') {
      throw new ServiceUnavailableException(
        'Inventory writes are temporarily disabled during maintenance.',
      );
    }
  }
}
```

```ts
// apps/api/src/modules/inventory/services/stock.service.ts
export interface ReplenishDto {
  branchId: string;
  productId: string;
  quantity: number;
  referenceId: string;
  actorId: string;
}

export interface DeductDto {
  branchId: string;
  productId: string;
  quantity: number;
  visitRecordId: string;
  actorId: string;
  idempotencyKey?: string;
}

async replenish(clinicId: string, dto: ReplenishDto) {
  this.writeGuard.assertWritable();
  const product = await scopedPrisma(this.prisma, clinicId).product.findUnique({ where: { id: dto.productId } });
  if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
  if (product.itemType === 'SERVICE') {
    throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
  }

  return this.prisma.$transaction(async (tx) => {
    const seeded = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO branch_stock_balances (id, "clinicId", "branchId", "productId", quantity, "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${clinicId}, ${dto.branchId}, ${dto.productId}, 0, NOW(), NOW())
      ON CONFLICT ("clinicId", "branchId", "productId")
      DO UPDATE SET "updatedAt" = branch_stock_balances."updatedAt"
      RETURNING id
    `;

    const balance = await tx.$queryRaw<{ id: string; quantity: number }[]>`
      SELECT id, quantity
      FROM branch_stock_balances
      WHERE id = ${seeded[0].id}
      FOR UPDATE
    `;

    const qBefore = Number(balance[0].quantity);
    const qAfter = qBefore + dto.quantity;

    await tx.branchStockBalance.update({ where: { id: balance[0].id }, data: { quantity: qAfter } });
    const movement = await tx.stockMovement.create({
      data: {
        clinicId,
        branchId: dto.branchId,
        productId: dto.productId,
        delta: dto.quantity,
        quantityBefore: qBefore,
        quantityAfter: qAfter,
        reason: 'REPLENISH',
        referenceType: 'REPLENISHMENT',
        referenceId: dto.referenceId,
        actorId: dto.actorId,
      },
    });

    return { quantity: qAfter, movement };
  });
}
```

```ts
// apps/api/src/modules/inventory/services/stock.service.ts
async deduct(clinicId: string, dto: DeductDto) {
  this.writeGuard.assertWritable();
  const product = await scopedPrisma(this.prisma, clinicId).product.findUnique({ where: { id: dto.productId } });
  if (!product) throw new NotFoundException(`Product ${dto.productId} not found.`);
  if (product.itemType === 'SERVICE') {
    throw new BadRequestException(`Cannot modify stock for service item "${product.name}".`);
  }

  return this.prisma.$transaction(async (tx) => {
    const balance = await tx.branchStockBalance.findUnique({
      where: {
        clinicId_branchId_productId: {
          clinicId,
          branchId: dto.branchId,
          productId: dto.productId,
        },
      },
    });

    const qBefore = Number(balance?.quantity ?? 0);
    if (qBefore < dto.quantity) {
      throw new BadRequestException('Insufficient stock for this branch.');
    }

    const qAfter = qBefore - dto.quantity;
    await tx.branchStockBalance.update({
      where: { id: balance!.id },
      data: { quantity: qAfter },
    });

    const movement = await tx.stockMovement.create({
      data: {
        clinicId,
        branchId: dto.branchId,
        productId: dto.productId,
        idempotencyKey: dto.idempotencyKey,
        delta: -dto.quantity,
        quantityBefore: qBefore,
        quantityAfter: qAfter,
        reason: 'DISPENSE',
        referenceType: 'VISIT_RECORD',
        referenceId: dto.visitRecordId,
        actorId: dto.actorId,
      },
    });

    if (qAfter <= Number(product.reorderThreshold)) {
      this.events.emit(
        'inventory.low_stock',
        new LowStockEvent(clinicId, dto.branchId, product.id, product.name, qAfter, Number(product.reorderThreshold)),
      );
    }

    return { quantity: qAfter, movement };
  });
}
```

```ts
// apps/api/src/modules/inventory/inventory.module.ts
providers: [
  { provide: PrismaClient, useFactory: () => new PrismaClient() },
  ProductService,
  StockService,
  InventoryWriteGuardService,
  ReferenceService,
  UnlinkedItemsService,
  BranchContextGuard,
],
exports: [UnlinkedItemsService, ReferenceService, StockService, InventoryWriteGuardService],
```

- [ ] **Step 4: Run focused verification**

Run: `npm --prefix apps/api test -- src/modules/inventory/services/stock.service.spec.ts --runInBand`
Expected: PASS

Run: `npm --prefix apps/api run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/inventory/services/inventory-write-guard.service.ts apps/api/src/modules/inventory/services/stock.service.ts apps/api/src/modules/inventory/services/stock.service.spec.ts apps/api/src/modules/inventory/inventory.module.ts
git commit -m "feat: move stock writes to branch balances"
```

### Task 3: Enforce Active Branch Context in Inventory Controllers

**Files:**
- Modify: `apps/api/src/common/decorators/tenant.decorator.ts`
- Modify: `apps/api/src/modules/inventory/controllers/stock.controller.ts`
- Create: `apps/api/src/modules/inventory/controllers/stock.controller.spec.ts`
- Modify: `apps/api/src/modules/inventory/controllers/product.controller.ts`
- Modify: `apps/api/src/modules/inventory/controllers/product.controller.spec.ts`
- Test: `apps/api/src/modules/inventory/controllers/stock.controller.spec.ts`
- Test: `apps/api/src/modules/inventory/controllers/product.controller.spec.ts`

- [ ] **Step 1: Write the failing controller tests**

```ts
// apps/api/src/modules/inventory/controllers/stock.controller.spec.ts
it('replenish passes branchId through to StockService', async () => {
  await controller.replenish(CLINIC_ID, 'branch-1', user, {
    productId: 'p1',
    quantity: 5,
    referenceId: 'PO-1',
    branchId: 'branch-1',
  });

  expect(service.replenish).toHaveBeenCalledWith(CLINIC_ID, {
    branchId: 'branch-1',
    productId: 'p1',
    quantity: 5,
    referenceId: 'PO-1',
    actorId: user.userId,
  });
});

it('getMovements passes active branch and optional productId', async () => {
  await controller.getMovements(CLINIC_ID, 'branch-1', 'p1');
  expect(service.getMovements).toHaveBeenCalledWith(CLINIC_ID, 'branch-1', 'p1');
});
```

```ts
// apps/api/src/modules/inventory/controllers/product.controller.spec.ts
it('findAll passes active branch to ProductService', async () => {
  await controller.findAll(CLINIC_ID, 'branch-1', {} as any);
  expect(service.findAll).toHaveBeenCalledWith(CLINIC_ID, 'branch-1', {});
});

it('getLowStock passes active branch to ProductService', async () => {
  await controller.getLowStock(CLINIC_ID, 'branch-1');
  expect(service.getLowStock).toHaveBeenCalledWith(CLINIC_ID, 'branch-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api test -- src/modules/inventory/controllers/stock.controller.spec.ts src/modules/inventory/controllers/product.controller.spec.ts --runInBand`

Expected: FAIL because inventory controllers do not accept `branchId` and there is no `@ActiveBranch()` decorator yet.

- [ ] **Step 3: Write the minimal controller implementation**

```ts
// apps/api/src/common/decorators/tenant.decorator.ts
export const ActiveBranch = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { activeBranchId?: string }>();
    if (!request.activeBranchId) {
      throw new Error('ActiveBranch decorator used on a route without a resolved branch context.');
    }
    return request.activeBranchId;
  },
);
```

```ts
// apps/api/src/modules/inventory/controllers/stock.controller.ts
@Controller('inventory/stock')
@Roles(Role.CLINIC_OWNER, Role.VET, Role.ASSISTANT, Role.CASHIER, Role.STAFF)
@UseGuards(BranchContextGuard)
export class StockController {
  @Post('replenish')
  @Roles(Role.CLINIC_OWNER)
  replenish(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @CurrentUser() user: UserContext,
    @Body() body: { productId: string; quantity: number; referenceId: string; branchId?: string },
  ) {
    if (body.branchId && body.branchId !== branchId) {
      throw new BadRequestException('Request branch does not match the active branch context.');
    }
    return this.stockService.replenish(clinicId, { ...body, branchId, actorId: user.userId });
  }

  @Get('movements')
  getMovements(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Query('productId') productId?: string,
  ) {
    return this.stockService.getMovements(clinicId, branchId, productId);
  }
}
```

```ts
// apps/api/src/modules/inventory/controllers/product.controller.ts
@Controller('inventory/products')
@UseGuards(BranchContextGuard)
export class ProductController {
  @Get()
  findAll(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Query() query: ListProductsDto,
  ) {
    return this.productService.findAll(clinicId, branchId, query);
  }

  @Get('low-stock')
  getLowStock(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
  ) {
    return this.productService.getLowStock(clinicId, branchId);
  }
}
```

- [ ] **Step 4: Run focused verification**

Run: `npm --prefix apps/api test -- src/modules/inventory/controllers/stock.controller.spec.ts src/modules/inventory/controllers/product.controller.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/decorators/tenant.decorator.ts apps/api/src/modules/inventory/controllers/stock.controller.ts apps/api/src/modules/inventory/controllers/stock.controller.spec.ts apps/api/src/modules/inventory/controllers/product.controller.ts apps/api/src/modules/inventory/controllers/product.controller.spec.ts
git commit -m "feat: require active branch on inventory controllers"
```

### Task 4: Make Inventory Reads Branch-Scoped

**Files:**
- Modify: `apps/api/src/modules/inventory/services/product.service.ts`
- Modify: `apps/api/src/modules/inventory/services/product.service.spec.ts`
- Modify: `packages/types/src/api.ts`
- Test: `apps/api/src/modules/inventory/services/product.service.spec.ts`

- [ ] **Step 1: Write the failing product-service tests**

```ts
it('returns branch quantity for stocked goods and null for services', async () => {
  prisma.product.count.mockResolvedValue(2);
  prisma.product.findMany.mockResolvedValue([
    { id: 'p1', name: 'Drug', code: 'DRUG-1', itemType: 'STOCKED_GOOD', reorderThreshold: 5, isActive: true },
    { id: 'p2', name: 'Consultation', code: 'SVC-1', itemType: 'SERVICE', reorderThreshold: 0, isActive: true },
  ]);
  prisma.branchStockBalance.findMany = jest.fn().mockResolvedValue([
    { productId: 'p1', quantity: 7 },
  ]);

  const result = await service.findAll(CLINIC_ID, 'branch-1', {});

  expect(result.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'p1', quantity: 7 }),
      expect.objectContaining({ id: 'p2', quantity: null }),
    ]),
  );
});

it('returns only initialized low-stock rows for the active branch', async () => {
  prisma.branchStockBalance.findMany = jest.fn().mockResolvedValue([
    { productId: 'p1', quantity: 2, product: { id: 'p1', name: 'Drug', code: 'D1', itemType: 'STOCKED_GOOD', reorderThreshold: 5, isActive: true } },
  ]);

  const result = await service.getLowStock(CLINIC_ID, 'branch-1');
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ id: 'p1', quantity: 2 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api test -- src/modules/inventory/services/product.service.spec.ts --runInBand`

Expected: FAIL because `findAll()` and `getLowStock()` do not accept `branchId` and still read `Product.quantity`.

- [ ] **Step 3: Write the minimal branch-read implementation**

```ts
// apps/api/src/modules/inventory/services/product.service.ts
async findAll(clinicId: string, branchId: string, query: ListProductsDto = {}) {
  const db = scopedPrisma(this.prisma, clinicId);
  const { search, itemType, categoryId, includeInactive, controlledSubstance, page = 1, perPage = 50 } = query;

  const where: Record<string, unknown> = {};
  if (!includeInactive) where.isActive = true;
  if (itemType) where.itemType = itemType;
  if (categoryId) where.categoryId = categoryId;
  if (controlledSubstance !== undefined) where.isControlledSubstance = controlledSubstance;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { genericName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * perPage;
  const [total, items, balances] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: PRODUCT_INCLUDE, orderBy: [{ name: 'asc' }], skip, take: perPage }),
    db.branchStockBalance.findMany({
      where: { clinicId, branchId },
      select: { productId: true, quantity: true },
    }),
  ]);

  const byProductId = new Map(balances.map((row) => [row.productId, Number(row.quantity)]));
  return {
    items: items.map((item) => ({
      ...item,
      quantity: item.itemType === ItemType.SERVICE ? null : (byProductId.get(item.id) ?? 0),
      reorderThreshold: Number(item.reorderThreshold),
    })),
    total,
    page,
    perPage,
  };
}

async getLowStock(clinicId: string, branchId: string) {
  const db = scopedPrisma(this.prisma, clinicId);
  const balances = await db.branchStockBalance.findMany({
    where: { clinicId, branchId, product: { isActive: true, itemType: ItemType.STOCKED_GOOD } },
    include: { product: { include: PRODUCT_INCLUDE } },
  });

  return balances
    .filter((row) => Number(row.quantity) <= Number(row.product.reorderThreshold))
    .map((row) => ({
      ...row.product,
      quantity: Number(row.quantity),
      reorderThreshold: Number(row.product.reorderThreshold),
    }));
}
```

- [ ] **Step 4: Run focused verification**

Run: `npm --prefix apps/api test -- src/modules/inventory/services/product.service.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/inventory/services/product.service.ts apps/api/src/modules/inventory/services/product.service.spec.ts packages/types/src/api.ts
git commit -m "feat: make inventory reads branch scoped"
```

### Task 5: Capture Visit Branch and Finalize Synchronously

**Files:**
- Create: `apps/api/src/modules/clinical/services/visit.service.spec.ts`
- Modify: `apps/api/src/modules/clinical/services/visit.service.ts`
- Modify: `apps/api/src/modules/clinical/controllers/visit.controller.ts`
- Modify: `apps/api/src/modules/clinical/clinical.module.ts`
- Modify: `apps/api/src/modules/inventory/inventory.module.ts`
- Delete: `apps/api/src/modules/inventory/listeners/visit-finalized.listener.ts`
- Test: `apps/api/src/modules/clinical/services/visit.service.spec.ts`

- [ ] **Step 1: Write the failing visit-service tests**

```ts
it('stores branchId when creating a visit', async () => {
  visitModel.prototype.save = jest.fn().mockResolvedValue({ _id: 'visit-1', branchId: 'branch-1' });
  await service.create(CLINIC_ID, {
    patientId: '507f1f77bcf86cd799439011',
    branchId: 'branch-1',
    vetId: 'vet-1',
    chiefComplaint: 'vomiting',
  });

  expect(visitModel).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1' }));
});

it('deducts stock before emitting VisitFinalizedEvent', async () => {
  const visit = {
    _id: 'visit-1',
    clinicId: CLINIC_ID,
    branchId: 'branch-1',
    patientId: '507f1f77bcf86cd799439011',
    vetId: 'vet-1',
    status: 'draft',
    prescriptions: [{ inventoryLinked: true, productId: 'product-1' }],
    save: jest.fn().mockResolvedValue({ finalizedAt: new Date('2026-05-17T10:00:00.000Z') }),
  };
  jest.spyOn(service, 'getOne').mockResolvedValue(visit as any);

  await service.finalize(CLINIC_ID, 'visit-1', 'vet-1');

  expect(stockService.deduct).toHaveBeenCalledWith(CLINIC_ID, {
    branchId: 'branch-1',
    productId: 'product-1',
    quantity: 1,
    visitRecordId: 'visit-1',
    actorId: 'vet-1',
    idempotencyKey: expect.stringContaining('visit-1:product-1'),
  });
  expect(events.emit).toHaveBeenCalledWith(
    'visit.finalized',
    expect.objectContaining({ branchId: 'branch-1' }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api test -- src/modules/clinical/services/visit.service.spec.ts --runInBand`

Expected: FAIL because `CreateVisitDto` has no `branchId`, `VisitService` does not inject `StockService`, and finalize still emits before deducting.

- [ ] **Step 3: Write the minimal visit orchestration implementation**

```ts
// apps/api/src/modules/clinical/services/visit.service.ts
export interface CreateVisitDto {
  patientId: string;
  branchId: string;
  vetId: string;
  chiefComplaint: string;
  // ...existing fields...
}

async create(clinicId: string, dto: CreateVisitDto): Promise<IVisitRecord> {
  const doc = new this.visitModel({
    clinicId,
    branchId: dto.branchId,
    patientId: dto.patientId,
    vetId: dto.vetId,
    chiefComplaint: dto.chiefComplaint,
    soap: dto.soap ?? {},
    prescriptions: dto.prescriptions ?? [],
    attachments: [],
    status: 'draft',
    visitDate: new Date(),
  });
  return doc.save();
}

async finalize(clinicId: string, visitId: string, vetId: string): Promise<IVisitRecord> {
  const visit = await this.getOne(clinicId, visitId);
  if (visit.status !== 'draft') {
    throw new BadRequestException('Visit is not in draft status.');
  }

  const productIds = (visit.prescriptions ?? [])
    .filter((p) => p.inventoryLinked && p.productId)
    .map((p) => p.productId!);

  for (const productId of productIds) {
    await this.stockService.deduct(clinicId, {
      branchId: visit.branchId,
      productId,
      quantity: 1,
      visitRecordId: visitId,
      actorId: vetId,
      idempotencyKey: `${visitId}:${productId}:deduct`,
    });
  }

  visit.status = 'finalized';
  visit.finalizedAt = new Date();

  try {
    const saved = await visit.save();
    this.events.emit(
      'visit.finalized',
      new VisitFinalizedEvent(
        clinicId,
        visitId,
        visit.patientId.toString(),
        vetId,
        visit.branchId,
        saved.finalizedAt!,
        productIds,
      ),
    );
    return saved;
  } catch (error) {
    for (const productId of productIds) {
      await this.stockService.replenish(clinicId, {
        branchId: visit.branchId,
        productId,
        quantity: 1,
        referenceId: visitId,
        actorId: vetId,
      });
    }
    throw error;
  }
}
```

```ts
// apps/api/src/modules/clinical/controllers/visit.controller.ts
create(
  @TenantId() clinicId: string,
  @ActiveBranch() branchId: string,
  @CurrentUser() user: UserContext,
  @Param('patientId') patientId: string,
  @Body() dto: Omit<CreateVisitDto, 'patientId' | 'branchId'>,
) {
  return this.visitService.create(clinicId, { ...dto, patientId, branchId });
}
```

```ts
// apps/api/src/modules/clinical/clinical.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MODEL_NAMES.PET_PROFILE, schema: PetProfileSchema },
      { name: MODEL_NAMES.VISIT_RECORD, schema: VisitRecordSchema },
      { name: MODEL_NAMES.VACCINATION_RECORD, schema: VaccinationRecordSchema },
    ]),
    EventsModule,
    InventoryModule,
  ],
  providers: [PatientService, VisitService, VaccinationService],
})
export class ClinicalModule {}
```

```ts
// apps/api/src/modules/inventory/inventory.module.ts
exports: [UnlinkedItemsService, ReferenceService, StockService, InventoryWriteGuardService],
```

- [ ] **Step 4: Run focused verification**

Run: `npm --prefix apps/api test -- src/modules/clinical/services/visit.service.spec.ts --runInBand`
Expected: PASS

Run: `npm --prefix apps/api run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/clinical/services/visit.service.spec.ts apps/api/src/modules/clinical/services/visit.service.ts apps/api/src/modules/clinical/controllers/visit.controller.ts apps/api/src/modules/clinical/clinical.module.ts apps/api/src/modules/inventory/inventory.module.ts packages/database/mongo/visit-record.schema.ts apps/api/src/common/events/domain-events.ts
git rm apps/api/src/modules/inventory/listeners/visit-finalized.listener.ts
git commit -m "feat: finalize visits with branch-scoped stock deduction"
```

### Task 6: Make Inventory UI Load and Mutate by Active Branch

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/inventory/page.tsx`
- Create: `apps/web/app/(clinic)/clinic/inventory/use-inventory-branch-data.ts`
- Modify: `apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx`
- Modify: `apps/web/app/(clinic)/clinic/inventory/replenish/page.tsx`
- Modify: `apps/web/lib/api-client.ts`
- Test: `apps/web/test/e2e/inventory-replenish.spec.ts`

- [ ] **Step 1: Write the failing browser-flow test**

```ts
// apps/web/test/e2e/inventory-replenish.spec.ts
test('shows a blocking branch message when no active branch is available', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto('/clinic/inventory/replenish');
  await expect(page.getByText(/please select a branch before managing inventory/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /replenish/i })).toBeDisabled();
});

test('submits explicit branchId and refreshes branch-scoped balances', async ({ page }) => {
  await page.goto('/clinic/inventory/replenish');
  await page.selectOption('select[name="productId"]', { index: 1 });
  await page.fill('input[name="quantity"]', '2');
  await page.fill('input[name="referenceId"]', 'PO-branch-1');
  await page.getByRole('button', { name: /replenish/i }).click();
  await expect(page.getByText(/stock replenished successfully/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web run test:e2e -- test/e2e/inventory-replenish.spec.ts`

Expected: FAIL because inventory pages still rely on server-side branch-less prefetching and replenish does not gate on missing branch or send explicit `branchId`.

- [ ] **Step 3: Write the minimal branch-aware UI implementation**

```ts
// apps/web/app/(clinic)/clinic/inventory/page.tsx
import InventoryClient from './inventory-client';
import type { ItemCategoryResponse } from '@petiatrics/types';

async function getCategories(): Promise<ItemCategoryResponse[]> {
  // unchanged branch-neutral fetch
}

export default async function InventoryPage() {
  const categories = await getCategories();
  return <InventoryClient initialItems={[]} lowStockItems={[]} categories={categories} />;
}
```

```ts
// apps/web/app/(clinic)/clinic/inventory/use-inventory-branch-data.ts
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import type { ItemSummaryResponse } from '@petiatrics/types';

export function useInventoryBranchData() {
  const activeBranch = useSessionStore((s) => s.activeBranch);
  const [items, setItems] = useState<ItemSummaryResponse[]>([]);
  const [lowStockItems, setLowStockItems] = useState<ItemSummaryResponse[]>([]);
  const [movements, setMovements] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const requestBranchId = activeBranch?.id;
    if (!requestBranchId) {
      setItems([]);
      setLowStockItems([]);
      setMovements([]);
      setError('Please select a branch before managing inventory.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      apiClient.get<{ items: ItemSummaryResponse[] }>('/inventory/products'),
      apiClient.get<ItemSummaryResponse[]>('/inventory/products/low-stock'),
    ])
      .then(([itemsResponse, lowStockResponse]) => {
        const currentBranchId = useSessionStore.getState().activeBranch?.id;
        if (cancelled || requestBranchId !== currentBranchId) return;
        setItems(itemsResponse.items ?? []);
        setLowStockItems(lowStockResponse ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load inventory.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeBranch?.id]);

  return { activeBranch, items, lowStockItems, movements, setMovements, loading, error };
}
```

```ts
// apps/web/app/(clinic)/clinic/inventory/replenish/page.tsx
const activeBranch = useSessionStore((s) => s.activeBranch);

async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (!activeBranch) {
    setError('Please select a branch before managing inventory.');
    return;
  }

  const requestBranchId = activeBranch.id;
  await apiClient.post('/inventory/stock/replenish', {
    branchId: requestBranchId,
    productId,
    quantity,
    referenceId,
  });

  if (requestBranchId !== useSessionStore.getState().activeBranch?.id) return;
  setSuccess('Stock replenished successfully.');
  await loadProducts();
}
```

```ts
// apps/web/lib/api-client.ts
export async function fetchPaginated<T>(path: string, params?: Record<string, string | number | undefined>, init?: RequestInit): Promise<PaginatedResponse<T>> {
  const branchHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const { useSessionStore } = await import('./session-store');
    const activeBranchId = useSessionStore.getState().activeBranch?.id;
    if (activeBranchId) branchHeaders['x-active-branch'] = activeBranchId;
  }

  const response = await fetch(url2, {
    ...init,
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...branchHeaders,
      ...(init?.headers ?? {}),
    },
  });

  return response.json() as Promise<PaginatedResponse<T>>;
}
```

- [ ] **Step 4: Run focused verification**

Run: `npm --prefix apps/web run test:e2e -- test/e2e/inventory-replenish.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(clinic)/clinic/inventory/page.tsx apps/web/app/(clinic)/clinic/inventory/use-inventory-branch-data.ts apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx apps/web/app/(clinic)/clinic/inventory/replenish/page.tsx apps/web/lib/api-client.ts apps/web/test/e2e/inventory-replenish.spec.ts
git commit -m "feat: bind inventory ui to active branch"
```

### Task 7: Add Branch-Scoped Workspace Regression Coverage

**Files:**
- Create: `apps/web/test/e2e/inventory-branch-scoping.spec.ts`
- Modify: `apps/web/test/e2e/inventory-workspace.spec.ts`
- Modify: `apps/api/src/modules/inventory/services/stock.service.spec.ts`
- Modify: `apps/api/src/modules/clinical/services/visit.service.spec.ts`
- Test: `apps/web/test/e2e/inventory-branch-scoping.spec.ts`
- Test: `apps/web/test/e2e/inventory-workspace.spec.ts`

- [ ] **Step 1: Write the failing regression tests**

```ts
// apps/web/test/e2e/inventory-branch-scoping.spec.ts
import { test, expect } from '@playwright/test';

test('switching branches changes visible stock for the same product', async ({ page, request }) => {
  await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);
  await page.goto('/clinic/inventory');

  await page.getByRole('button', { name: /select branch|main branch/i }).click();
  await page.getByRole('menuitem', { name: /main branch/i }).click();
  const mainRow = page.locator('tbody tr').filter({ hasText: 'Rabies Vaccine' }).first();
  const mainQuantity = await mainRow.locator('td').nth(4).textContent();

  await page.getByRole('button', { name: /main branch/i }).click();
  await page.getByRole('menuitem', { name: /branch 2/i }).click();
  const branchTwoRow = page.locator('tbody tr').filter({ hasText: 'Rabies Vaccine' }).first();
  const branchTwoQuantity = await branchTwoRow.locator('td').nth(4).textContent();

  expect(branchTwoQuantity).not.toBe(mainQuantity);
});

test('stock movements tab shows only the active branch history', async ({ page, request }) => {
  await loginViaApi(page, request, OWNER_EMAIL, OWNER_PASSWORD);
  await page.goto('/clinic/inventory');
  await page.getByRole('button', { name: /stock movements/i }).click();
  await expect(page.getByText(/branch-happypaws-main/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web run test:e2e -- test/e2e/inventory-branch-scoping.spec.ts test/e2e/inventory-workspace.spec.ts`

Expected: FAIL because branch changes do not yet reload all inventory surfaces and movement/history data is not asserted by branch.

- [ ] **Step 3: Write the minimal regression implementation and assertions**

```ts
// apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx
const { activeBranch, items, lowStockItems, movements, setMovements, loading, error } = useInventoryBranchData();

async function loadMovements(force = false) {
  const requestBranchId = activeBranch?.id;
  if (!requestBranchId) return;
  if (!force && movements.length > 0) return;

  setLoadingMovements(true);
  try {
    const data = await apiClient.get<unknown[]>('/inventory/stock/movements');
    if (requestBranchId !== useSessionStore.getState().activeBranch?.id) return;
    setMovements(data ?? []);
  } finally {
    setLoadingMovements(false);
  }
}

useEffect(() => {
  setMovements([]);
  if (activeTab === 'movements' && activeBranch?.id) {
    void loadMovements(true);
  }
}, [activeBranch?.id, activeTab, setMovements]);
```

```ts
// apps/web/test/e2e/inventory-workspace.spec.ts
test('low-stock banner changes when branch changes', async ({ page }) => {
  await page.goto('/clinic/inventory');
  const banner = page.getByText(/below reorder threshold/i);
  const before = await banner.textContent();

  await page.getByRole('button', { name: /main branch/i }).click();
  await page.getByRole('menuitem', { name: /branch 2/i }).click();

  await expect.poll(() => banner.textContent()).not.toBe(before);
});
```

- [ ] **Step 4: Run full focused verification**

Run: `npm --prefix apps/api test -- src/modules/inventory/services/stock.service.spec.ts src/modules/clinical/services/visit.service.spec.ts --runInBand`
Expected: PASS

Run: `npm --prefix apps/web run test:e2e -- test/e2e/inventory-replenish.spec.ts test/e2e/inventory-branch-scoping.spec.ts test/e2e/inventory-workspace.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/e2e/inventory-branch-scoping.spec.ts apps/web/test/e2e/inventory-workspace.spec.ts apps/web/app/(clinic)/clinic/inventory/inventory-client.tsx apps/api/src/modules/inventory/services/stock.service.spec.ts apps/api/src/modules/clinical/services/visit.service.spec.ts
git commit -m "test: cover branch-scoped inventory regressions"
```

## Final Verification Checklist

Run these after Task 7 before merging:

```bash
npx prisma validate --schema packages/database/prisma/schema.prisma
npm --prefix apps/api test -- --runInBand
npm --prefix apps/api run lint
npm --prefix apps/web run test:e2e -- test/e2e/inventory-replenish.spec.ts test/e2e/inventory-branch-scoping.spec.ts test/e2e/inventory-workspace.spec.ts
npm --prefix apps/web run build
```

Expected:

- Prisma schema validates.
- API Jest suite passes for touched modules.
- API typecheck passes.
- Inventory Playwright coverage passes.
- Web production build passes.

## Spec Coverage Notes

This plan covers:

- `BranchStockBalance` as branch stock source of truth.
- `StockMovement.branchId` and compensation `idempotencyKey`.
- Active branch enforcement on replenish, movements, list, and low-stock.
- Explicit `branchId` payload validation on replenish.
- Branch-scoped product list quantities and low-stock semantics.
- Synchronous visit deduction using persisted `visit.branchId`.
- Event contract updates for `VisitFinalizedEvent` and `LowStockEvent`.
- Frontend branch gating, stale-response protection, and branch-aware refreshes.
- Regression tests for branch switch behavior and visit-based deduct flow.

Plan complete and saved to `docs/superpowers/plans/2026-05-17-branch-scoped-inventory.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**