/*
  Warnings:

  - You are about to drop the `clinic_item_sequences` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_INVOICE', 'SUPPLIER_PAYMENT', 'CUSTOMER_INVOICE', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "ResetInterval" AS ENUM ('YEARLY', 'MONTHLY', 'DAILY', 'NEVER');

-- DropForeignKey
ALTER TABLE "clinic_item_sequences" DROP CONSTRAINT "clinic_item_sequences_clinicId_fkey";

-- DropTable
DROP TABLE "clinic_item_sequences";

-- CreateTable
CREATE TABLE "document_sequence_configs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "template" TEXT NOT NULL,
    "resetInterval" "ResetInterval" NOT NULL DEFAULT 'YEARLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequence_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "period" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_sequence_configs_clinicId_idx" ON "document_sequence_configs"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequence_configs_clinicId_documentType_key" ON "document_sequence_configs"("clinicId", "documentType");

-- CreateIndex
CREATE INDEX "document_sequences_clinicId_idx" ON "document_sequences"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_clinicId_documentType_period_key" ON "document_sequences"("clinicId", "documentType", "period");

-- AddForeignKey
ALTER TABLE "document_sequence_configs" ADD CONSTRAINT "document_sequence_configs_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
