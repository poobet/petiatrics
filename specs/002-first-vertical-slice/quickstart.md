# Quickstart: First Vertical Slice

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop or equivalent local Docker runtime

## Setup

1. Copy `.env.example` to `.env` and adjust local secrets if needed.
2. Start infrastructure services:

```powershell
docker compose up -d postgres mongo redis
```

3. Install workspace dependencies:

```powershell
npm install
```

4. Generate Prisma client and apply migrations:

```powershell
npm run db:generate
npm run db:migrate
```

5. Seed demo data for the slice:

```powershell
npm run db:seed
```

6. Start the app stack in development mode:

```powershell
npm run dev
```

Expected local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`

## Expected Seed Accounts

After the slice is implemented, the seed data should provide at least:

- one `SUPER_ADMIN` account for `/admin`
- one single-branch clinic user for `/clinic`
- one multi-branch clinic user for `/clinic`

## Manual Verification Flow

1. Visit `/login` without an existing session.
2. Log in as a clinic-scoped user and confirm:
   - an HttpOnly session cookie is set
   - you are redirected to `/clinic/dashboard`
   - the placeholder dashboard shows name, role, clinic name, and active branch
3. Clear cookies and confirm `/clinic/dashboard` redirects to `/login`.
4. Log in as a single-branch user and confirm the branch switcher is hidden.
5. Log in as a multi-branch user and confirm the branch switcher appears and updates the active branch.
6. Call the verification endpoint and confirm the current branch is enforced:

```powershell
curl -i -H "x-active-branch: <authorized-branch-id>" http://localhost:3001/api/v1/inventory/test
```

7. Log out and confirm subsequent authenticated requests return `401 Unauthorized`.

## Test Commands

Run the slice-relevant checks:

```powershell
npm test
npm run test:e2e
npm run test:contracts
npm run lint
```
