# petiatrics Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-31

## Active Technologies
- TypeScript 5.8.x on Node.js 20+ + Next.js 15 App Router, React 19, NestJS 11, Prisma 6, ioredis, bcrypt, class-validator, next-intl, Turborepo, shared `@petiatrics/*` packages, Zustand for web app session/branch state (002-first-vertical-slice)
- PostgreSQL for clinic/branch/user auth data, Redis for server-side sessions, MongoDB present in the platform but not central to this slice (002-first-vertical-slice)

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
- 002-first-vertical-slice: Added TypeScript 5.8.x on Node.js 20+ + Next.js 15 App Router, React 19, NestJS 11, Prisma 6, ioredis, bcrypt, class-validator, next-intl, Turborepo, shared `@petiatrics/*` packages, Zustand for web app session/branch state

- 001-petiatrics-platform-all: Added TypeScript 5.x on Node.js 20 LTS + Next.js App Router, React 19, NestJS, Prisma, Mongoose, Redis, Tailwind CSS, Radix UI, Storybook, Turborepo, next-intl or equivalent i18n layer

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
