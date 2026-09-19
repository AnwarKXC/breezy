# Contract: Status / Room History

## GET `/api/reservations/[id]/history`

**Permission**: `bookings:read`

Returns `reservation_status_history` for the given reservation.

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "fromStatus": null,
      "toStatus": "draft",
      "reason": "Walk-in booking created",
      "changedBy": "uuid",
      "changedByName": "Alice",
      "changedAt": "2026-06-28T10:00:00Z"
    },
    {
      "id": "uuid",
      "fromStatus": "draft",
      "toStatus": "confirmed",
      "reason": "Booking confirmed with deposit",
      "changedBy": "uuid",
      "changedByName": "Alice",
      "changedAt": "2026-06-28T10:05:00Z"
    }
  ],
  "error": null
}
```

## GET `/api/rooms/[id]/history`

**Permission**: `bookings:read`

Returns `room_status_history` for a specific room.

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `from` | string | no | ISO date filter start |
| `to` | string | no | ISO date filter end |
