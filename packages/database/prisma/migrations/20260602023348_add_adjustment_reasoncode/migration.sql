/*
  Warnings:

  - A unique constraint covering the columns `[clinicId,idempotencyKey]` on the table `stock_movements` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "reasonCode" TEXT;

