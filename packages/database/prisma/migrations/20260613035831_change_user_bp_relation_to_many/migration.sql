/*
  Warnings:

  - You are about to drop the column `businessPartnerId` on the `users` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CUSTOMER';

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_businessPartnerId_fkey";

-- DropIndex
DROP INDEX "users_businessPartnerId_key";

-- AlterTable
ALTER TABLE "business_partners" ADD COLUMN     "linkedUserId" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "businessPartnerId";

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "business_partners_clinicId_linkedUserId_key" ON "business_partners"("clinicId", "linkedUserId");

