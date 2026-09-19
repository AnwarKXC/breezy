# Implementation Plan: Supabase Schema Design

**Branch**: `004-supabase-schema-design` | **Date**: 2026-06-28 | **Spec**: `specs/004-supabase-schema-design/spec.md`

**Input**: Feature specification from `/specs/004-supabase-schema-design/spec.md`

## Summary

Create or extend the Supabase/Postgres database schema for the reservation model — 9 related tables covering the reservation parent record, room assignments, guest associations, company billing, itemized pricing, payments, room holds, operational notes, and status history — with indexes, constraints, migration order, and RLS policies. This schema is the foundation for all reservation lifecycle, billing, and operational features.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16, React 19) — per constitution; SQL for migrations

**Primary Dependencies**: Supabase/Postgres (database), Supabase CLI (migrations), Supabase MCP (schema verification), `btree_gist` extension (if exclusion constraint approach chosen)

**Storage**: Supabase/Postgres — all reservation data stored in new tables under `public` schema

**Testing**: Vitest (unit/integration), Playwright (E2E) — tests verify schema constraints via service layer

**Target Platform**: Existing Next.js App Router application — schema is backend-only; no frontend changes in this phase

**Project Type**: Web application — this phase creates the database schema only; services, API routes, and UI are in subsequent phases

**Performance Goals**: Not applicable — schema phase focuses on correct data model; performance optimization deferred to indexing phase (Phase 3 in reference plan)

**Constraints**: 
- All schema changes MUST go through numbered Supabase migrations
- Double booking MUST be prevented at the database level (exclusion constraint or transactional RPC)
- Reservation status and room physical status MUST remain separate
- Permission checks and audit logging are required at the application layer
- Sensitive operations must use transactions or RPCs for concurrent safety
- Audit 003 must provide the extend-vs-create decision for `bookings`/`reservations`

**Scale/Scope**: 
- 9 tables to create (or extend existing if 003 recommends it)
- Indexes on all foreign keys and date-range query columns
- RLS policies on all tables
- Migration order: reservations → reservation_rooms → reservation_guests → reservation_company_info → reservation_pricing_items → reservation_payments → reservation_holds → reservation_notes → reservation_status_history → indexes → RLS

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| **I. Database-First with Migrations** | All schema changes go through numbered Supabase migrations. Indexes and constraints added before application logic. Double booking prevented at database level. | ✅ PASS |
| **II. Strict Layered Architecture** | Schema phase creates backend data layer only. No UI or hook layer changes. Layered direction preserved. | ✅ PASS |
| **III. TypeScript Strictness & Validation** | TypeScript types generated from schema or defined alongside it. Zod validation for all API payloads (deferred to service phase). | ✅ PASS |
| **IV. Security, RBAC & Audit** | RLS policies on all tables. Audit log integration required for sensitive operations. Permission checks at application layer. | ✅ PASS |
| **V. Code Quality & Performance** | Indexes added for performance. Migration-based DDL ensures consistency. | ✅ PASS |
| **Development Workflow** | Migrations are reviewable, reversible (via down migration), and follow Supabase conventions. | ✅ PASS |

**Result**: All gates pass. No constitution violations. Complexity tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/004-supabase-schema-design/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (no clarifications needed)
├── research.md          # Phase 0 output — schema design decisions
├── data-model.md        # Phase 1 output — entity definitions and relationships
├── quickstart.md        # Phase 1 output — migration run guide
└── contracts/           # Phase 1 output — migration conventions
    └── migration-conventions.md
```

### Source Code (repository root)

```text
supabase/migrations/
├── YYYYMMDDHHMMSS_create_reservations.sql
├── YYYYMMDDHHMMSS_create_reservation_rooms.sql
├── YYYYMMDDHHMMSS_create_reservation_guests.sql
├── YYYYMMDDHHMMSS_create_reservation_company_info.sql
├── YYYYMMDDHHMMSS_create_reservation_pricing_items.sql
├── YYYYMMDDHHMMSS_create_reservation_payments.sql
├── YYYYMMDDHHMMSS_create_reservation_holds.sql
├── YYYYMMDDHHMMSS_create_reservation_notes.sql
├── YYYYMMDDHHMMSS_create_reservation_status_history.sql
├── YYYYMMDDHHMMSS_add_reservation_indexes.sql
└── YYYYMMDDHHMMSS_add_reservation_rls.sql
```

**Structure Decision**: Single project with all migrations under `supabase/migrations/`. The spec's 9 entities map to 9 migration files (one per table), plus index and RLS migrations. Each file is order-dependent — later migrations reference earlier tables via foreign keys.

## Complexity Tracking

Not required — all constitution gates pass without violations.
