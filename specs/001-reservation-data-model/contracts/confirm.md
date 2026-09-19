# Contract: Confirm Reservation

**Route**: `POST /api/reservations/[id]/confirm`

**Permission**: `reservation:confirm`

Transitions reservation status from `draft` or `held` to `confirmed`.

Transactional RPC: creates `reservation_rooms`, `reservation_guests`,
checks no double booking via exclusion constraint.

### Request Body

```json
{
  "guaranteeType": "credit_card",
  "paymentMethod": "card",
  "paymentAmount": 100.00
}
```

### Response (200)

```json
{
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "reservationNumber": "RSV-1001",
    "rooms": [ ... ]
  },
  "error": null
}
```

### Error Cases

| Code | Condition |
|------|-----------|
| `ROOM_NOT_AVAILABLE` | Room(s) no longer available |
| `HOLD_EXPIRED` | Hold expired before confirmation |
| `INVALID_STATUS_TRANSITION` | Cannot confirm from current status |
| `PAYMENT_FAILED` | Payment processing failed |
