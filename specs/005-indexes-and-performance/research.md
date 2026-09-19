# Research: Indexes and Performance

## Research Context

This feature implements Phase 3 from `docs/plans/reservation_model_supabase_mcp_plan.md` (Section 14). The goal is to add B-tree indexes to all 9 reservation tables for query performance, and optionally add a GiST index for heavy range queries. Most indexes are already defined in the Phase 2 migration (`20260628000001_create_reservation_model.sql`); this phase confirms, completes, and verifies them.

## Key Design Decisions

### Decision 1: New Migration vs. Existing Migration Update

- **Decision**: If the existing Phase 2 migration already contains all required indexes (verified by inspection), create no new migration. If any indexes from the spec are missing, create a new migration `20260628000002_add_reservation_indexes.sql` to add them.
- **Rationale**: Avoids altering an already-deposited migration. Adding a new incremental migration is cleaner and preserves the existing migration history.
- **Alternatives considered**: Updating the existing Phase 2 migration in place — riskier and breaks migration chain integrity.

### Decision 2: B-tree Priority Over GiST

- **Decision**: Core indexes are B-tree. The GiST index on `daterange(check_in_date, check_out_date)` is optional — only added if EXPLAIN ANALYZE shows range queries performing sequential scans on the B-tree index.
- **Rationale**: B-tree indexes are sufficient for the common query patterns (equality on FK, range on two columns). The GiST index adds write overhead and is only beneficial when range overlap queries are the primary access pattern. The existing `btree_gist` exclusion constraint already covers conflict detection.
- **Alternatives considered**: Always add the GiST index — defensive but adds unnecessary write overhead for most query patterns.

### Decision 3: Partial Indexes for Soft Delete

- **Decision**: All reservation table indexes use `WHERE deleted_at IS NULL` partial indexes instead of full-table indexes.
- **Rationale**: Most queries target active (non-deleted) rows. Partial indexes are smaller, faster to scan, and cheaper to maintain on writes. They exclude the minority of deleted rows from the index entirely.
- **Alternatives considered**: Full-table indexes — simpler but larger and slower for the common active-row query pattern.

### Decision 4: Verification Without Test Framework

- **Decision**: Performance verification uses raw SQL (EXPLAIN ANALYZE) scripted in `docs/queries/reservation-perf-testing.sql`. No unit/integration test framework is needed.
- **Rationale**: This is a database schema phase with no application code changes. EXPLAIN ANALYZE is the industry-standard way to verify index usage. Creating test framework infrastructure for a database-only phase is overhead without benefit.
- **Alternatives considered**: Vitest integration tests that run EXPLAIN ANALYZE via the Supabase client — adds unnecessary complexity since the test target is the database, not application behavior.

### Decision 5: Index Naming Convention

- **Decision**: Follow the existing convention from Phase 2: `idx_{table}_{columns}`.
- **Rationale**: Consistent with the existing migration. All Phase 2 indexes use `idx_reservations_status`, `idx_reservation_rooms_room_dates`, etc.
- **Alternatives considered**: Schema-qualified naming (e.g., `idx_public_reservations_status`) — more verbose and inconsistent with existing convention.

### Decision 6: Performance Test Data Volume

- **Decision**: Generate 10,000+ reservations, 50,000+ room assignments, and 500+ companies for benchmark testing.
- **Rationale**: Matches the success criteria targets from the spec (SC-001 through SC-004). This volume is achievable with bulk INSERT via Supabase client without needing tools like `pgbench`.
- **Alternatives considered**: `pgbench` with custom scripts — more realistic load testing but overkill for index verification.

## Reference Documents

- `docs/plans/reservation_model_supabase_mcp_plan.md` — Section 14 (Phase 3 indexes)
- `supabase/migrations/20260628000001_create_reservation_model.sql` — Existing migration with indexes at lines 429-485
- `specs/005-indexes-and-performance/spec.md` — 15 FRs, 6 SCs, 3 user stories
- `.specify/memory/constitution.md` — Project architecture governance
