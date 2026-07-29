-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DocumentModule" AS ENUM ('PROCUREMENT', 'BILLING', 'APPOINTMENT', 'INVENTORY', 'CLINICAL', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable: add module column if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='document_type_definitions' AND column_name='module'
  ) THEN
    ALTER TABLE "document_type_definitions" ADD COLUMN "module" "DocumentModule" NOT NULL DEFAULT 'GENERAL';
  END IF;
END $$;

-- CreateIndex (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='document_type_definitions' AND indexname='document_type_definitions_module_idx'
  ) THEN
    CREATE INDEX "document_type_definitions_module_idx" ON "document_type_definitions"("module");
  END IF;
END $$;
