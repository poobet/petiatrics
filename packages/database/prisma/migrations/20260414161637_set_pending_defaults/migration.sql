-- Set column defaults using the newly committed enum values.
-- Must run after 20260414161635_add_pending_enum_values.

ALTER TABLE "clinics" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';
