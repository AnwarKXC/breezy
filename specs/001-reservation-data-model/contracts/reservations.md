# Contract: Reservations CRUD

## POST `/api/reservations`

**Permission**: `bookings:write`

Creates a reservation draft.

### Request Body

```json
{
  "bookingType": "individual",
  "source": "walk_in",
  "guestId": "uuid",
  "guestName": "John Doe",
  "checkIn": "2026-07-01",
  "checkOut": "2026-07-03",
  "adults": 2,
  "children": 0,
  "roomId": "uuid",
  "currency": "USD",
  "specialRequests": "Late check-in requested",
  "billingParty": "guest",
  "guaranteeType": "credit_card"
}
```

### Response (201)

```json
{
  "data": {
    "id": "uuid",
    "reservationNumber": "RSV-1001",
    "status": "draft",
    ...
  },
  "error": null
}
```

---

## GET `/api/reservations`

**Permission**: `bookings:read`

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `page` | integer | no | Default: 1 |
| `limit` | integer | no | Max: 100, Default: 20 |
| `status` | string | no | Filter by status |
| `search` | string | no | Search guest name, number |
| `checkInFrom` | string | no | ISO date |
| `checkInTo` | string | no | ISO date |
| `roomId` | string | no | Filter by room |
| `sortBy` | string | no | `check_in`, `created_at`, `guest_name` |
| `sortOrder` | string | no | `asc`, `desc` |

### Response

```json
{
  "data": {
    "reservations": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  },
  "error": null
}
```

---

## GET `/api/reservations/[id]`

**Permission**: `bookings:read`

### Response

```json
{
  "data": {
    "id": "uuid",
    "reservationNumber": "RSV-1001",
    "status": "confirmed",
    "bookingType": "company",
    "source": "company",
    "guest": { ... },
    "rooms": [ ... ],
    "guests": [ ... ],
    "companyInfo": { ... },
    "pricingItems": [ ... ],
    "payments": [ ... ],
    "holds": [ ... ],
    "notes": [ ... ],
    "statusHistory": [ ... ],
    "totals": {
      "subtotal": 400.00,
      "discount": -20.00,
      "tax": 40.00,
      "service": 0,
      "total": 420.00,
      "paid": 100.00,
      "balance": 320.00
    },
    "createdAt": "2026-06-28T10:00:00Z",
    "updatedAt": "2026-06-28T10:05:00Z"
  },
  "error": null
}
```

---

## PATCH `/api/reservations/[id]`

**Permission**: `bookings:write`

Partial update. Only provided fields are changed.

---

## DELETE `/api/reservations/[id]`

**Permission**: `bookings:write`

Soft delete (sets `deleted_at`). Only allowed when status is `draft`.
