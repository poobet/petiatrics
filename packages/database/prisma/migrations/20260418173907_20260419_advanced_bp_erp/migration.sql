/*
  Warnings:

  - You are about to drop the column `positionId` on the `bp_contacts` table. All the data in the column will be lost.
  - You are about to drop the `contact_positions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[clinicId,code]` on the table `business_partners` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "bp_contacts" DROP CONSTRAINT "bp_contacts_positionId_fkey";

-- AlterTable
ALTER TABLE "bp_contacts" DROP COLUMN "positionId",
ADD COLUMN     "position" TEXT;

-- AlterTable
ALTER TABLE "bp_vets" ADD COLUMN     "defaultDfRate" DECIMAL(5,2),
ADD COLUMN     "specialty" TEXT;

-- AlterTable
ALTER TABLE "business_partners" ADD COLUMN     "alertMessage" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "isMarketingOptIn" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "contact_positions";

-- CreateTable
CREATE TABLE "bp_groups" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bp_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bp_groups_clinicId_idx" ON "bp_groups"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "bp_groups_clinicId_prefix_key" ON "bp_groups"("clinicId", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "business_partners_clinicId_code_key" ON "business_partners"("clinicId", "code");

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "bp_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_groups" ADD CONSTRAINT "bp_groups_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
