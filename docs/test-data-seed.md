# Test Data Seed Guide

> **⚠️ SAFETY: Only run seed operations against staging/test Supabase projects. Never run against production.**

## Overview

The E2E tests require specific test data in Supabase. This document describes what data is needed and how to create it safely.

## Required Test Accounts

The following accounts must exist in your test Supabase project:

| Role | Email (default) | Profiles.role |
|------|----------------|---------------|
| Guest | `guest@hotel.test` | N/A (no profile needed for guest auth users) |
| Admin | `admin@hotel.test` | `admin` |
| Front Desk | `frontdesk@hotel.test` | `front_desk` |
| Accountant | `accountant@hotel.test` | `accountant` |

### Creating Test Accounts

**Step 1: Create auth users**

Go to Supabase Dashboard → Authentication → Users → Add User.
Or use the SQL Editor with `supabase.auth.admin.createUser()` via the service role.

**Step 2: Create profiles**

For each auth user, insert a matching profile:

```sql
INSERT INTO public.profiles (id, name, email, role)
VALUES
  ('<AUTH_USER_ID>', 'Test Admin', 'admin@hotel.test', 'admin');
```

Replace `<AUTH_USER_ID>` with the UUID from the auth.users table.

## Room Types

The application seeds 4 default room types in migration 8. If you need to re-seed:

```sql
INSERT INTO public.room_types (name, slug, description, base_price, default_capacity)
VALUES
  ('Standard', 'standard', 'Standard room with basic amenities', 100.00, 2),
  ('Deluxe', 'deluxe', 'Deluxe room with premium amenities', 180.00, 2),
  ('Suite', 'suite', 'Spacious suite with living area', 350.00, 4),
  ('Family', 'family', 'Family room with multiple beds', 250.00, 4)
ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;
```

## Rooms

```sql
-- Insert sample rooms (adjust room_type_id to match your data)
INSERT INTO public.rooms (number, floor, status, price, capacity, room_type_id)
SELECT '101', 1, 'available', 100.00, 2, id FROM public.room_types WHERE slug = 'standard'
UNION ALL
SELECT '102', 1, 'available', 100.00, 2, id FROM public.room_types WHERE slug = 'standard'
UNION ALL
SELECT '201', 2, 'available', 180.00, 2, id FROM public.room_types WHERE slug = 'deluxe'
UNION ALL
SELECT '301', 3, 'available', 350.00, 4, id FROM public.room_types WHERE slug = 'suite';
```

## Sample Bookings

```sql
INSERT INTO public.bookings (guest_id, guest_name, room_id, room_number, check_in, check_out, status, total_amount, paid_amount)
SELECT
  g.id, g.first_name || ' ' || g.last_name,
  r.id, r.number,
  '2026-07-01 14:00:00+00'::timestamptz,
  '2026-07-03 11:00:00+00'::timestamptz,
  'confirmed', r.price * 2, 0
FROM public.guests g, public.rooms r
LIMIT 1;
```

## Resetting Test Data

To reset test data between runs, use the Supabase Dashboard SQL Editor with caution:

```sql
-- Delete test bookings
DELETE FROM public.bookings WHERE guest_name LIKE 'Test%';

-- Delete test guests
DELETE FROM public.guests WHERE email LIKE 'test-%@hotel.test';

-- Reset rooms to available
UPDATE public.rooms SET status = 'available' WHERE status = 'occupied';
```

## Automated Seed Script (Future)

A future improvement would be a TypeScript script at `scripts/seed-e2e-data.ts` that:

1. Uses the Supabase service role client
2. Creates auth users via Admin API
3. Inserts profiles, room types, rooms, and sample bookings
4. Is safe to run multiple times (idempotent)

## Environment Variables for Seeding

```bash
# .env.seed (never commit)
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```
