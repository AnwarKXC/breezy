# Contract: Cancel Reservation

**Route**: `POST /api/reservations/[id]/cancel`

**Permission**: `reservation:cancel`

Transitions `confirmed` or `held` → `cancelled`. Releases rooms.

### Request Body

```json
{
  "reason": "guest_request",
  "cancellationNotes": "Guest changed travel plans",
  "refundAmount": 50.00
}
```

### Response (200)

```json
{
  "data": {
    "id": "uuid",
    "status": "cancelled",
    "cancelledAt": "2026-07-01T09:00:00Z",
    "refundAmount": 50.00,
    "rooms": [
      {
        "roomId": "uuid",
        "roomNumber": "101",
        "status": "cancelled"
      }
    ]
  },
  "error": null
}
```
