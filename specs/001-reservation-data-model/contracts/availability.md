# Contract: Room Availability

**Route**: `GET /api/reservations/availability`

**Permission**: `bookings:read`

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `checkIn` | string | yes | ISO date `YYYY-MM-DD` |
| `checkOut` | string | yes | ISO date `YYYY-MM-DD` |
| `adults` | integer | no | Default: 1 |
| `children` | integer | no | Default: 0 |
| `roomTypeId` | string | no | Filter by room type UUID |
| `companyId` | string | no | Include company rate overrides |
| `excludeReservationId` | string | no | Exclude rooms from this reservation |

## Response

```json
{
  "data": {
    "checkIn": "2026-07-01",
    "checkOut": "2026-07-03",
    "nights": 2,
    "availableRooms": [
      {
        "roomId": "uuid",
        "roomNumber": "101",
        "roomTypeId": "uuid",
        "roomTypeName": "Deluxe King",
        "maxAdults": 2,
        "maxChildren": 1,
        "ratePerNight": 200.00,
        "currency": "USD",
        "priceSource": "default_room_type_rate",
        "features": ["sea_view", "balcony"]
      }
    ],
    "totalRoomTypes": 5,
    "totalAvailableRooms": 12
  },
  "error": null
}
```
