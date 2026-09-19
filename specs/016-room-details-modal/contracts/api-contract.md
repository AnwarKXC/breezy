# API Contract: `GET /api/rooms/:id/details-with-history`

## Endpoint

```
GET /api/rooms/{id}/details-with-history?limit=100&cursor={cursor}
```

## Authentication

Requires valid session cookie. Responds 401 if unauthenticated, 403 if role lacks `rooms:read` permission.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | yes | Room ID |

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | integer | no | 100 | Max history events to return |
| cursor | string | no | null | Pagination cursor (encoded timestamp + id) |

## Response `200 OK`

Content-Type: `application/json`

Response body: `RoomDetailsWithHistory` (see data-model.md)

### Example Response

```json
{
  "room": {
    "id": "uuid",
    "roomNumber": "204",
    "roomTypeId": "uuid",
    "roomTypeName": "Deluxe King",
    "floor": "2",
    "capacity": 2,
    "physicalStatus": "occupied"
  },
  "currentReservation": {
    "reservationId": "uuid",
    "reservationNumber": "RSV-20260626-A1B2C3",
    "bookingType": "individual",
    "status": "checked_in",
    "guestName": "Ahmed Ali",
    "checkInDate": "2026-06-26",
    "checkOutDate": "2026-06-30",
    "nights": 4,
    "adults": 1,
    "children": 0,
    "billingParty": "guest",
    "paymentStatus": "partial",
    "balanceAmount": 200.00
  },
  "availability": {
    "availableNow": false,
    "availableFrom": "2026-06-30T12:00:00Z",
    "unavailableReason": "Room occupied until June 30"
  },
  "history": [],
  "historyTotal": 15
}
```

## Response `404 Not Found`

```json
{ "error": "Room not found" }
```

## Response `401 Unauthorized`

```json
{ "error": "Authentication required" }
```

## Response `403 Forbidden`

```json
{ "error": "Insufficient permissions" }
```

## Performance

- Target: <300ms p95 for the combined response
- History queries limited to 100 rows by default
- All data from indexed columns (room_id, reservation_id)
