# Quickstart: Clinic Onboarding, Staff Creation, and Dual Authentication

## Prerequisites

- Node.js 20+, Docker (for PostgreSQL + Redis)
- `turbo`, `pnpm` or `npm workspaces` installed
- Branch: `003-clinic-onboarding-staff`

```bash
git checkout 003-clinic-onboarding-staff
```

---

## 1. Apply the Prisma migration

The migration adds `slug` and `phone` to `Clinic`, `name`/`username`/`mustChangePassword` to `User`, makes `User.email` nullable, and extends the `ClinicStatus` and `UserStatus` enums.

```bash
cd packages/database
npx prisma migrate dev --name 003-clinic-onboarding-auth
npx prisma generate
```

> If running locally with Docker: `docker-compose up -d db redis` first.

---

## 2. Run the seed

The seed creates one `SUPER_ADMIN`, one approved clinic with a slug, one `CLINIC_OWNER`, and two staff members — one with a username and `mustChangePassword=true`, one legacy user with an email address.

```bash
cd packages/database
npx ts-node src/seed.ts
```

Expected output:
```
[seed] Created SUPER_ADMIN: admin@petiatrics.com
[seed] Created clinic: Happy Paws (slug: happy-paws)
[seed] Created CLINIC_OWNER: owner@happypaws.com
[seed] Created staff: somchai@happy-paws (mustChangePassword=true)
[seed] Created legacy staff (email): legacy@happypaws.com
```

---

## 3. Start the development servers

```bash
# From repo root
npm run dev
# or
turbo dev
```

This starts `apps/api` (NestJS, port 3001) and `apps/web` (Next.js, port 3000) concurrently.

---

## 4. Verify the registration flow (manual)

1. Open `http://localhost:3000/register`
2. Fill in clinic name, tax ID, address, owner name, email, and password
3. Submit — you should see a "Pending review" confirmation (no login cookie)
4. In a second tab, log in as `admin@petiatrics.com` and navigate to `/admin/clinics`
5. You should see the new request listed as `PENDING`
6. Click **Approve** — the clinic and owner transition to `ACTIVE`
7. Log out and log in as the clinic owner you just approved

---

## 5. Verify the staff creation flow (manual)

1. Log in as an approved clinic owner
2. Navigate to `/clinic/staff`
3. Click **Add Staff Member** — the dialog shows a username prefix field with `@happy-paws` appended
4. Enter prefix `somchai`, select a role, pick a branch, and set a temporary password
5. Submit — the staff row appears in the list with username `somchai@happy-paws`

---

## 6. Verify the dual login flow (manual)

**Email login** (owner or admin):
```
identifier: owner@happypaws.com
password:   <set during registration>
```

Expected: redirects to `/clinic/dashboard`.

**Username login** (staff):
```
identifier: somchai@happy-paws
password:   <temporary password set by owner>
```

Expected: redirects to `/clinic/change-password` because `mustChangePassword=true`.

After changing the password, expected: redirects to `/clinic/dashboard`.

---

## 7. Key environment variables

| Variable                 | Default              | Notes                                      |
|--------------------------|----------------------|--------------------------------------------|
| `DATABASE_URL`           | (required)           | PostgreSQL connection string               |
| `REDIS_URL`              | (required)           | Redis connection string                    |
| `SESSION_TTL_SECONDS`    | `86400`              | Session expiry in seconds                  |
| `NODE_ENV`               | `development`        | `production` enables Secure cookie flag    |
| `NEXT_PUBLIC_API_URL`    | `http://localhost:3001` | Used by the web app server components   |

---

## 8. API quick-reference

```bash
# Register a new clinic (public)
curl -X POST http://localhost:3001/api/v1/auth/register-request \
  -H 'Content-Type: application/json' \
  -d '{
    "clinicName":"Test Clinic","taxId":"TX-0001",
    "address":{"line1":"1 Main St","district":"Bangkok","province":"Bangkok","postalCode":"10100"},
    "ownerName":"Test Owner","ownerEmail":"owner@test.com","password":"Password1!"
  }'

# Login as owner (email path)
curl -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"owner@test.com","password":"Password1!"}'

# Approve clinic as admin (use admin session cookie)
curl -b cookies.txt -X PATCH http://localhost:3001/api/v1/admin/clinics/{clinicId}/approve

# Create staff
curl -b cookies.txt -X POST http://localhost:3001/api/v1/clinic/staff \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Somchai V","usernamePrefix":"somchai",
    "role":"VET","temporaryPassword":"Temp1234!",
    "branchIds":["<branchId>"]
  }'

# Login as staff (username path)
curl -c staff-cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"somchai@test-clinic","password":"Temp1234!"}'
```
