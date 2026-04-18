-- AlterTable
ALTER TABLE "business_partners" ADD COLUMN     "bankAccountBranch" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "creditHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creditLimit" DOUBLE PRECISION,
ADD COLUMN     "discountGroupId" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "lineId" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "contact_positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_contacts" (
    "id" TEXT NOT NULL,
    "bpId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "lineId" TEXT,
    "positionId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_positions_name_key" ON "contact_positions"("name");

-- CreateIndex
CREATE INDEX "bp_contacts_bpId_idx" ON "bp_contacts"("bpId");

-- AddForeignKey
ALTER TABLE "bp_contacts" ADD CONSTRAINT "bp_contacts_bpId_fkey" FOREIGN KEY ("bpId") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_contacts" ADD CONSTRAINT "bp_contacts_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "contact_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
