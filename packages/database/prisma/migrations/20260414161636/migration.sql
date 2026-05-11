/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `clinics` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[businessPartnerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `clinics` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BpType" AS ENUM ('CUSTOMER', 'STAFF', 'VET', 'SUPPLIER', 'OTHER');

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "businessPartnerId" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "business_partners" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "type" "BpType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_vets" (
    "bpId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "whtRate" DECIMAL(5,2) NOT NULL DEFAULT 3.00,

    CONSTRAINT "bp_vets_pkey" PRIMARY KEY ("bpId")
);

-- CreateTable
CREATE TABLE "bp_suppliers" (
    "bpId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "creditTermDays" INTEGER NOT NULL,

    CONSTRAINT "bp_suppliers_pkey" PRIMARY KEY ("bpId")
);

-- CreateIndex
CREATE INDEX "business_partners_clinicId_idx" ON "business_partners"("clinicId");

-- CreateIndex
CREATE INDEX "business_partners_clinicId_isActive_idx" ON "business_partners"("clinicId", "isActive");

-- CreateIndex
CREATE INDEX "business_partners_clinicId_type_isActive_idx" ON "business_partners"("clinicId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "bp_vets_licenseNumber_key" ON "bp_vets"("licenseNumber");

-- CreateIndex
CREATE INDEX "appointments_clinicId_status_idx" ON "appointments"("clinicId", "status");

-- CreateIndex
CREATE INDEX "appointments_clinicId_scheduledAt_idx" ON "appointments"("clinicId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");

-- CreateIndex
CREATE INDEX "invoices_clinicId_status_idx" ON "invoices"("clinicId", "status");

-- CreateIndex
CREATE INDEX "invoices_clinicId_status_createdAt_idx" ON "invoices"("clinicId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "products_clinicId_name_idx" ON "products"("clinicId", "name");

-- CreateIndex
CREATE INDEX "products_clinicId_category_idx" ON "products"("clinicId", "category");

-- CreateIndex
CREATE INDEX "products_clinicId_isActive_idx" ON "products"("clinicId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "users_businessPartnerId_key" ON "users"("businessPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_businessPartnerId_fkey" FOREIGN KEY ("businessPartnerId") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_vets" ADD CONSTRAINT "bp_vets_bpId_fkey" FOREIGN KEY ("bpId") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_suppliers" ADD CONSTRAINT "bp_suppliers_bpId_fkey" FOREIGN KEY ("bpId") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
