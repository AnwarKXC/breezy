# Implementation Plan: Indexes and Performance

**Branch**: `005-indexes-and-performance` | **Date**: 2026-06-28 | **Spec**: `specs/005-indexes-and-performance/spec.md`

**Input**: Feature specification from `/specs/005-indexes-and-performance/spec.md`

## Summary

Add B-tree indexes to all 9 reservation tables to meet query performance targets for front desk operations (<1s status filter, <2s date range/availability, <2s company lookup). Indexes are already defined in the Phase 2 migration (`20260628000001_create_reservation_model.sql`); this phase confirms they exist, adds any missing indexes, runs EXPLAIN ANALYZE verification, and optionally adds a GiST index for heavy range queries.

## Technical Context

**Language/Version**: SQL (Postgres 15+) — no application code changes in this phase

**Primary Dependencies**: Supabase/Postgres, `supabase migration up` to apply

**Storage**: Supabase/Postgres — all indexes target existing reservation tables under `public` schema

**Testing**: SQL-based verification — EXPLAIN ANALYZE on core query patterns; no test framework needed

**Target Platform**: Postgres database (Supabase) — backend-only; no frontend changes

**Project Type**: Database schema optimization — migration + verification only

**Performance Goals**: Status filter <1s, date range search <2s, availability query <2s, company lookup <2s (at 100K reservations, 50K room assignments)

**Constraints**: 
- B-tree indexes only (GiST optional for heavy range queries)
- Partial indexes (`WHERE deleted_at IS NULL`) preferred
- No partitioning at current scale target (100K reservations)
- Index maintenance and monitoring out of scope
- Query rewriting, materialized views, and caching explicitly excluded

**Scale/Scope**: 100K reservations, 50K+ room assignments, 500+ companies (3-year target)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| **I. Database-First with Migrations** | Indexes added through numbered Supabase migrations. Already included in Phase 2 migration; any missing indexes added via new migration. | ✅ PASS |
| **II. Strict Layered Architecture** | No UI, hook, RTK, or service layer changes. Database-only phase. | ✅ PASS |
| **III. TypeScript Strictness & Validation** | No TypeScript changes. | ✅ PASS |
| **IV. Security, RBAC & Audit** | No new RLS or permission changes. Existing policies unchanged. | ✅ PASS |
| **V. Code Quality & Performance** | This phase is entirely about performance optimization. EXPLAIN ANALYZE verification ensures index effectiveness. | ✅ PASS |
| **Development Workflow** | Migrations are reviewable, applied via `supabase migration up`. | ✅ PASS |

**Result**: All gates pass. No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/005-indexes-and-performance/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — index design decisions
├── data-model.md        # Phase 1 output — index list per table
├── quickstart.md        # Phase 1 output — verification steps
└── contracts/           # Phase 1 output — index naming conventions
    └── index-conventions.md
```

### Source Code (repository root)

```text
supabase/migrations/
├── 20260628000001_create_reservation_model.sql   # Existing (has indexes baked in)
└── 20260628000002_add_reservation_indexes.sql     # Optional: missing indexes or GiST (new)

docs/
└── queries/
    └── reservation-perf-testing.sql               # EXPLAIN ANALYZE queries for verification
```

**Structure Decision**: Single project with all changes under `supabase/migrations/`. A new migration file is created if the existing Phase 2 migration is missing any indexes from the spec. Verification queries live under `docs/queries/` as SQL scripts — no test framework needed.

## Complexity Tracking

Not required — all constitution gates pass without violations.
