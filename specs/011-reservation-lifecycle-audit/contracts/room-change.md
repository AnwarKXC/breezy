# Contract: Room Change

## POST /api/reservations/[id]/rooms

Add a new room to a reservation (for multi-room or room change).

### Permission
`reservation:change_room` — front desk + manager

### Request Body
```json
{
  "roomId": "uuid",
  "roomTypeId": "uuid",
  "checkInDate": "2026-07-10",
  "checkOutDate": "2026-07-13",
  "adults": 2,
  "assignedGuestId": "uuid"
}
```

### Response (201)
```json
{
  "data": {
    "id": "uuid",
    "roomId": "uuid",
    "status": "reserved",
    "checkInDate": "2026-07-10",
    "checkOutDate": "2026-07-13"
  }
}
```

## DELETE /api/reservations/[id]/rooms/[reservationRoomId]

Remove a room from a reservation (release).

### Permission
`reservation:change_room` — front desk + manager

### Response (200)
```json
{
  "success": true,
  "reservationId": "uuid"
}
```

### Validation Rules (all operations)
- Reservation must be in `confirmed` or `checked_in` status
- Target room must exist and be active
- Target room must not be `out_of_order` unless override permission exists
- No date overlap conflicts with existing active reservations/holds on target room
- Room capacity must be sufficient for guest count

### Room Change Transaction (complete move: add + remove old)
1. Validate target room availability for dates
2. Insert new `reservation_rooms` row with status `reserved` or `occupied`
3. Update old `reservation_rooms.status` to `released` (soft delete)
4. Write audit events `room.changed` (with old and new room IDs)
5. Update reservation `updated_at`
