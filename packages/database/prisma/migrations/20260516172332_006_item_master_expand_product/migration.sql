/*
  Warnings:

  - You are about to drop the column `category` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `products` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clinicId,code]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('STOCKED_GOOD', 'SERVICE');

-- DropIndex
DROP INDEX "products_clinicId_category_idx";

-- DropIndex
DROP INDEX "products_clinicId_sku_key";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "category",
DROP COLUMN "sku",
DROP COLUMN "unit",
ADD COLUMN     "baseSellingPrice" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN     "baseUnitId" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "defaultDoctorFee" DECIMAL(14,4),
ADD COLUMN     "defaultSupplierId" TEXT,
ADD COLUMN     "defaultTaxCodeId" TEXT,
ADD COLUMN     "genericName" TEXT,
ADD COLUMN     "isControlledSubstance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTaxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemType" "ItemType" NOT NULL DEFAULT 'STOCKED_GOOD',
ADD COLUMN     "requiresBatchAndExpiryTracking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "standardCost" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "item_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "revenueGlCode" TEXT,
    "expenseGlCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_unit_conversions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "ratioToBase" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_name_key" ON "item_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_code_key" ON "item_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_name_key" ON "units_of_measure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_symbol_key" ON "units_of_measure"("symbol");

-- CreateIndex
CREATE INDEX "item_unit_conversions_productId_idx" ON "item_unit_conversions"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "item_unit_conversions_productId_unitId_key" ON "item_unit_conversions"("productId", "unitId");

-- CreateIndex
CREATE INDEX "products_clinicId_itemType_idx" ON "products"("clinicId", "itemType");

-- CreateIndex
CREATE INDEX "products_clinicId_categoryId_idx" ON "products"("clinicId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "products_clinicId_code_key" ON "products"("clinicId", "code");

-- AddForeignKey
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_defaultTaxCodeId_fkey" FOREIGN KEY ("defaultTaxCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
