# Quickstart: Supabase Schema Design

This guide walks through applying and verifying the reservation schema migration.

## Prerequisites

- Supabase CLI installed and authenticated
- Supabase local stack running OR access to a remote Supabase project
- Migration file at `supabase/migrations/20260628000001_create_reservation_model.sql`

## Step 1: Apply Migration (Local)

```bash
# Start local Supabase stack
supabase start

# Apply the pending migration
supabase migration up
```

The single migration creates all 9 reservation tables, room_status_history, enums, indexes, RLS policies, and RPC functions.

## Step 2: Verify Schema

```sql
-- Confirm all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'reservation_%' OR table_name = 'room_status_history')
ORDER BY table_name;

-- Confirm enums
SELECT t.typname, e.enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname LIKE 'reservation_%' OR t.typname = 'price_source' OR t.typname = 'room_physical_status'
ORDER BY t.typname, e.enumsortorder;

-- Confirm FK constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name LIKE 'reservation_%' OR tc.table_name = 'room_status_history');

-- Confirm RLS is enabled
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND (c.relname LIKE 'reservation_%' OR c.relname = 'room_status_history')
ORDER BY c.relname;
```

## Step 3: Test RPC Functions

```sql
-- Check room availability
SELECT * FROM public.get_room_availability(
  p_check_in_date := CURRENT_DATE + 1,
  p_check_out_date := CURRENT_DATE + 3
);

-- Insert a draft reservation (requires valid guest, profile, and room references)
INSERT INTO public.reservations (
  booking_type, check_in_date, check_out_date, nights, adults, created_by
) VALUES (
  'individual',
  CURRENT_DATE + 10,
  CURRENT_DATE + 13,
  3,
  1,
  (SELECT id FROM public.profiles LIMIT 1)
) RETURNING id, reservation_number, status;
```

## Step 4: Verify RLS

Test that RLS blocks unauthorized access:

```sql
SET ROLE anon;
SELECT * FROM public.reservations LIMIT 1;
-- Expect: ERROR: permission denied

SET ROLE authenticated;
SELECT public.can_read_reservations();
-- Expect: true or false depending on current user's app_role
```

## Troubleshooting

- **btree_gist not found**: Ensure the extension install succeeds. Requires superuser or migration context.
- **RLS blocking everything**: Verify user's `app_role` matches the policy helpers. Run `SELECT public.current_app_role()`.
- **FK violation on insert**: Insert parent records (profiles, guests, rooms) before referencing them from reservation tables.
- **Exclusion constraint violation**: Occurs when a room assignment overlaps an existing active assignment. Use `get_room_availability` first to check.

