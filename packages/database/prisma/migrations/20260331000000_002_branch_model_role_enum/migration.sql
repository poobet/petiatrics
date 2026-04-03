-- Migration: 002 Branch model + Role enum rename
-- Migrates Role enum from 001 values to 002 canonical values,
-- adds the Branch and UserBranch tables.

-- ─── Step 1: Add new Role enum values ─────────────────────────────────────────
-- PostgreSQL cannot drop enum values directly. We rename-via-new-type approach.

CREATE TYPE "Role_v2" AS ENUM ('SUPER_ADMIN', 'CLINIC_OWNER', 'VET', 'ASSISTANT', 'CASHIER', 'STAFF');

-- ─── Step 2: Migrate existing users to new role values ─────────────────────────

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role_v2"
  USING (
    CASE "role"::text
      WHEN 'PLATFORM_ADMIN' THEN 'SUPER_ADMIN'
      WHEN 'CLINIC_MANAGER' THEN 'CLINIC_OWNER'
      WHEN 'VETERINARIAN'   THEN 'VET'
      WHEN 'RECEPTIONIST'   THEN 'ASSISTANT'
      WHEN 'CASHIER'        THEN 'CASHIER'
      WHEN 'PET_OWNER'      THEN 'STAFF'
      ELSE 'STAFF'
    END
  )::"Role_v2";

-- ─── Step 3: Swap enum types ───────────────────────────────────────────────────

DROP TYPE "Role";
ALTER TYPE "Role_v2" RENAME TO "Role";

-- ─── Step 4: Create branches table ────────────────────────────────────────────

CREATE TABLE "branches" (
    "id"        TEXT NOT NULL,
    "clinicId"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- ─── Step 5: Create user_branches join table ───────────────────────────────────

CREATE TABLE "user_branches" (
    "userId"   TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "user_branches_pkey" PRIMARY KEY ("userId", "branchId")
);

-- ─── Step 6: Indexes and foreign keys ─────────────────────────────────────────

CREATE INDEX "branches_clinicId_idx" ON "branches"("clinicId");

ALTER TABLE "branches"
    ADD CONSTRAINT "branches_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_branches"
    ADD CONSTRAINT "user_branches_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_branches"
    ADD CONSTRAINT "user_branches_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
