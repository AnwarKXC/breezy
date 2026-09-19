# Implementation Plan: API Routes, TypeScript Models, and Validation

**Branch**: `012-api-routes-models-validation` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-api-routes-models-validation/spec.md`

## Summary

Add 17+ secure API endpoints for reservation lifecycle operations (create, hold, confirm, check-in, check-out, cancel, no-show, room change, guests, payments) with Zod-validated TypeScript input models and comprehensive validation rules. All endpoints follow existing patterns: session verification, permission checks, transactional writes for critical mutations, and audit logging.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router), React 19

**Primary Dependencies**: Next.js 16 route handlers, Zod (validation), Supabase Admin SDK (service-role server client)

**Storage**: Supabase/Postgres (existing tables: reservations, reservation_rooms, reservation_guests, reservation_holds, reservation_payments, reservation_status_history, audit_logs)

**Testing**: Existing test framework (Vitest) with Supertest for API route integration tests

**Target Platform**: Web — Next.js server runtime (internal front desk system)

**Project Type**: Web application — route handlers in `src/app/api/reservations/`

**Performance Goals**: <200ms p95 endpoint response time; rate limited at 60 req/min per user

**Constraints**: All validation at API boundary via Zod schemas; audit logs written synchronously within write transactions; i18n for all user-facing error messages; endpoints must be idempotent for lifecycle mutations

**Scale/Scope**: Up to 20 concurrent front desk users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Database-First with Migrations
No new tables or migrations required. This phase builds API layer on top of existing tables from prior phases. **PASS**

### Gate II — Strict Layered Architecture
API route handlers sit at the "Service → Supabase/API" boundary. Route handlers MUST call existing service methods (not embed business logic) and MUST NOT be imported by UI components. **PASS** (with note: verify no business logic leaks into route handlers)

### Gate III — TypeScript Strictness & Validation
All input Zod schemas enforce strict mode. No `as any`, `@ts-ignore`, or `@ts-expect-error`. Input models are the single source of truth for API payload shapes. **PASS**

### Gate IV — Security, RBAC & Audit
FR-018 through FR-023 explicitly require session verification, permission checks, and audit logging for every write endpoint. Rate limiting (FR-032) adds DoS protection. **PASS**

### Gate V — Code Quality & Performance
No `console.log` in production code. ESLint must pass. `pnpm build` must succeed. **PASS**

**Result**: ALL GATES PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/012-api-routes-models-validation/
├── plan.md              # This file
├── research.md          # Phase 0 output — existing patterns exploration
├── data-model.md        # Phase 1 output — TypeScript input/output types and Zod schemas
├── quickstart.md        # Phase 1 output — validation scenarios
├── contracts/           # Phase 1 output — API contracts
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
src/app/api/reservations/
├── route.ts                          # GET list, POST create
├── [id]/route.ts                     # GET by id, PATCH update
├── [id]/hold/route.ts                # POST hold
├── [id]/release-hold/route.ts        # POST release hold
├── [id]/confirm/route.ts             # POST confirm
├── [id]/check-in/route.ts            # POST check-in
├── [id]/check-out/route.ts           # POST check-out
├── [id]/cancel/route.ts              # POST cancel
├── [id]/no-show/route.ts             # POST no-show
├── [id]/rooms/route.ts               # POST add room
├── [id]/rooms/[reservationRoomId]/route.ts  # PATCH/DELETE room
├── [id]/guests/route.ts              # POST add guest
├── [id]/guests/[reservationGuestId]/route.ts # PATCH guest
├── [id]/payments/route.ts            # POST payment
├── availability/route.ts             # GET availability search

src/app/api/rooms/
├── [id]/details-with-history/route.ts # GET room details + history
├── [id]/history/route.ts              # GET room history only

src/modules/reservations/
├── validation.ts                     # All Zod schemas for reservation inputs
├── types.ts                          # TypeScript types (extended)
├── index.ts                          # Barrel exports
```

**Structure Decision**: Follow existing Next.js App Router convention with route.ts files in `src/app/api/`. TypeScript models and Zod schemas live in `src/modules/reservations/` alongside existing reservation module code.

## Complexity Tracking

No constitution violations to justify.
