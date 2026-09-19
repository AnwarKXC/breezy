# Contract: Price Override

**Route**: `PATCH /api/reservations/[id]/override-price`

**Permission**: `reservation:override_price` (admin only)

### Request Body

```json
{
  "reservationRoomId": "uuid",
  "ratePerNight": 150.00,
  "reason": "Corporate discount - VIP return guest",
  "effectiveDate": "2026-07-01"
}
```

### Response (200)

```json
{
  "data": {
    "reservationRoomId": "uuid",
    "previousRate": 200.00,
    "newRate": 150.00,
    "totalChange": -100.00,
    "auditEntry": {
      "action": "price_override",
      "reason": "Corporate discount - VIP return guest",
      "changedBy": "uuid"
    }
  },
  "error": null
}
```

### Audit

All price overrides are logged to `reservation_pricing_items` with
`price_source = 'manual_override'`, `manual_override_reason`, and
`manual_override_by`. Also logged to `audit_log` table.
