# Quickstart: Indexes and Performance

This guide walks through verifying that all reservation indexes exist and confirming they improve query performance.

## Prerequisites

- Supabase CLI installed and authenticated
- Supabase local stack running
- Phase 2 migration applied (all 9 reservation tables exist)
- Migration file at `supabase/migrations/20260628000001_create_reservation_model.sql`

## Step 1: Verify Existing Indexes

```sql
-- Count indexes and verify all 19 are present
SELECT indexname FROM pg_indexes
WHERE tablename LIKE 'reservation_%'
   OR tablename = 'room_status_history'
ORDER BY indexname;
```

Expected: 19 indexes (including the `reservation_guests_single_primary` unique index and the `reservation_rooms_no_overlap` exclusion constraint).

If any are missing, create a new migration `20260628000002_add_reservation_indexes.sql` with only the missing indexes.

## Step 2: Seed Test Data

Generate at least 10,000 reservations, 50,000 room assignments, and 500+ companies for meaningful performance measurement.

```sql
-- Generate bulk test data (adjust counts as needed)
INSERT INTO reservations (booking_type, status, source, check_in_date, check_out_date, nights, adults, created_by)
SELECT
  'individual',
  CASE WHEN random() < 0.3 THEN 'confirmed' WHEN random() < 0.6 THEN 'checked_out' ELSE 'cancelled' END,
  'manual',
  CURRENT_DATE + (random() * 365)::int,
  CURRENT_DATE + (random() * 365)::int + 3,
  3,
  1 + (random() * 3)::int,
  (SELECT id FROM profiles LIMIT 1)
FROM generate_series(1, 10000);
```

## Step 3: Run EXPLAIN ANALYZE

Execute each verification query and confirm index scans are used:

```sql
-- Status filter (expect index scan on idx_reservations_status)
EXPLAIN ANALYZE
SELECT * FROM reservations
WHERE status = 'confirmed' AND deleted_at IS NULL
LIMIT 100;

-- Date range (expect index scan on idx_reservations_dates)
EXPLAIN ANALYZE
SELECT * FROM reservations
WHERE check_in_date >= CURRENT_DATE
  AND check_in_date < CURRENT_DATE + 7
  AND deleted_at IS NULL;

-- Room availability (expect index scan on idx_reservation_rooms_room_dates)
EXPLAIN ANALYZE
SELECT rr.* FROM reservation_rooms rr
WHERE rr.room_id = (SELECT id FROM rooms LIMIT 1)
  AND rr.check_in_date < CURRENT_DATE + 5
  AND rr.check_out_date > CURRENT_DATE
  AND rr.deleted_at IS NULL
  AND rr.status IN ('held', 'reserved', 'occupied');

-- Company lookup (expect index scan on idx_reservations_company)
EXPLAIN ANALYZE
SELECT * FROM reservations
WHERE company_id IS NOT NULL AND deleted_at IS NULL
LIMIT 100;
```

Each query must show an Index Scan (not Sequential Scan) in the query plan.

## Step 4: Verify Performance Targets

Run timed queries and measure against targets:

| Query | Target |
|-------|--------|
| Status filter | < 1 second |
| Date range search | < 2 seconds |
| Room availability | < 2 seconds |
| Company lookup | < 2 seconds |
| Billing aggregation | < 5 seconds |

## Step 5: Optional â€” GiST Range Index

If any date-range query shows a Sequential Scan, add the optional GiST index:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservation_rooms_date_range
ON reservation_rooms
USING gist (daterange(check_in_date, check_out_date, '[)'));
```

Re-run EXPLAIN ANALYZE on the affected query to confirm the GiST scan is chosen.

## Troubleshooting

- **Sequential scan despite index**: Run `ANALYZE` to update table statistics. Postgres's query planner uses statistics to decide between scan strategies.
- **Missing index**: Check the index inventory in data-model.md and create a new migration for any missing indexes.
- **Slow query after index**: Check for table bloat via `SELECT pg_size_pretty(pg_total_relation_size('table_name'))`. VACUUM may be needed.
- **Partial index not used**: Ensure the query's WHERE clause matches the partial index's condition exactly (same NULL checks, same column order).

## Codex Verification Notes

- Use `npx -y supabase ...` when the Supabase CLI is not installed globally.
- Docker Desktop must be running before `supabase start` can create the local stack.
- Static inspection on 2026-06-28 found all required index objects in `20260628000001_create_reservation_model.sql`; no extra index migration was needed.
- Run `docs/queries/reservation-index-inventory.sql`, `docs/queries/reservation-performance-seed.sql`, and `docs/queries/reservation-perf-testing.sql` once local Supabase is healthy.
