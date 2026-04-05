# petiatrics Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-06

## Active Technologies
- TypeScript 5.8.x on Node.js 20+ + Next.js 15 App Router, React 19, NestJS 11, Prisma 6, ioredis, bcrypt, class-validator, next-intl, Turborepo, shared `@petiatrics/*` packages, Zustand for web app session/branch state (002-first-vertical-slice)
- PostgreSQL for clinic/branch/user auth data, Redis for server-side sessions, MongoDB present in the platform but not central to this slice (002-first-vertical-slice)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (003-clinic-onboarding-staff)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (003-clinic-onboarding-staff)
- TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6 (PostgreSQL), ioredis, bcrypt, `@nestjs/throttler`, next-intl, Zustand, Turborepo (003-clinic-onboarding-staff)
- PostgreSQL for all relational data, Redis for server-side sessions (003-clinic-onboarding-staff)

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
- 003-clinic-onboarding-staff: Added TypeScript 5.8.x on Node.js 20+ + NestJS 11, Next.js 15 App Router, React 19, Prisma 6 (PostgreSQL), ioredis, bcrypt, `@nestjs/throttler`, next-intl, Zustand, Turborepo
- 003-clinic-onboarding-staff: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- 002-first-vertical-slice: Added TypeScript 5.8.x on Node.js 20+ + Next.js 15 App Router, React 19, NestJS 11, Prisma 6, ioredis, bcrypt, class-validator, next-intl, Turborepo, shared `@petiatrics/*` packages, Zustand for web app session/branch state


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
