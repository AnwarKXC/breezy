# Contract: No-Show Marking

## POST /api/reservations/[id]/no-show

### Permission
`reservation:no_show` — manager/admin only (not front desk)

### Request Body
```json
{
  "reason": "Guest did not arrive"
}
```

### Response (200)
```json
{
  "data": {
    "id": "uuid",
    "reservationNumber": "RSV-1004",
    "status": "no_show",
    "checkedOutAt": null
  }
}
```

### Response (400) — Validation Error
```json
{
  "error": "Cannot mark no-show: reservation must be in confirmed status"
}
```

### Response (400) — Grace Period Not Met
```json
{
  "error": "Cannot mark no-show: checkout time was less than 2 hours ago"
}
```

### Response (403) — Permission Denied
```json
{
  "error": "Permission denied: reservation:no_show"
}
```

### Service Method
```ts
markNoShow(reservationId: string, userId: string, reason?: string): Promise<Reservation>
```

### Validation Rules
- Reservation status MUST be `confirmed`
- Current time MUST be past scheduled checkout time + grace period (default 2 hours)
- No-show grace period is configurable

### Database Operations (transactional)
1. Insert `reservation_status_history` (confirmed → no_show)
2. Update `reservation_rooms.status` to `cancelled` (release rooms)
3. Update `reservations.status` to `no_show`
4. Write audit event `reservation.no_show`

### Post-conditions
- Reservation becomes historical (terminal state)
- All rooms released
- If payments exist, system marks them as pending refund (actual refund is separate operation)
