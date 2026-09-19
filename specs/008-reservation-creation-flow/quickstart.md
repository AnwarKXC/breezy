# Quickstart: Reservation Creation and Hold Flow

**Feature**: 008-reservation-creation-flow | **Phase**: 1 — Validation Guide

## Prerequisites

- Supabase local stack running (`supabase start`)
- Migration `20260628000001_create_reservation_model.sql` applied
- Migration `20260628000002_refine_reservation_rls.sql` applied (Phase 6 RLS)
- Migration `20260628000003_enhance_room_availability_rpc.sql` applied (Phase 7)
- Sample data for rooms, guests, room_types
- Supabase SQL Editor or `psql` access

## Setup

```sql
-- Apply the migration
-- Via CLI: supabase migration up
-- Or execute: supabase/migrations/20260628000004_reservation_creation_hold_flow.sql
```

## Validation Scenarios

### Scenario 1: Create draft reservation with holds

```sql
-- Expected: Draft reservation created + active holds for both rooms
SELECT * FROM create_draft_reservation(
  p_primary_guest_id => '<guest_uuid>',
  p_check_in_date    => '2026-08-01',
  p_check_out_date   => '2026-08-03',
  p_room_ids         => ARRAY['<room_101_uuid>', '<room_102_uuid>'],
  p_adults           => 2
);
```

**Expected outcome**: Returns `{"success": true, "reservationId": "...", "reservationNumber": "RN-...", "holdIds": [...], "status": "draft"}`. Reservation exists with `status = 'draft'`. Two holds exist with `status = 'active'` and `expires_at = now() + 30 minutes`.

---

### Scenario 2: Availability shows held rooms

```sql
-- Query availability after holds created
-- Rooms from Scenario 1 should show as held
SELECT room_number, availability_status, can_select, conflicts
FROM get_room_availability('2026-08-01', '2026-08-03')
WHERE room_number IN ('101', '102');
```

**Expected outcome**: Both rooms return with `availability_status` reflecting the hold (via Phase 7 RPC), `can_select = true` (same user's holds are selectable), and a conflict entry with `conflictType = 'active_hold'`.

---

### Scenario 3: Collision — second user cannot hold same room

```sql
-- Simulate a second user trying to hold the same room
-- (In SQL Editor, this runs as the same user; in practice this tests different auth.uid())
SELECT * FROM create_draft_reservation(
  p_primary_guest_id => '<guest_uuid>',
  p_check_in_date    => '2026-08-01',
  p_check_out_date   => '2026-08-03',
  p_room_ids         => ARRAY['<room_101_uuid>']
);
```

**Expected outcome**: Returns error indicating the room has an active hold by another user. The conflicting room UUID is listed in `failedRoomIds`.

---

### Scenario 4: Release a hold

```sql
-- Release one hold from Scenario 1
SELECT * FROM release_hold(
  p_hold_id => '<hold_uuid_from_scenario_1>'
);
```

**Expected outcome**: Returns `{"success": true, "holdId": "...", "previousStatus": "active", "newStatus": "released"}`. The released room now shows as `available_for_full_stay` in availability queries.

---

### Scenario 5: Release hold — wrong owner rejected

```sql
-- Attempt release by a non-owner user
-- (Authorization check; same SQL with different auth.uid())
SELECT * FROM release_hold(
  p_hold_id => '<hold_owned_by_another_user>'
);
```

**Expected outcome**: Raises permission exception `42501` — "Not authorized to release this hold".

---

### Scenario 6: Confirm reservation — success

```sql
-- Confirm the draft from Scenario 1
SELECT * FROM confirm_reservation(
  p_reservation_id => '<reservation_uuid_from_scenario_1>'
);
```

**Expected outcome**: Returns `{"success": true, "reservationId": "...", "previousStatus": "draft", "newStatus": "held", "roomIds": [...]}`. Reservation status changes to `held`. Reservation_room records created with `status = 'held'`. Status history and audit log entries written.

---

### Scenario 7: Confirm reservation — expired hold rejected

```sql
-- Create a draft, let hold expire, then try to confirm
-- (Hold expiry simulated by updating expires_at to past)
UPDATE reservation_holds SET expires_at = now() - interval '1 minute'
WHERE reservation_id = '<draft_uuid>';

SELECT * FROM confirm_reservation(
  p_reservation_id => '<draft_uuid>'
);
```

**Expected outcome**: Returns failure with `failedChecks` containing entries with `checkType = 'hold_expired'`. Reservation remains in `draft` status. No room assignments created.

---

### Scenario 8: Confirm reservation — new date conflict

```sql
-- Create another reservation that overlaps the draft's dates for one room
-- Then try to confirm the draft
-- Pre-condition: insert a conflicting reservation for the same room and dates

SELECT * FROM confirm_reservation(
  p_reservation_id => '<draft_with_conflict_uuid>'
);
```

**Expected outcome**: Returns failure with `failedChecks` containing entry with `checkType = 'date_overlap'`. Transaction fully rolled back.

---

### Scenario 9: Audit log entries

```sql
-- Verify audit entries after a successful confirmation
SELECT action, entity_type, actor_id, details
FROM audit_log
WHERE entity_id = '<reservation_uuid>'
ORDER BY created_at;
```

**Expected outcome**: At least 4 entries: `reservation.draft_created`, `reservation_hold.created` (x2 for 2 rooms), `reservation.confirmed`.

---

### Scenario 10: Maintained/blocked room prevented

```sql
-- Pre-condition: Set room 103 to maintenance
UPDATE rooms SET physical_status = 'maintenance' WHERE room_number = '103';

-- Try to create draft with this room
SELECT * FROM create_draft_reservation(
  p_primary_guest_id => '<guest_uuid>',
  p_check_in_date    => '2026-08-01',
  p_check_out_date   => '2026-08-03',
  p_room_ids         => ARRAY['<room_103_uuid>']
);
```

**Expected outcome**: Returns failure listing the maintenance room in `failedRoomIds`. No draft or holds created.

## Running All Scenarios

Execute scenarios in order through Supabase SQL Editor. Replace `<placeholders>` with actual UUIDs from your test data. Clean up test data after validation.

## Verification Checklist

- [ ] Draft reservation creates with correct status and holds
- [ ] Held rooms visible in availability query with `active_hold` conflict type
- [ ] Concurrent hold collision correctly rejected
- [ ] Hold release works for owner, rejected for non-owner
- [ ] Successful confirmation changes status, creates room assignments, writes audit
- [ ] Expired hold blocks confirmation
- [ ] New date conflict blocks confirmation
- [ ] Maintenance/blocked rooms rejected at draft creation
- [ ] Audit log entries created for all operations
- [ ] All-or-nothing rollback on confirmation failure
