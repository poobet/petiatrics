# Quickstart: Petiatrics Full Platform

## Prerequisites

- Docker Desktop with Compose support
- Node.js 20 LTS
- npm 10+ or pnpm 9+
- Git

## 1. Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in local values for:
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `MONGO_USER`
   - `MONGO_PASSWORD`
   - `REDIS_PASSWORD`
   - `DATABASE_URL`
   - `MONGO_URI`
   - `REDIS_URL`
   - `SESSION_SECRET`
   - `NEXT_PUBLIC_API_URL`

## 2. Start Infrastructure with Docker

```powershell
docker compose up -d postgres mongo redis
```

Verify services are healthy:

```powershell
docker compose ps
```

## 3. Install Workspace Dependencies

```powershell
npm install
```

## 4. Bootstrap the Databases

Run relational migrations and generate Prisma client:

```powershell
npm run db:migrate
npm run db:generate
```

Seed essential lookup and demo data:

```powershell
npm run db:seed
```

## 5. Start the Application in Development Mode

Run the monorepo dev command:

```powershell
npm run dev
```

Run Storybook for the shared UI package:

```powershell
npm run storybook
```

Expected local endpoints:

- Web app: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- Storybook: `http://localhost:6006`

## 6. Seed Demo Accounts

After running `npm run db:seed`, the following accounts are available:

| Role             | Email                          | Password     |
|------------------|-------------------------------|--------------|
| Platform Admin   | admin@petiatrics.io           | Admin@1234   |
| Clinic Manager   | manager@happypaws.io          | Password@1   |
| Veterinarian     | vet@happypaws.io              | Password@1   |
| Receptionist     | receptionist@happypaws.io     | Password@1   |
| Cashier          | cashier@happypaws.io          | Password@1   |
| Pet Owner        | owner@happypaws.io            | Password@1   |

## 7. Suggested Validation Flow

### Admin Portal (`/admin`)
1. Login as **Platform Admin** at `http://localhost:3000/login`
2. Review the demo clinic "Happy Paws" in the clinic list
3. Check the audit log at `/admin/audit` — should reflect all seed writes

### Clinic Portal (`/dashboard`)
1. Login as **Clinic Manager** — see KPI dashboard with seeded appointment + low-stock counts
2. Visit `/inventory` — confirm "Amoxicillin" and "DHPPiL Vaccine" appear as low-stock
3. Add stock via `/inventory/replenish`
4. Login as **Veterinarian** → open a patient record via `/patients`
5. Create a new SOAP visit record and finalize it — confirm inventory deduction event fires
6. Login as **Cashier** → visit `/billing` — confirm draft invoice appeared from finalized visit
7. Issue and then pay the invoice from the invoice detail page
8. Login as **Clinic Manager** → `/audit` — confirm all mutations are logged

### Pet Owner PWA (`/my`)
1. Login as **Pet Owner** — see pet cards (Mochi the Shih Tzu, Luna the cat)
2. Tap a pet — review health summary, vaccinations, past visits
3. Book an appointment at `/my/appointments/book` (3-step flow)
4. View invoices at `/my/invoices` — confirm expandable receipt with line items
5. Add to home screen (Android/iOS) — confirm PWA manifest installs correctly

### Contracts Validation
```powershell
npm run test:contracts
```

## 8. Test Commands

```powershell
npm run lint
npm run test
npm run test:e2e
npm run test:contracts
```

## 9. Production-like Local Run

Build images and launch the production compose stack:

```powershell
docker compose -f docker-compose.prod.yml up --build
```

## Notes

- Local infrastructure always runs in Docker.
- Application source runs on the host in development for faster iteration.
- Production and CI use the application Dockerfiles described in `documents/0-phase-architecture.md`.