# Contract: Holds

## POST `/api/reservations/[id]/holds`

**Permission**: `bookings:write`

Creates a hold on a room for a reservation.

### Request Body

```json
{
  "roomId": "uuid",
  "checkInDate": "2026-07-01",
  "checkOutDate": "2026-07-03"
}
```

### Response (201)

```json
{
  "data": {
    "id": "uuid",
    "roomId": "uuid",
    "roomNumber": "101",
    "status": "active",
    "expiresAt": "2026-06-28T10:30:00Z",
    "remainingMinutes": 30
  },
  "error": null
}
```

## DELETE `/api/reservations/[id]/holds`

**Permission**: `bookings:write`

Releases a hold.

### Request Body

```json
{
  "holdId": "uuid"
}
```

### Behavior

- Auto-expiry via cron job or Supabase pg_cron: runs every 5 minutes,
  expires holds where `expires_at < now()` and `status = 'active'`
- Hold duration: 30 minutes (configurable via `HOLD_DURATION_MINUTES`)
