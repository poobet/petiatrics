# Phase 0: System Architecture & Tech Stack

**Project:** Petiatrics (Pet Clinic Management SaaS)  
**Document Status:** Finalized (Phase 0)  
**Date:** March 2026  

## 1. Executive Summary
**Petiatrics** is a multi-tenant B2B2C Software-as-a-Service (SaaS) platform designed to modernize veterinary clinic operations. It seamlessly connects veterinarians, clinic staff, and pet owners within a single ecosystem. The Phase 0 architecture is built on a **Modular Monolith** foundation to ensure rapid go-to-market delivery while maintaining strict domain boundaries, allowing for an effortless transition to Microservices in the future.

## 2. High-Level Architecture
The system adopts a **Full-Stack TypeScript** architecture, divided into three primary portals that consume a centralized Backend API, all managed within a Monorepo workspace.

### 2.1 Frontend (Unified Application via Monorepo)
* **Framework:** Next.js (App Router)
* **Styling & UI:** Tailwind CSS, Radix UI
* **Design System:** Storybook `^8.4.7` (Shared UI components via `packages/ui`)
* **Structure:** Single Next.js application utilizing Route Groups for logical domain separation.
* **Portals (Route Groups):**
  * `(admin)`: Centralized management system for Platform Admins.
  * `(clinic)`: Desktop-optimized operational dashboard for clinic staff (Vets, Cashiers, Managers).
  * `(pet-owner)`: Mobile-first Progressive Web App (PWA) for pet owners.

**Storybook Runtime Commands (Monorepo):**
* Start Storybook: `npm run storybook`
* Build static Storybook site: `npm run storybook:build`
* Local URL: `http://localhost:6006`

### 2.2 Backend (API Layer)
* **Framework:** NestJS (Node.js)
* **Architecture Pattern:** Modular Monolith (Strict Bounded Contexts e.g., Identity, Clinical, Inventory, Billing).
* **Inter-module Communication:** Cross-domain communication is strictly handled via an Event-Driven pattern (`@nestjs/event-emitter`) to prevent tight coupling. Cross-domain SQL `JOIN` operations are strictly prohibited.

## 3. Polyglot Database Strategy
The platform utilizes a polyglot persistence approach to handle different data characteristics with maximum efficiency.

### 3.1 Relational Database (PostgreSQL)
* **ORM:** Prisma
* **Use Cases:** Highly structured data, financial transactions, RBAC, and inventory management (e.g., Clinics, Users, Roles, Invoices).
* **Key Features:** Leverages ACID compliance for data integrity and `JSONB` for flexible configuration storage.

### 3.2 Document Database (MongoDB)
* **ODM:** Mongoose
* **Use Cases:** Highly flexible, schema-less, or rapidly evolving data structures (e.g., Electronic Medical Records, Pet Profiles, Automated Audit Logs).

## 4. Multi-Tenancy & Data Isolation
The platform employs a **Shared Database, Shared Schema (Row-Level Multi-tenancy)** strategy.

* **Tenant Identification:** Every clinic-specific table (PostgreSQL) and collection (MongoDB) **MUST** contain a `clinic_id` field.
* **Security Enforcement:**
  * **Prisma Client Extensions:** Implemented as Global Query Filters to automatically inject `WHERE clinic_id = ?` into all relational queries.
  * **Mongoose Pre-hooks:** Applied to enforce tenant boundaries on NoSQL operations.
  * *Future Proofing:* This structure lays the groundwork for implementing PostgreSQL's native Row-Level Security (RLS) in subsequent phases.

## 5. Security & Authentication
* **Authentication Mechanism:** The system explicitly avoids JWTs in favor of **Session-based Authentication** for real-time access control and absolute token revocation.
* **Flow:**
  1. Upon successful login, NestJS generates a secure Session ID and sets it as an **HttpOnly, Secure Cookie**.
  2. The Session ID is mapped to the User Context (`user_id`, `clinic_id`, `role`) and stored in **Redis**.
  3. A global NestJS `TenantGuard` reads the cookie, retrieves the context from Redis, and injects the `clinic_id` into the request pipeline for isolated database querying.

## 6. Automated Audit Trail
* **Mechanism:** Data mutations are intercepted at the lowest level via ORM Interceptors (Prisma Middleware / Mongoose Hooks).
* **Flow:** Whenever an `UPDATE` or `DELETE` event occurs, the system automatically compares Old vs. New values, extracts the actor's identity from the Redis session, and asynchronously stores a detailed JSON log in the MongoDB `audit_logs` collection to ensure 100% transparency and prevent fraud.

## 7. Docker Strategy

Docker is used across **all environments** (local development, CI/CD, and production) to ensure environment parity and eliminate "works on my machine" issues.

### 7.1 Local Development (`docker-compose.yml`)

All infrastructure dependencies are containerized for local development. Application code runs on the host machine (via `turbo dev`) for fast HMR/hot-reload, while backing services run in Docker.

**Services:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | `5432` | Relational DB (Clinics, Users, Invoices, Inventory) |
| `mongo` | `mongo:7` | `27017` | Document DB (Medical Records, Audit Logs) |
| `redis` | `redis:7-alpine` | `6379` | Session store, event queue |

**Key conventions:**
* All data volumes are **named** (`postgres_data`, `mongo_data`, `redis_data`) to persist across container restarts.
* Services are connected via a shared `petiatrics_network` bridge network.
* Environment variables are loaded from a root `.env` file — never hardcoded in `docker-compose.yml`.

**Example `docker-compose.yml` structure:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: petiatrics_dev
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - petiatrics_network

  mongo:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - petiatrics_network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - petiatrics_network

volumes:
  postgres_data:
  mongo_data:
  redis_data:

networks:
  petiatrics_network:
    driver: bridge
```

### 7.2 Application Dockerfiles

Each application in `apps/` has its own multi-stage `Dockerfile` optimized for production.

**`apps/api/Dockerfile`** (NestJS — multi-stage):
```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

**`apps/web/Dockerfile`** (Next.js — standalone output):
```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Stage 2: Production (uses Next.js standalone output)
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
CMD ["node", "apps/web/server.js"]
```

> **Next.js** `next.config.js` MUST set `output: 'standalone'` to enable minimal Docker image output.

### 7.3 Production Stack (`docker-compose.prod.yml`)

In production, all services — including application containers — run in Docker and are orchestrated via `docker-compose.prod.yml` (or a Kubernetes manifest in future phases).

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      MONGO_URI: ${MONGO_URI}
      REDIS_URL: ${REDIS_URL}
      SESSION_SECRET: ${SESSION_SECRET}
    depends_on:
      - postgres
      - mongo
      - redis
    networks:
      - petiatrics_network

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${API_URL}
    depends_on:
      - api
    networks:
      - petiatrics_network

  # postgres, mongo, redis services same as dev...
```

### 7.4 Environment Variables

All secrets and configuration are passed through environment variables. Never commit `.env` files.

| Variable | Used By | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `api`, `packages/database` | PostgreSQL connection string |
| `MONGO_URI` | `api` | MongoDB connection string |
| `REDIS_URL` | `api` | Redis connection URL |
| `SESSION_SECRET` | `api` | Secret for signing session cookies |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `docker-compose` | Local DB credentials |
| `MONGO_USER` / `MONGO_PASSWORD` | `docker-compose` | Local Mongo credentials |
| `REDIS_PASSWORD` | `docker-compose` | Local Redis password |
| `NEXT_PUBLIC_API_URL` | `web` | Public API base URL (exposed to browser) |

A `.env.example` file committed to the repository documents all required variables without values.

---

## 8. Monorepo Directory Structure
The workspace is orchestrated using **Turborepo**.

```text
petiatrics/
├── apps/
│   ├── api/                    # NestJS Backend (Modular Monolith)
│   │   └── Dockerfile          # Multi-stage production image
│   └── web/                    # Next.js: Unified Frontend App (Admin, Clinic, Pet Owner)
│       └── Dockerfile          # Multi-stage standalone production image
│
├── packages/
│   ├── database/               # Prisma Schema & Generated Client
│   ├── ui/                     # Shared React Components (Storybook + Tailwind)
│   ├── types/                  # Shared TypeScript Interfaces / DTOs
│   └── config/                 # Shared configs (ESLint, Prettier, tsconfig)
│
├── docker-compose.yml          # Local dev: PostgreSQL, MongoDB, Redis
├── docker-compose.prod.yml     # Production: all services including app containers
├── .env.example                # Template for required environment variables
└── turbo.json                  # Turborepo build pipeline
```

## 9. Design System Runtime (Storybook)

`packages/ui` is the source of truth for reusable UI primitives, and Storybook is the runtime environment for isolated component development and review.

**Package runtime details:**
* Package: `@petiatrics/ui`
* Storybook version: `^8.4.7`
* Framework adapter: `@storybook/react-vite`
* Styling source: Tailwind CSS tokens imported from `apps/web/app/globals.css`

**Operational workflow:**
1. Build or update UI components under `packages/ui/src`.
2. Add/update stories in `packages/ui/src/**/*.stories.tsx`.
3. Run `npm run storybook` from monorepo root to review components in isolation.
4. Run `npm run storybook:build` in CI to publish static docs (`storybook-static/`).