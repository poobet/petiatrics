# Data Model: Petiatrics Full Platform

## Overview

The platform uses relational storage for operational and financial data, document storage for clinical and audit records, and Redis for session and short-lived auth state. Every clinic-scoped aggregate must carry `clinic_id` and must only be accessed through server-side tenant-filtered repositories.

## Relational Aggregates (PostgreSQL)

### Clinic

- Purpose: tenant root for all clinic-scoped operational data.
- Fields:
  - `id` UUID
  - `name` string
  - `tax_id` string
  - `address` JSON or structured columns
  - `subscription_tier` enum: `free | standard | premium`
  - `status` enum: `active | suspended | archived`
  - `settings` JSONB
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - has many `users`
  - has many `appointments`
  - has many `products`
  - has many `stock_movements`
  - has many `invoices`
- Validation rules:
  - `tax_id` unique per clinic business registration
  - `settings` must hold only supported security and clinic options

### User

- Purpose: authenticated actor for platform admins, clinic staff, and pet owners.
- Fields:
  - `id` UUID
  - `clinic_id` UUID nullable for platform admins
  - `email` string unique
  - `password_hash` string
  - `role` enum: `platform_admin | clinic_manager | veterinarian | receptionist | cashier | pet_owner`
  - `status` enum: `invited | active | inactive | locked`
  - `invited_by` UUID nullable
  - `failed_login_attempts` integer
  - `locked_until` timestamp nullable
  - `preferred_locale` enum: `th | en`
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to zero or one `clinic`
  - can own many `pet_profiles`
  - can author many `appointments`, `visit_records`, `stock_movements`, and `audit_logs`
- Validation rules:
  - `email` globally unique in Phase 0
  - lockout counters reset on successful login

### Appointment

- Purpose: scheduled clinic interaction between pet owner, patient, and clinic staff.
- Fields:
  - `id` UUID
  - `clinic_id` UUID
  - `patient_id` ObjectId or foreign reference key to pet profile
  - `owner_user_id` UUID
  - `vet_user_id` UUID nullable until assignment
  - `requested_at` timestamp
  - `scheduled_at` timestamp (UTC)
  - `duration_minutes` integer
  - `reason` text
  - `status` enum: `requested | confirmed | in_progress | completed | cancelled`
  - `cancellation_reason` text nullable
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to `clinic`
  - references `user` as owner and optionally veterinarian
  - links to one optional `visit_record`
- Validation rules:
  - `duration_minutes > 0`
  - no overlapping confirmed/in-progress/completed ranges for the same veterinarian
- State transitions:
  - `requested -> confirmed | cancelled`
  - `confirmed -> in_progress | cancelled`
  - `in_progress -> completed`

### Product

- Purpose: inventory catalog entry for medications and supplies.
- Fields:
  - `id` UUID
  - `clinic_id` UUID
  - `name` string
  - `sku` string
  - `category` enum or lookup
  - `unit` string
  - `quantity` decimal or integer
  - `reorder_threshold` decimal or integer
  - `is_active` boolean
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to `clinic`
  - has many `stock_movements`
- Validation rules:
  - `sku` unique per clinic
  - `quantity >= 0` unless explicit negative-stock policy is later introduced

### StockMovement

- Purpose: immutable ledger of inventory changes.
- Fields:
  - `id` UUID
  - `clinic_id` UUID
  - `product_id` UUID
  - `delta` numeric
  - `quantity_before` numeric
  - `quantity_after` numeric
  - `reason` enum: `dispense | replenish | manual_adjustment`
  - `reference_type` enum: `visit_record | replenishment | manual`
  - `reference_id` string
  - `actor_id` UUID
  - `created_at` timestamp
- Relationships:
  - belongs to `product`
  - belongs to `clinic`
  - belongs to `user` as actor

### Invoice

- Purpose: billable financial document generated from a finalized visit.
- Fields:
  - `id` UUID
  - `clinic_id` UUID
  - `visit_id` string
  - `patient_id` string
  - `owner_user_id` UUID
  - `subtotal_minor` integer
  - `tax_rate_bps` integer
  - `tax_total_minor` integer
  - `total_minor` integer
  - `status` enum: `draft | issued | paid | voided`
  - `issued_at` timestamp nullable
  - `paid_at` timestamp nullable
  - `voided_at` timestamp nullable
  - `void_reason` text nullable
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to `clinic`
  - references one `visit_record`
  - has many `invoice_line_items`
- Validation rules:
  - totals must be derived from line items, not manually entered
- State transitions:
  - `draft -> issued | voided`
  - `issued -> paid | voided`

### InvoiceLineItem

- Purpose: individual billable service or dispensed product row.
- Fields:
  - `id` UUID
  - `invoice_id` UUID
  - `item_type` enum: `service | product`
  - `description` string
  - `quantity` numeric
  - `unit_price_minor` integer
  - `subtotal_minor` integer
  - `source_reference_id` string nullable

## Document Aggregates (MongoDB)

### PetProfile

- Purpose: primary patient identity and pet-specific attributes.
- Fields:
  - `_id` ObjectId
  - `clinic_id` UUID
  - `owner_user_id` UUID
  - `name` string
  - `species` string
  - `breed` string
  - `date_of_birth` date nullable
  - `weight_kg` decimal nullable
  - `photo_url` string nullable
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to one clinic
  - belongs to one pet owner in Phase 0
  - has many `visit_records`
  - has many `vaccination_records`

### VisitRecord

- Purpose: clinical record of an appointment or encounter.
- Fields:
  - `_id` ObjectId
  - `clinic_id` UUID
  - `patient_id` ObjectId
  - `appointment_id` UUID nullable
  - `vet_id` UUID
  - `visit_date` timestamp
  - `soap.subjective` text
  - `soap.objective` text
  - `soap.assessment` text
  - `soap.plan` text
  - `prescriptions[]`
    - `drug` string
    - `dosage` string
    - `frequency` string
    - `duration` string
    - `product_id` UUID nullable
    - `inventory_linked` boolean
  - `attachments[]`
    - `type` enum: `lab_result | imaging | file`
    - `url` string
  - `status` enum: `draft | finalized | amended`
  - `finalized_at` timestamp nullable
  - `amended_at` timestamp nullable
  - `amended_by` UUID nullable
  - `amendment_reason` text nullable
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to `pet_profile`
  - references one `user` as veterinarian
  - may generate one `invoice`
- Validation rules:
  - amendment reason required when `status = amended`
  - only vets edit draft/finalized-within-window; only manager can amend after 24h
- State transitions:
  - `draft -> finalized`
  - `finalized -> amended`

### VaccinationRecord

- Purpose: immunization history tied to a patient.
- Fields:
  - `_id` ObjectId
  - `clinic_id` UUID
  - `patient_id` ObjectId
  - `vaccine_name` string
  - `administered_at` timestamp
  - `next_due_at` timestamp nullable
  - `batch_number` string nullable
  - `vet_id` UUID

### AuditLog

- Purpose: immutable record of write-side mutations.
- Fields:
  - `_id` ObjectId
  - `clinic_id` UUID nullable for platform-level entries
  - `entity_type` string
  - `entity_id` string
  - `operation` enum: `create | update | delete | void | amend | status_change`
  - `actor_id` UUID
  - `actor_role` string
  - `timestamp` timestamp
  - `before_state` object nullable
  - `after_state` object nullable
  - `metadata` object nullable
- Validation rules:
  - append-only
  - cannot be modified or deleted by application workflows

## Redis Structures

### Session Context

- Key: `session:{session_id}`
- Value:
  - `user_id`
  - `clinic_id`
  - `role`
  - `preferred_locale`
  - `expires_at`

### Login Lockout State

- Key: `auth:lockout:{user_id}` or embedded in relational user record with cache mirror
- Value:
  - `failed_attempts`
  - `locked_until`

## Cross-Store Integrity Rules

- `clinic_id` is mandatory on all clinic-scoped rows and documents.
- Visit finalization is the business event that unlocks invoice draft creation.
- Inventory deduction occurs only when prescription items resolve to an existing product.
- Audit log writes must succeed for committed mutations; if audit persistence fails, the mutation is treated as failed or retried via a guaranteed outbox path during implementation.