/*
  Warnings:

  - You are about to drop the column `creditTermDays` on the `bp_suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `taxId` on the `bp_suppliers` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BpRole" AS ENUM ('AR_SOLD_TO', 'AR_SHIP_TO', 'AR_INVOICE_TO', 'AR_PAY_BY', 'AP_BUY_FROM', 'AP_SHIP_FROM', 'AP_INVOICE_FROM', 'AP_PAY_TO');

-- AlterTable
ALTER TABLE "bp_suppliers" DROP COLUMN "creditTermDays",
DROP COLUMN "taxId",
ADD COLUMN     "vendorGroupId" TEXT;

-- AlterTable
ALTER TABLE "business_partners" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "branchCode" TEXT,
ADD COLUMN     "creditTermDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultVatCodeId" TEXT,
ADD COLUMN     "defaultWhtCodeId" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "isHeadOffice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentBpId" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "subDistrict" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "zipcode" TEXT;

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "isVatType" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_roles_active" (
    "bpId" TEXT NOT NULL,
    "role" "BpRole" NOT NULL,

    CONSTRAINT "bp_roles_active_pkey" PRIMARY KEY ("bpId","role")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_code_key" ON "tax_codes"("code");

-- CreateIndex
CREATE INDEX "tax_codes_isVatType_isActive_idx" ON "tax_codes"("isVatType", "isActive");

-- CreateIndex
CREATE INDEX "business_partners_clinicId_taxId_idx" ON "business_partners"("clinicId", "taxId");

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_parentBpId_fkey" FOREIGN KEY ("parentBpId") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_defaultVatCodeId_fkey" FOREIGN KEY ("defaultVatCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_defaultWhtCodeId_fkey" FOREIGN KEY ("defaultWhtCodeId") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_roles_active" ADD CONSTRAINT "bp_roles_active_bpId_fkey" FOREIGN KEY ("bpId") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
