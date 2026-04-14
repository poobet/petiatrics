-- Add new enum values for ClinicStatus and UserStatus.
-- These must be committed in their own migration before being used
-- as DEFAULT values in the next migration (PostgreSQL restriction).

ALTER TYPE "ClinicStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ClinicStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING';
