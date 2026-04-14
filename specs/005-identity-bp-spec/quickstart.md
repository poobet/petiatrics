# Quickstart: Identity & Business Partner Architecture

## Prerequisites

- Node.js 20+
- PostgreSQL and Redis available locally or via Docker
- Working branch: `005-identity-bp-spec`

```bash
git checkout 005-identity-bp-spec
```

---

## 1. Install dependencies

From the repo root:

```bash
npm install
```

---

## 2. Apply the Prisma migration

This feature adds the Business Partner tables and optional user linkage.

```bash
npm run db:migrate
npm run db:generate
```

If you need to run Prisma directly while iterating:

```bash
cd packages/database
npx prisma migrate dev --name 005-identity-business-partners
npx prisma generate
```

---

## 3. Start the applications

From the repo root:

```bash
npm run dev
```

Expected apps:

- web: `http://localhost:3000`
- api: NestJS default local port for this repo configuration

---

## 4. Verify login and branch context manually

1. Log in with an existing clinic user
2. Confirm the web app hydrates the session and, for multi-branch users, exposes an active branch selector
3. Confirm authenticated API requests include `x-active-branch`
4. Confirm requests without that header are rejected on BP routes

---

## 5. Verify Business Partner management manually

1. Log in as `SUPER_ADMIN`, `CLINIC_OWNER`, or `STAFF`
2. Open `/clinic/business-partners`
3. Create a Customer BP with no linked user account
4. Create a Vet BP with license number and withholding rate
5. Create a Supplier BP with tax ID and credit terms
6. Edit an existing BP and confirm extension fields persist
7. Soft-delete a BP and confirm it disappears from active list views but remains retrievable by direct management/detail query

Expected results:

- create/edit succeeds for `SUPER_ADMIN`, `CLINIC_OWNER`, and `STAFF`
- read-only roles cannot mutate BP records
- active list views exclude inactive BPs

---

## 6. Verify session expiry behaviour manually

1. Log in and stay active with periodic authenticated requests
2. Confirm the session is still valid within the 12-hour absolute window
3. Leave the session idle for over 1 hour
4. Confirm the next protected request returns `401` and the web client clears the session

---

## 7. Run the test suites

### API

```bash
npm --prefix apps/api test
npm --prefix apps/api run test:e2e
```

Focus areas:

- BP CRUD authorization matrix
- tenant isolation by clinic and branch header
- soft-delete behaviour
- password policy with special-character enforcement
- account lockout after 5 failed attempts
- idle session expiry and absolute expiry

### Web

```bash
npm --prefix apps/web test
```

Focus areas:

- BP form conditional fields by type
- read-only UI states for VET, CASHIER, and ASSISTANT
- inactive BP visibility rules

### Contracts and E2E

```bash
npm run test:contracts
npm --prefix apps/web run test:e2e
```

Recommended E2E path:

1. Login
2. Select branch
3. Create Business Partner
4. Edit Business Partner
5. Soft-delete Business Partner
6. Verify unauthorized role cannot create/edit

---

## 8. Example API calls

### Login

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"owner@clinic.com","password":"Password1!"}'
```

### Create Customer BP

```bash
curl -b cookies.txt -X POST http://localhost:3001/api/v1/clinic/business-partners \
  -H 'Content-Type: application/json' \
  -H 'x-active-branch: <branch-id>' \
  -d '{
    "type":"CUSTOMER",
    "name":"Jane Doe"
  }'
```

### Create Vet BP

```bash
curl -b cookies.txt -X POST http://localhost:3001/api/v1/clinic/business-partners \
  -H 'Content-Type: application/json' \
  -H 'x-active-branch: <branch-id>' \
  -d '{
    "type":"VET",
    "name":"Dr. Somchai",
    "vet": {
      "licenseNumber":"VET-12345",
      "whtRate":3.00
    }
  }'
```

### Soft-delete a BP

```bash
curl -b cookies.txt -X PATCH http://localhost:3001/api/v1/clinic/business-partners/<bp-id>/deactivate \
  -H 'x-active-branch: <branch-id>'
```