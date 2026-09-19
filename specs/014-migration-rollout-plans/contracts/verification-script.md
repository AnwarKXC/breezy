# Contract: Reservation Migration Verification Script

## Overview

A standalone SQL script (`supabase/migrations/scripts/verify-reservation-migration.sql`) that confirms all reservation model migrations were applied correctly. Outputs `[PASS]` or `[FAIL]` for each check via `RAISE NOTICE`.

## Verification Categories

### Extension Checks (2)
- `btree_gist` extension exists
- `pg_cron` extension exists (with grace: if missing, output WARN not FAIL)

### Enum Checks (10)
All enums created by `20260628000001_create_reservation_model.sql`:
- `reservation_status`, `reservation_booking_type`, `billing_party`, `reservation_source`, `reservation_room_status`, `reservation_guest_role`, `reservation_payment_type`, `reservation_payment_method`, `price_source`, `room_physical_status`

### Table Checks (10)
All reservation tables + room_status_history:
- `reservations`, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_payments`, `reservation_holds`, `reservation_notes`, `reservation_status_history`, `room_status_history`

### Index Checks (~15)
From `Performance Indexes` section of the reservation model migration:
- At least 15 indexes exist across the 10 reservation tables
- Check primary key indexes, partial unique indexes, composite indexes, and WHERE-clause indexes

### RLS Checks (10)
Each table:
- `row_level_security` is enabled (relrowsecurity = true in pg_class)
- At least one policy exists per table

### RPC Checks (3)
- `public.get_room_availability` function exists and is callable
- `public.confirm_reservation` function exists and is callable
- `public.cancel_reservation` function exists and is callable

### Trigger Checks (~8)
`updated_at` triggers exist on tables with `updated_at` columns:
- `reservations`, `reservation_rooms`, `reservation_guests`, `reservation_company_info`, `reservation_pricing_items`, `reservation_holds` (others without the column are excluded)

### Seed Data Checks (5)
- `rooms` count ≥ 14 (4 existing room types seeded + 10 new rooms)
- `guests` count ≥ 2
- `contacts` count ≥ 1 company
- `reservations` count ≥ 3 (RSV-SEED-001, 002, 003)
- `reservation_holds` count ≥ 0 (no holds seeded, but table exists)

## Output Format

```sql
-- Example DO block pattern
do $$ declare v_count integer; begin
  select count(*) into v_count from information_schema.tables
  where table_schema = 'public' and table_name = 'reservations';
  if v_count = 1 then
    raise notice '[PASS] reservations table exists';
  else
    raise notice '[FAIL] reservations table missing';
  end if;
end $$;
```

## Exit Code Convention

If any check fails, the script ends with:
```sql
raise exception '[VERIFY FAILED] One or more checks failed. Run verification again after applying all migrations.';
```

This ensures psql returns a non-zero exit code when verification fails, suitable for CI/CD integration in the future.
