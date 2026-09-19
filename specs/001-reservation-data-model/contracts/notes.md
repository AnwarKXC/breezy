# Contract: Notes

## POST `/api/reservations/[id]/notes`

**Permission**: `bookings:write`

Adds a note to a reservation.

### Request Body

```json
{
  "type": "front_desk",
  "visibility": "internal",
  "message": "Guest prefers top floor, quiet room"
}
```

### Response (201)

```json
{
  "data": {
    "id": "uuid",
    "type": "front_desk",
    "visibility": "internal",
    "message": "Guest prefers top floor, quiet room",
    "createdBy": "uuid",
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "error": null
}
```

## GET `/api/reservations/[id]/notes`

**Permission**: `bookings:read`

Returns all notes for a reservation, ordered by `created_at desc`.
