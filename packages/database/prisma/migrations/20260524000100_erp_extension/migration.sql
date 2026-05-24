-- ─── Feature 1: GL Account Structure ────────────────────────────────────────

-- CreateEnum
CREATE TYPE "GLAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS');

-- CreateTable gl_accounts
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GLAccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex gl_accounts_code_key
CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");

-- AlterTable item_categories: add GL FK columns, drop old string columns
ALTER TABLE "item_categories" ADD COLUMN "revenueGlAccountId" TEXT;
ALTER TABLE "item_categories" ADD COLUMN "expenseGlAccountId" TEXT;
ALTER TABLE "item_categories" DROP COLUMN "revenueGlCode";
ALTER TABLE "item_categories" DROP COLUMN "expenseGlCode";

-- AddForeignKey item_categories → gl_accounts (revenue)
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_revenueGlAccountId_fkey"
    FOREIGN KEY ("revenueGlAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey item_categories → gl_accounts (expense)
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_expenseGlAccountId_fkey"
    FOREIGN KEY ("expenseGlAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Feature 2: SKU & Barcode ────────────────────────────────────────────────

-- CreateTable clinic_item_sequences
CREATE TABLE "clinic_item_sequences" (
    "clinicId" TEXT NOT NULL,
    "nextVal" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_item_sequences_pkey" PRIMARY KEY ("clinicId")
);

-- AddForeignKey clinic_item_sequences → clinics
ALTER TABLE "clinic_item_sequences" ADD CONSTRAINT "clinic_item_sequences_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable products: add sku, barcode
ALTER TABLE "products" ADD COLUMN "sku" TEXT;
ALTER TABLE "products" ADD COLUMN "barcode" TEXT;

-- CreateIndex products_barcode_key (nullable — PostgreSQL allows multiple NULLs in UNIQUE)
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex products_clinicId_sku_key (composite unique; NULLs are distinct)
CREATE UNIQUE INDEX "products_clinicId_sku_key" ON "products"("clinicId", "sku");

-- ─── Feature 3: Reorder Point & Minimum Stock ────────────────────────────────

-- Rename reorderThreshold → reorderPoint
ALTER TABLE "products" RENAME COLUMN "reorderThreshold" TO "reorderPoint";

-- Add minimumStock column
ALTER TABLE "products" ADD COLUMN "minimumStock" DECIMAL(10,3) NOT NULL DEFAULT 0;
