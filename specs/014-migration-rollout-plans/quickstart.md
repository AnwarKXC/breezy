# Quickstart — Migration Rollout Plans

## Prerequisites

- Supabase CLI installed (`supabase --version`)
- Local Supabase instance running (`supabase start`)
- Existing migration `20260628000001_create_reservation_model.sql` already applied
- Extension `btree_gist` already enabled

## Applying the Migrations

### 1. Apply the seed data migration

```bash
# The seed migration inserts sample rooms, guests, companies, and reservations
supabase migration up
```

This applies `20260628000002_seed_reservation_data.sql` (US1), which is safe to re-run (idempotent via `ON CONFLICT DO NOTHING`).

### 2. Apply the hold expiry migration

```bash
supabase migration up
```

This applies `20260628000003_hold_expiry_cleanup.sql` (US3), which creates:
- `expire_reservation_holds()` RPC
- pg_cron scheduled job running every 1 minute

If pg_cron is not available locally, the migration emits a warning but succeeds — hold cleanup will rely on the availability RPC filtering instead.

## Verifying the Deployment

### 3. Run the verification script

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
  -f supabase/migrations/scripts/verify-reservation-migration.sql
```

Expected output (excerpt):
```
psql:...:[PASS] btree_gist extension exists
psql:...:[PASS] reservations table exists
psql:...:[PASS] reservation_rooms table exists
...
psql:...:[PASS] get_room_availability function exists
psql:...:[PASS] confirm_reservation function exists
psql:...:[PASS] cancel_reservation function exists
psql:...:[PASS] rooms seed count: 14
psql:...:[PASS] guests seed count: 2
psql:...:[PASS] reservations seed count: 3
```

### 4. Verify seed data manually

```sql
-- Check room types
SELECT name, slug, base_price FROM public.room_types;

-- Check seeded rooms (should show 10 rooms)
SELECT number, floor, rt.name as type, status
FROM public.rooms r
JOIN public.room_types rt ON rt.id = r.room_type_id
ORDER BY r.number;

-- Check seeded guests
SELECT first_name, last_name, email FROM public.guests;

-- Check seeded reservations
SELECT reservation_number, booking_type, status, check_in_date, check_out_date
FROM public.reservations
ORDER BY check_in_date;

-- Check a reservation detail with rooms and pricing
SELECT r.reservation_number, rr.room_id, rr.status, rr.total_amount
FROM public.reservations r
JOIN public.reservation_rooms rr ON rr.reservation_id = r.id
WHERE r.reservation_number LIKE 'RSV-SEED-%';
```

## Testing Hold Expiry

```sql
-- 1. Create a short-lived hold (1 minute expiry)
INSERT INTO public.reservation_holds
  (reservation_id, room_id, held_by_user_id, check_in_date, check_out_date, expires_at)
VALUES (
  (SELECT id FROM public.reservations WHERE reservation_number = 'RSV-SEED-003'),
  (SELECT id FROM public.rooms WHERE number = '302'),
  (SELECT id FROM public.profiles LIMIT 1),
  CURRENT_DATE + 5,
  CURRENT_DATE + 8,
  now() + interval '1 minute'
);

-- 2. Wait 1+ minutes

-- 3. Check the hold status (should be 'expired' after pg_cron runs)
SELECT id, room_id, status, expires_at FROM public.reservation_holds
WHERE status = 'expired' AND room_id = (SELECT id FROM public.rooms WHERE number = '302');

-- 4. Verify the room is available again
SELECT * FROM public.get_room_availability(CURRENT_DATE + 5, CURRENT_DATE + 8);
```

## Resetting to a Clean State

```bash
supabase db reset
```

This drops all data and re-applies ALL migrations in order, including the seed data. Verify with the script above after reset.
