/*
  Warnings:

  - A unique constraint covering the columns `[clinicId,branchId,productId,lotNumber]` on the table `branch_stock_balances` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clinicId,idempotencyKey]` on the table `stock_movements` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StockMovementStatus" AS ENUM ('COMMITTED', 'PENDING_APPROVAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockAlertType" AS ENUM ('LOW_STOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementReason" ADD VALUE 'GOODS_RECEIPT';
ALTER TYPE "StockMovementReason" ADD VALUE 'GOODS_ISSUE';

-- DropIndex
DROP INDEX "branch_stock_balances_clinicId_branchId_productId_key";

-- AlterTable
ALTER TABLE "branch_stock_balances" ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "status" "StockMovementStatus" NOT NULL DEFAULT 'COMMITTED';

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "alertType" "StockAlertType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_alerts_clinicId_isActive_idx" ON "stock_alerts"("clinicId", "isActive");

-- CreateIndex
CREATE INDEX "stock_alerts_clinicId_branchId_isActive_idx" ON "stock_alerts"("clinicId", "branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "stock_alerts_clinicId_branchId_productId_alertType_key" ON "stock_alerts"("clinicId", "branchId", "productId", "alertType");

-- CreateIndex
CREATE INDEX "branch_stock_balances_clinicId_productId_idx" ON "branch_stock_balances"("clinicId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_stock_balances_clinicId_branchId_productId_lotNumber_key" ON "branch_stock_balances"("clinicId", "branchId", "productId", "lotNumber");

-- CreateIndex
CREATE INDEX "stock_movements_clinicId_status_idx" ON "stock_movements"("clinicId", "status");

-- Partial unique index: only one row per (clinicId, branchId, productId) when lotNumber IS NULL
CREATE UNIQUE INDEX "branch_stock_balance_null_lot_unique"
  ON "branch_stock_balances" ("clinicId", "branchId", "productId")
  WHERE "lotNumber" IS NULL;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
