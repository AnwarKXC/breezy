# Contracts: Reservation Creation and Hold Flow RPCs

**Feature**: 008-reservation-creation-flow | **Phase**: 1 — Contract Definitions

## RPC 1: `create_draft_reservation`

Creates a draft reservation and active holds for selected rooms in a single transaction.

### Signature

```sql
create or replace function public.create_draft_reservation(
  p_primary_guest_id   uuid,
  p_check_in_date      date,
  p_check_out_date     date,
  p_room_ids           uuid[],
  p_company_id         uuid      default null,
  p_adults             int       default null,
  p_children           int       default null,
  p_notes              text      default null
)
returns jsonb
language plpgsql
strict
security definer
set search_path = public;
```

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_primary_guest_id` | uuid | ✅ | Existing guest record |
| `p_check_in_date` | date | ✅ | Start of stay |
| `p_check_out_date` | date | ✅ | End of stay (must be > check_in) |
| `p_room_ids` | uuid[] | ✅ | Array of room UUIDs to hold |
| `p_company_id` | uuid | ❌ | Company context |
| `p_adults` | int | ❌ | Adult count |
| `p_children` | int | ❌ | Child count |
| `p_notes` | text | ❌ | Operational notes |

### Return Value

On success:
```json
{
  "success": true,
  "reservationId": "uuid",
  "reservationNumber": "RN-001",
  "holdIds": ["uuid-1", "uuid-2"],
  "status": "draft"
}
```

On failure:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "failedRoomIds": ["uuid-conflicting-room"]
}
```

### Validation

| Check | Failure Behavior |
|-------|-----------------|
| Guest exists | Return error |
| check_in < check_out | Return error |
| All room_ids exist | Return error listing invalid room IDs |
| No room is maintenance/out_of_order | Return error listing blocked room IDs |
| No conflicting active holds (other users) | Return error listing conflicted room IDs |
| Permission: current user has can_write_reservations() | Raise 42501 exception |

---

## RPC 2: `release_hold`

Releases an active hold, making the room available immediately.

### Signature

```sql
create or replace function public.release_hold(
  p_hold_id  uuid
)
returns jsonb
language plpgsql
strict
security definer
set search_path = public;
```

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_hold_id` | uuid | ✅ | ID of the hold to release |

### Return Value

On success:
```json
{
  "success": true,
  "holdId": "uuid",
  "previousStatus": "active",
  "newStatus": "released"
}
```

On failure:
```json
{
  "success": false,
  "error": "Hold not found or already released"
}
```

### Validation

| Check | Failure Behavior |
|-------|-----------------|
| Hold exists | Return error |
| Hold is currently active | Return error (cannot release expired/released) |
| Hold owner matches current user | Raise 42501 exception |
| Permission: current user has can_write_reservations() | Raise 42501 exception |

---

## RPC 3: `confirm_reservation`

Atomically confirms a draft reservation. Re-validates all conditions, converts holds to room assignments, updates status, writes history and audit logs.

### Signature

```sql
create or replace function public.confirm_reservation(
  p_reservation_id  uuid
)
returns jsonb
language plpgsql
strict
security definer
set search_path = public;
```

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_reservation_id` | uuid | ✅ | ID of the draft reservation to confirm |

### Return Value

On success:
```json
{
  "success": true,
  "reservationId": "uuid",
  "reservationNumber": "RN-001",
  "previousStatus": "draft",
  "newStatus": "held",
  "roomIds": ["uuid-1", "uuid-2"]
}
```

On failure:
```json
{
  "success": false,
  "error": "Summary error message",
  "failedChecks": [
    {
      "roomId": "uuid",
      "reason": "Hold has expired for room 101",
      "checkType": "hold_expired"
    },
    {
      "roomId": "uuid",
      "reason": "Room 102 is now under maintenance",
      "checkType": "room_unavailable"
    },
    {
      "roomId": "uuid",
      "reason": "Room 103 has a new date conflict with reservation RN-045",
      "checkType": "date_overlap"
    }
  ]
}
```

### Atomic Operations (in order)

1. Lock the reservation row (`SELECT ... FOR UPDATE`)
2. Validate reservation is in `draft` status
3. Validate all holds are active and owned by current user
4. Validate no date overlaps exist (re-check availability)
5. Validate no rooms are under maintenance/out_of_order
6. Update hold statuses to `released` (or delete if not needed)
7. Insert reservation_room records with status `held`
8. Update reservation status to `held`
9. Insert reservation_status_history entry
10. Insert audit_log entries

If ANY step fails, the entire transaction is rolled back and the error response details per-room failures.

### Validation

| Check | Failure Behavior |
|-------|-----------------|
| Reservation exists | Return error |
| Reservation is in `draft` status | Return error |
| All holds are active (not expired/released) | Add to failedChecks with checkType `hold_expired` |
| Holds owned by current user | Add to failedChecks |
| No new date overlaps detected | Add to failedChecks with checkType `date_overlap` |
| No rooms under maintenance/out_of_order | Add to failedChecks with checkType `room_unavailable` |
| Permission: current user has can_write_reservations() | Raise 42501 exception |
