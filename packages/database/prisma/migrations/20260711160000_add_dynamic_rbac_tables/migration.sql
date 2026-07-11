-- ─── Schema Drift Fixes ────────────────────────────────────────────────────
-- These columns exist in schema.prisma but were missing from earlier migrations.
-- Safe to run multiple times due to IF NOT EXISTS guards.

-- Branch.code (missing from initial schema)
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL DEFAULT '';

-- Idempotency key index on stock_movements (missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='idempotencyKey') THEN
    ALTER TABLE "stock_movements" ADD COLUMN "idempotencyKey" TEXT;
  END IF;
END $$;

-- ─── New Tables ─────────────────────────────────────────────────────────────

CREATE TABLE "page_masters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_masters" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_roles" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDeletable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_role_permissions_v2" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "actionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_role_permissions_v2_pkey" PRIMARY KEY ("id")
);

-- CreateEnum (if not exists — may already exist from sequencing migration)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SequenceScope') THEN
    CREATE TYPE "SequenceScope" AS ENUM ('CLINIC', 'BRANCH');
  END IF;
END $$;

-- AlterTable — Add missing scope column to document_type_definitions (schema drift fix)
ALTER TABLE "document_type_definitions"
  ADD COLUMN IF NOT EXISTS "scope" "SequenceScope" NOT NULL DEFAULT 'CLINIC';

-- AlterTable — Add missing scope column to document_sequence_configs (schema drift fix)
ALTER TABLE "document_sequence_configs"
  ADD COLUMN IF NOT EXISTS "scope" "SequenceScope" NOT NULL DEFAULT 'CLINIC';

-- AlterTable — Add branchId default for document_sequences (schema drift fix)
ALTER TABLE "document_sequences"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT NOT NULL DEFAULT 'CLINIC';

-- AlterTable — Add missing unique index on document_sequences
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'document_sequences_clinicId_branchId_documentType_period_key') THEN
    CREATE UNIQUE INDEX "document_sequences_clinicId_branchId_documentType_period_key"
      ON "document_sequences"("clinicId", "branchId", "documentType", "period");
  END IF;
END $$;

-- Add missing unique index on stock_movements idempotencyKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'stock_movements_clinicId_idempotencyKey_key') THEN
    CREATE UNIQUE INDEX "stock_movements_clinicId_idempotencyKey_key"
      ON "stock_movements"("clinicId", "idempotencyKey");
  END IF;
END $$;

-- AlterTable users — add roleId and systemRole
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roleId" TEXT,
                   ADD COLUMN IF NOT EXISTS "systemRole" TEXT;


-- CreateIndex
CREATE UNIQUE INDEX "page_masters_code_key" ON "page_masters"("code");

-- CreateIndex
CREATE INDEX "action_masters_pageId_idx" ON "action_masters"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "action_masters_code_key" ON "action_masters"("code");

-- CreateIndex
CREATE INDEX "clinic_roles_clinicId_idx" ON "clinic_roles"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_roles_clinicId_code_key" ON "clinic_roles"("clinicId", "code");

-- CreateIndex
CREATE INDEX "clinic_role_permissions_v2_roleId_idx" ON "clinic_role_permissions_v2"("roleId");

-- CreateIndex
CREATE INDEX "clinic_role_permissions_v2_pageId_idx" ON "clinic_role_permissions_v2"("pageId");

-- CreateIndex
CREATE INDEX "clinic_role_permissions_v2_actionId_idx" ON "clinic_role_permissions_v2"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_role_permissions_v2_roleId_pageId_actionId_key" ON "clinic_role_permissions_v2"("roleId", "pageId", "actionId");

-- AddForeignKey
ALTER TABLE "action_masters" ADD CONSTRAINT "action_masters_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "page_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_roles" ADD CONSTRAINT "clinic_roles_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "clinic_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_role_permissions_v2" ADD CONSTRAINT "clinic_role_permissions_v2_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "clinic_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_role_permissions_v2" ADD CONSTRAINT "clinic_role_permissions_v2_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "page_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_role_permissions_v2" ADD CONSTRAINT "clinic_role_permissions_v2_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "action_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
