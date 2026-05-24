-- CreateTable: branch_stock_balances
CREATE TABLE "branch_stock_balances" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_stock_balances_pkey" PRIMARY KEY ("id")
);

-- AddColumns: stock_movements
ALTER TABLE "stock_movements"
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex: branch_stock_balances
CREATE UNIQUE INDEX "branch_stock_balances_clinicId_branchId_productId_key"
  ON "branch_stock_balances"("clinicId", "branchId", "productId");

CREATE INDEX "branch_stock_balances_clinicId_branchId_idx"
  ON "branch_stock_balances"("clinicId", "branchId");

CREATE INDEX "branch_stock_balances_productId_idx"
  ON "branch_stock_balances"("productId");

-- CreateIndex: stock_movements idempotency (partial — only when key is set)
CREATE UNIQUE INDEX "stock_movements_clinicId_idempotencyKey_key"
  ON "stock_movements"("clinicId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX "stock_movements_clinicId_branchId_createdAt_idx"
  ON "stock_movements"("clinicId", "branchId", "createdAt");

-- AddForeignKey: branch_stock_balances
ALTER TABLE "branch_stock_balances"
  ADD CONSTRAINT "branch_stock_balances_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "branch_stock_balances"
  ADD CONSTRAINT "branch_stock_balances_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "branch_stock_balances"
  ADD CONSTRAINT "branch_stock_balances_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: stock_movements.branchId
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: seed one balance row per (main branch, product) from Product.quantity
-- Uses the oldest branch per clinic as "main branch".
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

-- Backfill: stamp existing stock_movements with the main branch
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
