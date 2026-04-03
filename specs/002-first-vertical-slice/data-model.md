# Data Model: First Vertical Slice

## Overview

This slice uses PostgreSQL for the clinic, branch, user, and branch-membership model, plus Redis for the authenticated session record. MongoDB remains part of the broader platform infrastructure but is not a primary data store for the scope of this slice. The key design rule is that clinic and branch context are never trusted from client payloads; they are derived from the authenticated session and validated branch membership.

## Relational Aggregates (PostgreSQL)

### Clinic

- Purpose: Tenant root for all clinic-scoped users and branches.
- Fields:
  - `id` UUID
  - `name` string
  - `status` enum or string constrained to active/suspended
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - has many `branches`
  - has many `users`
- Validation rules:
  - clinic status must be checked during login; suspended clinics cannot authenticate staff

### Branch

- Purpose: Physical or operational clinic location that scopes transactional work.
- Fields:
  - `id` UUID
  - `clinic_id` UUID
  - `name` string
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to one `clinic`
  - has many `user_branch` memberships
- Validation rules:
  - every branch belongs to exactly one clinic
  - a branch referenced in a session must belong to the same clinic as the user

### User

- Purpose: Authenticated clinic staff or platform administrator.
- Fields:
  - `id` UUID
  - `clinic_id` UUID nullable for `SUPER_ADMIN`
  - `email` string unique
  - `password_hash` string
  - `role` enum: `SUPER_ADMIN | CLINIC_OWNER | VET | ASSISTANT | CASHIER | STAFF`
  - `status` enum aligned to existing repository auth lifecycle (`ACTIVE`, `INACTIVE`, optional future `LOCKED`)
  - `preferred_locale` enum/string
  - `created_at` timestamp
  - `updated_at` timestamp
- Relationships:
  - belongs to zero or one `clinic`
  - has many `user_branch` memberships
- Validation rules:
  - `SUPER_ADMIN` may have `clinic_id = null` and no branch memberships
  - all clinic-scoped users must belong to exactly one clinic
  - clinic-scoped users must have at least one authorized branch membership
  - passwords must be stored only as bcrypt hashes

### UserBranch

- Purpose: Join table that defines which branches a clinic user is authorized to access.
- Fields:
  - `user_id` UUID
  - `branch_id` UUID
- Relationships:
  - belongs to one `user`
  - belongs to one `branch`
- Validation rules:
  - composite primary key on (`user_id`, `branch_id`)
  - membership rows are only valid when `user.clinic_id = branch.clinic_id`

## Session and Request Context (Redis / In-Memory)

### SessionContext

- Purpose: Server-side authenticated context stored in Redis and keyed by session ID.
- Fields:
  - `userId` string
  - `clinicId` string or null
  - `role` role enum
  - `email` string
  - `preferredLocale` locale
  - `clinicName` string nullable for `SUPER_ADMIN`
  - `authorizedBranches` array of branch summaries
    - `id` string
    - `name` string
- Validation rules:
  - `authorizedBranches` must be empty for `SUPER_ADMIN`
  - all `authorizedBranches` entries must belong to `clinicId`
  - session TTL is 24 hours, refreshed on valid authenticated use
- State transitions:
  - `created` on successful login
  - `refreshed` on each authenticated request
  - `deleted` on logout
  - `expired` automatically by Redis TTL

### TenantRequestContext

- Purpose: Per-request context injected by guards for downstream controller/service logic.
- Fields:
  - `clinicId` string or null
  - `activeBranchId` string or null
  - `userId` string
  - `role` role enum
- Validation rules:
  - `clinicId` is always sourced from the session, never the request body
  - `activeBranchId` must match one of the authorized branch IDs in the session for routes that require branch context

## Web Application State

### AuthProfile

- Purpose: Client-safe user payload returned by `/auth/login` and `/auth/me` to hydrate the web app.
- Fields:
  - `id` string
  - `email` string
  - `role` role enum
  - `clinicName` string nullable for `SUPER_ADMIN`
  - `branches` array of branch summaries
- Validation rules:
  - contains no secret fields and no raw session token

### ActiveBranchState

- Purpose: Zustand-backed client state that drives navigation, placeholder dashboard display, and automatic request header injection.
- Fields:
  - `user` auth profile or null
  - `authorizedBranches` array of branch summaries
  - `activeBranch` branch summary or null
- State transitions:
  - on login: state is hydrated from the login response
  - on single-branch login: `activeBranch` auto-selects the only branch
  - on multi-branch login: `activeBranch` defaults to the first authorized branch unless a valid saved preference exists
  - on branch switch: `activeBranch` changes immediately
  - on logout or `401`: state is fully cleared
