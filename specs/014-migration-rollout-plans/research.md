# Research: Migration Rollout Plans

## Existing Seed Data Patterns

**Decision**: Use `INSERT ... ON CONFLICT (natural_key) DO NOTHING` for idempotent seed data

**Rationale**: The existing project consistently uses this pattern:
- `20260520000000_add_room_types_and_pricing.sql`: `insert into public.room_types (...) values (...) on conflict (slug) do nothing`
- `20260602000004_add_accounting_rls_and_seed.sql`: Simple `INSERT INTO ... VALUES` (no idempotency guard)

For the reservation seed data, the `ON CONFLICT DO NOTHING` pattern on unique natural keys (room `number`, guest `email`, contact `email`, reservation `reservation_number`) provides idempotency without DELETE + INSERT which could cascade-delete related records.

**Alternatives considered**: `TRUNCATE + INSERT` — rejected because truncate would cascade-delete reservation rooms, payments, and audit history that reference parent records.

## Existing Database State

### Room Types (already seeded via 20260520000000)
| Name | Slug | Base Price | Capacity |
|------|------|-----------|----------|
| Standard | standard | 100.00 | 2 |
| Deluxe | deluxe | 180.00 | 2 |
| Suite | suite | 350.00 | 4 |
| Family | family | 250.00 | 4 |

### Rooms Table Structure
Columns: `id`, `number`, `floor`, `room_type_id` (FK → room_types), `status` (enum: available, occupied, maintenance, cleaning), `price`, `capacity`, `amenities`, `created_at`, `updated_at`, `deleted_at`

**Decision**: Seed 10 rooms across 3 room types. No rooms exist yet in any migration.

### Guests Table Structure
Columns: `id`, `first_name`, `last_name`, `email` (UNIQUE), `phone`, `country`, `passport_number`, `status` (enum: active, inactive, vip, blacklist), `total_bookings`, `total_spent`, `last_visit`, `created_at`, `updated_at`

**Decision**: Seed 2 guests (1 individual booking guest, 1 company guest). Use `ON CONFLICT (email) DO NOTHING`.

### Contacts Table
The `contacts` table (used by companies) has columns including `id`, `name`, `type` ('individual' or 'company'), `phone`, `email`, and company-specific fields. A company contact is needed for seed data.

**Decision**: Seed 1 company contact with type='company'. Use `ON CONFLICT` on the appropriate unique key from the contacts table definition.

## pg_cron Availability

**Decision**: Create hold expiry RPC and pg_cron job definition. Use `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog` for safe installation.

**Rationale**: Supabase supports pg_cron on all plans (Pro and above for production). For local development, pg_cron is available when Supabase CLI starts with the proper Docker image. The extension install is idempotent — the `create extension if not exists` pattern follows the existing `btree_gist` extension approach in `20260628000001_create_reservation_model.sql`.

**pg_cron job pattern**:
```sql
select cron.schedule(
  'expire-reservation-holds',
  '1 minute',
  $$ select public.expire_reservation_holds(); $$
);
```

**Edge case**: If pg_cron is not available (local dev without proper setup), the migration should still succeed — the extension and cron job are conditional. The availability RPC already filters by `expires_at > now()`, so the system functions without pro-active cleanup.

**Alternatives considered**:
- Edge Function scheduled job: Adds HTTP dependency and latency; rejected per spec clarification.
- Inline check only: Doesn't write audit logs for expired holds; rejected because FR-015 requires audit trail.

## Verification Script Pattern

**Decision**: Standalone SQL script using DO blocks with RAISE NOTICE for [PASS]/[FAIL] output

**Rationale**: PL/pgSQL `DO` blocks allow procedural logic (IF/THEN/RAISE) in a single psql-runnable file. No external runtime needed. Pattern:

```sql
do $$ declare v_count integer; begin
  select count(*) into v_count from information_schema.tables where table_schema = 'public' and table_name = 'reservations';
  if v_count = 1 then
    raise notice '[PASS] reservations table exists';
  else
    raise notice '[FAIL] reservations table missing';
  end if;
end $$;
```

**Alternatives considered**: Python/Node verification script — adds language runtime dependency; rejected per spec clarification (standalone SQL).

## Reservation Seed Data Strategy

**Decision**: Seed 3 reservations with different statuses using fixed UUIDs and dates relative to the day the seed runs

**Rationale**: Statuses needed: checked_in (past check-in, future check-out), checked_out (past), confirmed (future). Use dates based on `current_date` so the seed is always realistic:

| Reservation | Status | Check-in | Check-out | Type |
|---|---|---|---|---|
| RSV-001 | checked_in | current_date - 2 | current_date + 2 | individual |
| RSV-002 | checked_out | current_date - 7 | current_date - 5 | individual |
| RSV-003 | confirmed | current_date + 5 | current_date + 8 | company |

**Room states**: Set room 105 to maintenance, room 106 to dirty (cleaning needed).

**Alternatives considered**: Using fixed dates — rejected because seed data becomes stale over time.

## Audit Log Integration

**Decision**: The hold expiry RPC inserts into `public.logs` table using the existing log structure.

**Rationale**: The reservation model migration already extended the `log_action` enum with `hold_expired`. The RPC should insert a log entry per expired hold using this action type. The existing logs table has columns: `id`, `action`, `actor_id`, `target_id`, `target_type`, `metadata`, `created_at`.

**Referenced audit action**: `hold_expired` (already added in `20260628000001_create_reservation_model.sql` line 118)
