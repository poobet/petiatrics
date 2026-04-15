/*
  Warnings:

  - You are about to drop the column `whtRate` on the `bp_vets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bp_vets" DROP COLUMN "whtRate";

-- AlterTable
ALTER TABLE "tax_codes" ADD COLUMN     "isZeroRated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'VAT';
