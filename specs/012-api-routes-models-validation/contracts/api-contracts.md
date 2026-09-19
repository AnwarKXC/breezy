# API Contracts: Reservation Routes

Base path: `/api/reservations`

All endpoints return JSON. Authentication via Bearer token or cookie session (handled by `secureEndpoint` wrappers).

## 1. List Reservations

```
GET /api/reservations
  ?cursor=<string>
  &limit=<number>
  &status=<string>
  &dateFrom=<ISO-date>
  &dateTo=<ISO-date>
  &guestName=<string>
  &bookingType=<string>
  &companyId=<uuid>

Response 200:
{
  "data": Reservation[],
  "hasMore": boolean,
  "nextCursor": string | null
}
```

**Action**: `BOOKINGS_READ` | **Rate tier**: READ (100/min)

## 2. Get Reservation by ID

```
GET /api/reservations/:id

Response 200:
{
  ...Reservation,
  "rooms": ReservationRoom[],
  "guests": ReservationGuest[],
  "payments": ReservationPayment[],
  "companyInfo": ReservationCompanyInfo | null,
  "notes": ReservationNote[],
  "statusHistory": ReservationStatusHistory[]
}

Response 404:
{ "error": "reservations/not_found" }
```

**Action**: `BOOKINGS_READ` | **Rate tier**: READ (100/min)

## 3. Create Reservation Draft

```
POST /api/reservations
Content-Type: application/json

Body: CreateReservationInput

Response 201:
{ "data": Reservation }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }
```

**Action**: `BOOKINGS_WRITE` | **Rate tier**: MUTATION (30/min)

## 4. Update Reservation Draft

```
PATCH /api/reservations/:id
Content-Type: application/json

Body: UpdateReservationInput

Response 200:
{ "data": Reservation }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }

Response 404:
{ "error": "reservations/not_found" }
```

**Action**: `BOOKINGS_WRITE` | **Rate tier**: MUTATION (30/min)

## 5. Hold Rooms

```
POST /api/reservations/:id/hold
Content-Type: application/json

Body: { "roomIds": string[], "checkInDate": string, "checkOutDate": string }

Response 201:
{ "data": { "holdId": string, "holdExpiresAt": string } }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }

Response 409:
{ "error": "reservations/room_unavailable", "conflicts": RoomAvailabilityConflict[] }
```

**Action**: `RESERVATION_HOLD` | **Rate tier**: MUTATION (30/min)

## 6. Release Hold

```
POST /api/reservations/:id/release-hold
Content-Type: application/json

Body: { "holdId"?: string }    // omit to release all holds

Response 200:
{ "success": true }

Response 404:
{ "error": "reservations/hold_not_found" }
```

**Action**: `RESERVATION_HOLD` | **Rate tier**: MUTATION (30/min)

## 7. Confirm Reservation

```
POST /api/reservations/:id/confirm
Content-Type: application/json

Body: ConfirmReservationInput
  - Note: reservationId in body matches :id in URL (validated)
  - Note: pricingAccepted must be true

Response 200:
{ "data": { "reservationId": string, "status": "confirmed" } }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }

Response 409:
{ "error": "reservations/conflict", "conflicts": RoomAvailabilityConflict[] }
```

**Idempotent**: Yes — if status is already `confirmed`, returns success without side effects.

**Action**: `RESERVATION_CONFIRM` | **Rate tier**: MUTATION (30/min)

## 8. Check In

```
POST /api/reservations/:id/check-in
Content-Type: application/json

Body: (none required, optional: { "overrideWarnings"?: string[] })

Response 200:
{ "data": Reservation }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }

Response 409:
{ "error": "reservations/invalid_status" }
```

**Idempotent**: Yes — if status is already `checked_in`, returns success.

**Action**: `RESERVATION_CHECK_IN` | **Rate tier**: MUTATION (30/min)

## 9. Check Out

```
POST /api/reservations/:id/check-out
Content-Type: application/json

Body: (none required)

Response 200:
{ "data": Reservation }

Response 400:
{ "error": "reservations/invalid_status" }
```

**Idempotent**: Yes — if status is already `checked_out`, returns success.

**Action**: `RESERVATION_CHECK_OUT` | **Rate tier**: MUTATION (30/min)

## 10. Cancel Reservation

```
POST /api/reservations/:id/cancel
Content-Type: application/json

Body: { "reason"?: string }

Response 200:
{ "data": { "reservationId": string, "status": "cancelled" } }

Response 400:
{ "error": "reservations/invalid_status" }
```

**Idempotent**: Yes — if status is already `cancelled`, returns success.

**Action**: `RESERVATION_CANCEL` (existing) | **Rate tier**: MUTATION (30/min)

## 11. Mark No-Show

```
POST /api/reservations/:id/no-show
Content-Type: application/json

Body: { "reason"?: string }

Response 200:
{ "data": Reservation }

Response 400:
{ "error": "reservations/invalid_status" }
```

**Idempotent**: Yes — if status is already `no_show`, returns success.

**Action**: `RESERVATION_NO_SHOW` | **Rate tier**: MUTATION (30/min)

## 12. Add Room to Reservation

```
POST /api/reservations/:id/rooms
Content-Type: application/json

Body: {
  "roomId": string,
  "roomTypeId": string,
  "checkInDate": string,
  "checkOutDate": string,
  "adults": number,
  "ratePerNight": number,
  "assignedGuestId"?: string
}

Response 201:
{ "data": ReservationRoom }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }

Response 409:
{ "error": "reservations/room_conflict" }
```

**Action**: `BOOKINGS_WRITE` | **Rate tier**: MUTATION (30/min)

## 13. Update Room on Reservation

```
PATCH /api/reservations/:id/rooms/:reservationRoomId
Content-Type: application/json

Body: Partial<ReservationRoom fields>

Response 200:
{ "data": ReservationRoom }

Response 404:
{ "error": "reservations/room_not_found" }
```

**Action**: `RESERVATION_CHANGE_ROOM` | **Rate tier**: MUTATION (30/min)

## 14. Remove Room from Reservation

```
DELETE /api/reservations/:id/rooms/:reservationRoomId

Response 200:
{ "success": true }

Response 404:
{ "error": "reservations/room_not_found" }
```

**Action**: `RESERVATION_DELETE_ROOM` | **Rate tier**: MUTATION (30/min)

## 15. Add Guest

```
POST /api/reservations/:id/guests
Content-Type: application/json

Body: {
  "guestId"?: string,
  "role": "primary_guest" | "additional_guest" | "company_guest" | "child",
  "fullName": string,
  "phone"?: string,
  "email"?: string,
  "isPrimary": boolean,
  "assignedRoomId"?: string
}

Response 201:
{ "data": ReservationGuest }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }
```

**Action**: `RESERVATION_MANAGE_GUESTS` | **Rate tier**: MUTATION (30/min)

## 16. Update Guest

```
PATCH /api/reservations/:id/guests/:reservationGuestId
Content-Type: application/json

Body: Partial<ReservationGuest fields>

Response 200:
{ "data": ReservationGuest }

Response 404:
{ "error": "reservations/guest_not_found" }
```

**Action**: `RESERVATION_MANAGE_GUESTS` | **Rate tier**: MUTATION (30/min)

## 17. Record Payment

```
POST /api/reservations/:id/payments
Content-Type: application/json

Body: RecordPaymentInput

Response 201:
{ "data": ReservationPayment }

Response 400:
{ "errors": [{ "path": string, "message": string, "code": string }] }

Response 409:
{ "error": "reservations/overpayment" }
```

**Action**: `RESERVATION_RECORD_PAYMENT` | **Rate tier**: MUTATION (30/min)

## 18. Room Availability

```
GET /api/reservations/availability
  ?checkInDate=<ISO-date>
  &checkOutDate=<ISO-date>
  &roomTypeId=<uuid>(optional)
  &companyId=<uuid>(optional)
  &adults=<number>(optional)
  &children=<number>(optional)
  &includeDirty=<boolean>(optional)
  &includeMaintenance=<boolean>(optional)

Response 200:
RoomAvailabilityResult[]    // defined in types.ts
```

**Action**: `BOOKINGS_READ` | **Rate tier**: READ (100/min)

## 19. Room Details with History

```
GET /api/rooms/:id/details-with-history
  ?from=<ISO-date>(optional)
  &to=<ISO-date>(optional)
  &limit=<number>(optional, default 50)

Response 200:
RoomDetailsWithHistory    // defined in types.ts
```

**Action**: `ROOMS_READ` | **Rate tier**: READ (100/min)

## 20. Room History

```
GET /api/rooms/:id/history
  ?from=<ISO-date>(optional)
  &to=<ISO-date>(optional)
  &limit=<number>(optional, default 50)

Response 200:
{ "data": RoomHistoryRow[] }
```

**Action**: `ROOMS_READ` | **Rate tier**: READ (100/min)

## Error Response Reference

All errors follow this structure:

### Validation Error (400)
```json
{
  "errors": [
    { "path": "checkOutDate", "message": "Check-out date must be after check-in date", "code": "invalid_date_range" }
  ]
}
```

### Auth Error (401)
```json
null
```
(Body: null, status: 401)

### Permission Denied (403)
```json
null
```
(Body: null, status: 403)

### Not Found (404)
```json
{ "error": "reservations/not_found" }
```

### Conflict (409)
```json
{ "error": "reservations/room_conflict" }
```
or
```json
{ "error": "reservations/room_unavailable", "conflicts": [...] }
```

### Rate Limited (429)
```json
{ "error": "auth/rate_limited" }
```
(Header: `Retry-After: <seconds>`)

### Server Error (500)
```json
{ "error": "reservations/internal_error" }
```

## Error Code Conventions

- Module prefix: `reservations/`, `rooms/`
- Common codes: `not_found`, `invalid_status`, `room_conflict`, `overpayment`, `permission_denied`, `internal_error`
- Validation codes: `required`, `min_value`, `max_value`, `invalid_date_range`, `not_found`, `duplicate`, `conflict`
