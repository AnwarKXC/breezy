# Implementation Plan: Availability RPC / Service

**Branch**: `007-availability-service` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-availability-service/spec.md`

## Summary

Enhance the existing `get_room_availability` RPC to return 11 distinct availability statuses, per-room price preview (with company overrides), and detailed conflict information — all in a single query. This is a backend-only phase: no new tables, no UI components, no observability instrumentation.

## Technical Context

**Language/Version**: PostgreSQL 15 (PL/pgSQL) via Supabase

**Primary Dependencies**: Supabase/Postgres — no new dependencies. Existing tables from Phase 2 (rooms, room_types, reservations, reservation_rooms, reservation_holds, reservation_pricing_items, company_price_overrides, guests).

**Storage**: PostgreSQL — existing reservation schema. No new tables.

**Testing**: Manual SQL test scripts via Supabase SQL editor (pgTAP deferred to separate phase)

**Target Platform**: Supabase PostgreSQL 15+

**Project Type**: Backend — PostgreSQL function (RPC) enhancement

**Performance Goals**: <2 seconds at 10,000+ reservations for a 3-night stay query (SC-001)

**Constraints**: Single SQL query, no new tables, no new PL/pgSQL extensions. Must use existing indexes from Phase 5.

**Scale/Scope**: ~100K reservations over 3 years. B-tree indexes sufficient — no partitioning.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| **I. Database-First with Migrations** | ✅ PASS | RPC enhancement applied through numbered Supabase migration |
| **II. Strict Layered Architecture** | ✅ PASS | Backend-only phase — no UI layer affected. No architecture-layer violations. |
| **III. TypeScript Strictness & Validation** | ✅ N/A | No TypeScript code in this phase |
| **IV. Security, RBAC & Audit** | ✅ PASS | RPC uses `security definer` + `can_read_reservations()` guard from Phase 6. Read-only query — no write audit required. |
| **V. Code Quality & Performance** | ✅ N/A | No application code in this phase. Performance target of <2s with indexes. |

**Gate verdict**: ✅ PASS — all constitutional principles satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/007-availability-service/
├── plan.md              # This file
├── research.md          # Architecture decisions (Phase 0)
├── data-model.md        # Availability status logic and return shape (Phase 1)
├── quickstart.md        # Validation queries (Phase 1)
├── contracts/           # RPC signature and return type contracts (Phase 1)
└── tasks.md             # Implementation tasks (Phase 2 — created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Backend-only phase — no frontend changes
supabase/
└── migrations/
    └── 20260628000003_enhance_room_availability_rpc.sql   # Single migration file

# Documentation
specs/007-availability-service/
└── ...  # (see above)
```

**Structure Decision**: Single migration file under `supabase/migrations/`. All documentation under `specs/007-availability-service/`. No TypeScript, no frontend, no configuration changes outside the migration.

## Complexity Tracking

No constitutional violations — Complexity Tracking table is empty.
