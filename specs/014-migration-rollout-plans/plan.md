# Implementation Plan: Migration Rollout Plans

**Branch**: `014-migration-rollout-plans` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-migration-rollout-plans/spec.md`

## Summary

Create the remaining migration artifacts for the reservation model rollout: (1) an idempotent seed data migration with sample rooms, guests, companies, and reservation scenarios, (2) a hold expiry cleanup RPC and pg_cron scheduled job, and (3) a standalone SQL verification script that confirms all tables, indexes, RLS policies, RPCs, and seed data exist and function correctly.

## Technical Context

**Language/Version**: PostgreSQL 15 (Supabase), PL/pgSQL for RPCs and cron jobs, SQL for migrations and verification

**Primary Dependencies**: Supabase CLI (applying migrations), pg_cron (hold expiry scheduling), btree_gist (already enabled)

**Storage**: Supabase/Postgres — all migration and seed data targets the `public` schema

**Testing**: SQL verification script with `[PASS]`/`[FAIL]` labels per check, runnable via psql or Supabase dashboard SQL editor

**Target Platform**: Local Supabase development instance via `supabase start`

**Project Type**: Database migrations — SQL files under `supabase/migrations/`

**Performance Goals**: Seed migration completes in under 30 seconds; verification queries complete in under 5 seconds; expired holds cleaned within 5 minutes of expiry

**Constraints**: Seed migration must be idempotent (safe to re-run); pg_cron requires superuser or specific extension setup; hold expiry RPC must handle concurrent access safely

**Scale/Scope**: ~3 migration files (seed data, hold expiry RPC + cron, verification script), ~1 RPC function, ~1 pg_cron job definition

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Database-First with Migrations

All changes are applied through numbered Supabase migrations. The reservation schema migration is already in place. **PASS**

### Gate II — Strict Layered Architecture

No application code changes — this feature is entirely infrastructure/migrations. The hold expiry RPC follows the existing RPC pattern. **PASS**

### Gate III — TypeScript Strictness & Validation

No TypeScript code changes. SQL verification script uses no application code. **PASS**

### Gate IV — Security, RBAC & Audit

Hold expiry writes audit log entries. Verification confirms RLS policies exist. No new RLS changes needed. **PASS**

### Gate V — Code Quality & Performance

Seed migration handles concurrent re-runs via idempotent inserts. Verification queries are read-only. pg_cron job is lightweight. **PASS**

**Result**: ALL GATES PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/014-migration-rollout-plans/
├── plan.md              # This file
├── research.md          # Phase 0 — existing migration conventions
├── data-model.md        # Phase 1 — seed data entities and relationships
├── quickstart.md        # Phase 1 — how to apply and verify migrations
├── contracts/           # Phase 1 — RPC interface contracts
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/
├── 20260628000001_create_reservation_model.sql      # Already exists
├── 20260628000002_seed_reservation_data.sql          # US1 — Seed data
├── 20260628000003_hold_expiry_cleanup.sql            # US3 — Hold expiry RPC + pg_cron
└── scripts/
    └── verify-reservation-migration.sql              # US2 — Verification script
```

**Structure Decision**: Seed data and hold expiry are separate migration files following the existing naming convention (`YYYYMMDDHHMMSS_description.sql`). The verification script lives in `supabase/migrations/scripts/` (not a migration itself, since it's read-only).

## Complexity Tracking

No constitution violations to justify.
