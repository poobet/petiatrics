/*
  Warnings:

  - Changed the type of `documentType` on the `document_sequence_configs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `documentType` on the `document_sequences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "document_sequence_configs" DROP COLUMN "documentType",
ADD COLUMN     "documentType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "document_sequences" DROP COLUMN "documentType",
ADD COLUMN     "documentType" TEXT NOT NULL;

-- DropEnum
DROP TYPE "DocumentType";

-- CreateTable
CREATE TABLE "document_type_definitions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "defaultTemplate" TEXT NOT NULL,
    "defaultResetInterval" "ResetInterval" NOT NULL DEFAULT 'YEARLY',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_type_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_type_definitions_clinicId_idx" ON "document_type_definitions"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_definitions_clinicId_code_key" ON "document_type_definitions"("clinicId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequence_configs_clinicId_documentType_key" ON "document_sequence_configs"("clinicId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_clinicId_documentType_period_key" ON "document_sequences"("clinicId", "documentType", "period");

-- AddForeignKey
ALTER TABLE "document_type_definitions" ADD CONSTRAINT "document_type_definitions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
