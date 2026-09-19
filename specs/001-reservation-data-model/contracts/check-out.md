# Contract: Check-Out

**Route**: `POST /api/reservations/[id]/check-out`

**Permission**: `reservation:check_out`

Transitions `checked_in` → `checked_out`. Resolves balance.

### Request Body

```json
{
  "finalPaymentMethod": "card",
  "settleBalance": true,
  "notes": "Guest checked out early"
}
```

### Response (200)

```json
{
  "data": {
    "id": "uuid",
    "status": "checked_out",
    "checkedOutAt": "2026-07-03T10:30:00Z",
    "finalTotal": 420.00,
    "totalPaid": 420.00,
    "balance": 0
  },
  "error": null
}
```
