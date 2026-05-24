# petiatrics Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-16

## Active Technologies
- TypeScript 5.8.x on Node.js 20+ + Next.js 15 App Router, React 19, NestJS 11, Prisma 6, ioredis, bcrypt, class-validator, next-intl, Turborepo, shared `@petiatrics/*` packages, Zustand for web app session/branch state (002-first-vertical-slice)
- PostgreSQL for clinic/branch/user auth data, Redis for server-side sessions, MongoDB present in the platform but not central to this slice (002-first-vertical-slice)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (003-clinic-onboarding-staff)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (003-clinic-onboarding-staff)
- TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6 (PostgreSQL), ioredis, bcrypt, `@nestjs/throttler`, next-intl, Zustand, Turborepo (003-clinic-onboarding-staff)
- PostgreSQL for all relational data, Redis for server-side sessions (003-clinic-onboarding-staff)
- TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, Redis via ioredis, class-validator, bcrypt, Zustand, next-intl (005-identity-bp-spec)
- PostgreSQL for identity and BP master data, Redis for server-side sessions, MongoDB retained for existing clinical records and audit collections (005-identity-bp-spec)
- TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, MongoDB via Mongoose for audit logs, Redis via ioredis, class-validator, zod, react-hook-form, next-intl (006-item-master)
- PostgreSQL for item master, categories, units, product stock state, and global `TaxCode`; MongoDB for immutable audit logs; Redis for session state and branch-aware authentication context (006-item-master)

- TypeScript 5.x on Node.js 20 LTS + Next.js App Router, React 19, NestJS, Prisma, Mongoose, Redis, Tailwind CSS, Radix UI, Storybook, Turborepo, next-intl or equivalent i18n layer (001-petiatrics-platform-all)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x on Node.js 20 LTS: Follow standard conventions

## Recent Changes
- 006-item-master: Added TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, MongoDB via Mongoose for audit logs, Redis via ioredis, class-validator, zod, react-hook-form, next-intl
- 005-identity-bp-spec: Added TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6, PostgreSQL, Redis via ioredis, class-validator, bcrypt, Zustand, next-intl
- 003-clinic-onboarding-staff: Added TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6 (PostgreSQL), ioredis, bcrypt, `@nestjs/throttler`, next-intl, Zustand, Turborepo


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
