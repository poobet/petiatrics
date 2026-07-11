-- CreateEnum
CREATE TYPE "DefaultVatType" AS ENUM ('VAT_7', 'VAT_EXEMPT', 'NON_VAT');

-- CreateEnum
CREATE TYPE "WhtRate" AS ENUM ('WHT_0', 'WHT_1', 'WHT_3');

-- CreateEnum
CREATE TYPE "DispensingCategory" AS ENUM ('General_Retail', 'Household_Remedy', 'Dangerous_Drug', 'Specially_Controlled_Drug', 'Clinic_Use_Only');

-- AlterEnum: Rename STOCKED_GOOD -> INVENTORY and add CONSUMABLE
BEGIN;
CREATE TYPE "ItemType_new" AS ENUM ('INVENTORY', 'SERVICE', 'CONSUMABLE');
ALTER TABLE "public"."products" ALTER COLUMN "itemType" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "itemType" TYPE "ItemType_new" USING ("itemType"::text::"ItemType_new");
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
ALTER TYPE "ItemType_new" RENAME TO "ItemType";
DROP TYPE "public"."ItemType_old";
ALTER TABLE "products" ALTER COLUMN "itemType" SET DEFAULT 'INVENTORY';
COMMIT;

-- AlterTable: invoice_line_items — add per-line VAT fields
ALTER TABLE "invoice_line_items"
  ADD COLUMN "vatRateBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "vatTotalMinor" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: invoices — make visitId/patientId/ownerUserId nullable for OTC checkouts
ALTER TABLE "invoices"
  ALTER COLUMN "visitId" DROP NOT NULL,
  ALTER COLUMN "patientId" DROP NOT NULL,
  ALTER COLUMN "ownerUserId" DROP NOT NULL;

-- AlterTable: products — add compliance, tax, and GL account fields
ALTER TABLE "products"
  ADD COLUMN "cogsAccountId" TEXT,
  ADD COLUMN "defaultVatType" "DefaultVatType" NOT NULL DEFAULT 'VAT_7',
  ADD COLUMN "dispensingCategory" "DispensingCategory" NOT NULL DEFAULT 'General_Retail',
  ADD COLUMN "inventoryAssetAccountId" TEXT,
  ADD COLUMN "revenueAccountId" TEXT,
  ADD COLUMN "whtRate" "WhtRate" NOT NULL DEFAULT 'WHT_0',
  ALTER COLUMN "itemType" SET DEFAULT 'INVENTORY';

-- AlterTable: users — add supervisor PIN hash
ALTER TABLE "users"
  ADD COLUMN "pinHash" TEXT;

-- CreateTable: product_branch_settings
CREATE TABLE "product_branch_settings" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "retailPrice" DECIMAL(14,4) NOT NULL,
    "movingAverageCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_branch_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: clinic_role_permissions
CREATE TABLE "clinic_role_permissions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clinic_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_branch_settings_branchId_idx" ON "product_branch_settings"("branchId");
CREATE UNIQUE INDEX "product_branch_settings_productId_branchId_key" ON "product_branch_settings"("productId", "branchId");
CREATE UNIQUE INDEX "clinic_role_permissions_clinicId_role_key" ON "clinic_role_permissions"("clinicId", "role");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_cogsAccountId_fkey" FOREIGN KEY ("cogsAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_inventoryAssetAccountId_fkey" FOREIGN KEY ("inventoryAssetAccountId") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_branch_settings" ADD CONSTRAINT "product_branch_settings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_branch_settings" ADD CONSTRAINT "product_branch_settings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_role_permissions" ADD CONSTRAINT "clinic_role_permissions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
