# Contract: Stay Extension

## POST /api/reservations/[id]/extend

Extend a reservation's stay to a later checkout date.

### Permission
`reservation:extend_stay` — front desk + manager

### Request Body
```json
{
  "newCheckOutDate": "2026-07-15"
}
```

### Response (200)
```json
{
  "data": {
    "id": "uuid",
    "reservationNumber": "RSV-1004",
    "checkOutDate": "2026-07-15",
    "nights": 5,
    "status": "confirmed"
  }
}
```

### Response (400) — Conflict
```json
{
  "error": "Cannot extend: room is reserved for July 14–July 16 by reservation RSV-1012",
  "conflicts": [
    {
      "reservationId": "uuid",
      "reservationNumber": "RSV-1012",
      "conflictDates": { "from": "2026-07-14", "to": "2026-07-16" }
    }
  ]
}
```

### Validation Rules
- `newCheckOutDate` MUST be after current `checkOutDate`
- Reservation MUST be in `confirmed` or `checked_in` status
- Target room(s) MUST be available for the extension period
- If conflict exists, block with details of conflicting reservation
- Re-pricing for extension is handled by calling `recalculateReservationPricing` stub (separate service)

### Service Method
```ts
extendReservationStay(
  reservationId: string,
  newCheckOutDate: string,
  userId: string
): Promise<Reservation>
```

### Transaction
1. Recalculate new `nights` count
2. Validate room availability for extension dates
3. Update `reservation_rooms.check_out_date` and `nights`
4. Update `reservations.check_out_date` and `nights`
5. Insert `reservation_status_history` entry
6. Write audit event with old/new checkout dates
