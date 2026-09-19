# Quickstart: Availability RPC

**Feature**: 007-availability-service | **Phase**: 1 — Validation Guide

## Prerequisites

- Supabase local stack running (`supabase start`)
- Migration `20260628000001_create_reservation_model.sql` applied
- Migration `20260628000002_refine_reservation_rls.sql` applied (Phase 6 RLS)
- Sample data for rooms, room types, reservations, guests, company_price_overrides
- Supabase SQL Editor or `psql` access

## Setup

```sql
-- Apply the enhancement migration
-- Run via Supabase CLI:
-- supabase migration up
```

Or manually via SQL Editor:

```sql
-- Execute the contents of:
-- supabase/migrations/20260628000003_enhance_room_availability_rpc.sql
```

## Validation Scenarios

### Scenario 1: Basic availability — all rooms free

```sql
-- Expected: all rooms return with availability_status = 'available_for_full_stay'
-- and can_select = true
SELECT room_number, room_type_name, floor, capacity,
       availability_status, can_select,
       price_preview->>'ratePerNight' as rate,
       price_preview->>'totalAmount' as total,
       price_preview->>'currency' as currency,
       price_preview->>'priceSource' as price_source
FROM get_room_availability('2026-08-01', '2026-08-03')
ORDER BY room_number;
```

**Expected outcome**: All undeleted rooms appear. Each has `availability_status = 'available_for_full_stay'`, `can_select = true`, and a populated `price_preview`.

---

### Scenario 2: Booked room — full overlap

```sql
-- Pre-requisite: Create a reservation covering the full range for room 101
INSERT INTO reservations (id, reservation_number, status, check_in_date, check_out_date, primary_guest_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'RN-TEST-BOOKED', 'reserved', '2026-07-01', '2026-07-05', <guest_id>);

INSERT INTO reservation_rooms (id, reservation_id, room_id, check_in_date, check_out_date, status)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', <room_101_id>, '2026-07-01', '2026-07-05', 'reserved');

-- Query: room 101 should show as 'booked' with can_select = false
SELECT room_number, availability_status, can_select, select_disabled_reason, conflicts
FROM get_room_availability('2026-07-01', '2026-07-05')
WHERE room_number = '101';
```

**Expected outcome**: Room 101 returns `availability_status = 'booked'`, `can_select = false`, `select_disabled_reason` populated, and `conflicts` array with one entry of `conflictType = 'date_overlap'`.

---

### Scenario 3: Company pricing override

```sql
-- Pre-requisite: Create a company price override for a room type
INSERT INTO company_price_overrides (company_id, room_type_id, override_rate)
VALUES (<company_id>, <room_type_id>, 200.00);

-- Query with company context
SELECT room_number, price_preview
FROM get_room_availability(
  '2026-08-01', '2026-08-03',
  p_company_id => '<company_id>'
)
WHERE room_number = '101';
```

**Expected outcome**: Room 101's `price_preview.priceSource = 'company_override'` and `ratePerNight = 200.00`.

---

### Scenario 4: No matching filters — empty set

```sql
-- Use a non-existent room type UUID
SELECT count(*) as num_rooms
FROM get_room_availability(
  '2026-08-01', '2026-08-03',
  p_room_type_id => '00000000-0000-0000-0000-000000000000'
);
```

**Expected outcome**: Returns one row with `num_rooms = 0`. No error raised.

---

### Scenario 5: Invalid dates — error raised

```sql
-- check_in >= check_out
SELECT * FROM get_room_availability('2026-08-05', '2026-08-01');
```

**Expected outcome**: Raises exception: `Check-in date must be before check-out date`

---

### Scenario 6: Excessive stay — error raised

```sql
-- Stay > 90 days
SELECT * FROM get_room_availability('2026-01-01', '2026-05-01');
```

**Expected outcome**: Raises exception: `Maximum stay is 90 days`

---

### Scenario 7: Dirty room exclusion

```sql
-- Pre-requisite: Set a room to dirty status
UPDATE rooms SET housekeeping_status = 'dirty' WHERE room_number = '102';

-- Query without include_dirty (default)
SELECT room_number, availability_status, can_select, select_disabled_reason
FROM get_room_availability('2026-08-01', '2026-08-03')
WHERE room_number = '102';
```

**Expected outcome**: Room 102 returns `availability_status = 'available_after_cleaning'`, `can_select = false`.

---

### Scenario 8: Room type filter

```sql
-- Find all rooms of a specific type
SELECT rt.name as type_name, r.room_number, av.availability_status
FROM get_room_availability('2026-08-01', '2026-08-03', p_room_type_id => '<room_type_id>') av
JOIN rooms r ON r.id = av.room_id
JOIN room_types rt ON rt.id = r.room_type_id;
```

**Expected outcome**: Only rooms matching the given room_type_id are returned.

---

### Scenario 9: Company pricing fallback (no override)

```sql
-- Query with a company that has NO override for the room type
SELECT room_number, price_preview
FROM get_room_availability(
  '2026-08-01', '2026-08-03',
  p_company_id => '<company_without_override_id>'
)
WHERE room_number = '101';
```

**Expected outcome**: Room 101 returns `price_preview.priceSource = 'default_rate'` with the room type's `default_rate`. No error.

---

### Scenario 10: Active hold detection

```sql
-- Pre-requisite: Create an active hold for room 103
INSERT INTO reservation_holds (id, room_id, check_in_date, check_out_date, status, expires_at)
VALUES ('00000000-0000-0000-0000-000000000003', <room_103_id>, '2026-07-01', '2026-07-03', 'active', now() + interval '1 day');

-- Query: room 103 should show as 'booked' with conflict type 'active_hold'
SELECT room_number, availability_status, can_select, conflicts
FROM get_room_availability('2026-07-01', '2026-07-03')
WHERE room_number = '103';
```

**Expected outcome**: Room 103 returns `availability_status = 'booked'` or appropriate status, with a conflict entry where `conflictType = 'active_hold'`.

## Running All Scenarios

Execute each scenario block in order through the Supabase SQL Editor. Verify expected outcomes before proceeding to the next scenario. Clean up test data after validation:

```sql
-- Cleanup test data
DELETE FROM reservation_rooms WHERE reservation_id IN ('00000000-0000-0000-0000-000000000001');
DELETE FROM reservations WHERE id = '00000000-0000-0000-0000-000000000001';
DELETE FROM reservation_holds WHERE id = '00000000-0000-0000-0000-000000000003';
```

## Verification Checklist

- [ ] All rooms return with correct `availability_status`
- [ ] `can_select` matches the availability truth table
- [ ] `price_preview` is non-null for all rows
- [ ] `conflicts` is an empty array `[]` for available rooms
- [ ] Invalid dates raise clear errors
- [ ] Excessive stays are rejected
- [ ] Empty filters return zero rows (not error)
- [ ] Company pricing overrides are reflected correctly
- [ ] Fallback to default rate works when no override exists
- [ ] Dirty/maintenance rooms are excluded by default
- [ ] Room type and capacity filters work correctly
