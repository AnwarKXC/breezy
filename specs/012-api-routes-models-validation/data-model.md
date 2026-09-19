# Data Model: API Routes, TypeScript Models, and Validation

## TypeScript Input/Output Types

### Request Input Types

All input types are already defined in `src/modules/reservations/types.ts`. No new types required — route handlers reuse existing interfaces.

| Type | Used By Endpoints | Fields |
|------|------------------|--------|
| `CreateReservationInput` | `POST /api/reservations` | bookingType, source?, checkInDate, checkOutDate, checkInTime?, checkOutTime?, adults, children?, infants?, roomCount?, primaryGuestId?, companyId?, bookerName/Phone/Email?, billingParty, specialRequests?, internalNotes? |
| `UpdateReservationInput` | `PATCH /api/reservations/:id` | All optional fields matching CreateReservationInput |
| `CreateHoldInput` | `POST /api/reservations/:id/hold` | roomId, checkInDate, checkOutDate |
| `ConfirmReservationInput` | `POST /api/reservations/:id/confirm` | reservationId, selectedRooms[ { roomId, roomTypeId, checkInDate, checkOutDate, assignedGuestId? } ], pricingAccepted, payment? { paymentType, method, amount, transactionReference? }, acknowledgedWarnings[] |
| `RecordPaymentInput` | `POST /api/reservations/:id/payments` | paymentType, method, amount, currency?, transactionReference?, notes? |

### Response Output Shapes

Route handlers return JSON responses. The response structures follow existing patterns:

| Endpoint | Response Shape | Status |
|----------|---------------|--------|
| `GET /api/reservations` | `{ data: Reservation[], hasMore: boolean, nextCursor: string \| null }` | 200 |
| `GET /api/reservations/:id` | `{ ...Reservation, rooms: ReservationRoom[], guests: ReservationGuest[], payments: ReservationPayment[], companyInfo?: ReservationCompanyInfo, notes: ReservationNote[], statusHistory: ReservationStatusHistory[] }` | 200 |
| `GET /api/reservations/availability` | `RoomAvailabilityResult[]` | 200 |
| `GET /api/rooms/:id/details-with-history` | `RoomDetailsWithHistory` | 200 |
| `GET /api/rooms/:id/history` | `{ data: RoomHistoryRow[] }` | 200 |
| `POST /api/reservations` | `{ data: Reservation }` | 201 |
| `PATCH /api/reservations/:id` | `{ data: Reservation }` | 200 |
| `POST /api/reservations/:id/hold` | `{ data: { holdId: string, holdExpiresAt: string } }` | 201 |
| `POST /api/reservations/:id/release-hold` | `{ success: true }` | 200 |
| `POST /api/reservations/:id/confirm` | `{ data: { reservationId: string, status: 'confirmed' } }` | 200 |
| `POST /api/reservations/:id/check-in` | `{ data: Reservation }` | 200 |
| `POST /api/reservations/:id/check-out` | `{ data: Reservation }` | 200 |
| `POST /api/reservations/:id/cancel` | `{ data: { reservationId: string, status: 'cancelled' } }` | 200 |
| `POST /api/reservations/:id/no-show` | `{ data: Reservation }` | 200 |
| `POST /api/reservations/:id/rooms` | `{ data: ReservationRoom }` | 201 |
| `PATCH /api/reservations/:id/rooms/:reservationRoomId` | `{ data: ReservationRoom }` | 200 |
| `DELETE /api/reservations/:id/rooms/:reservationRoomId` | `{ success: true }` | 200 |
| `POST /api/reservations/:id/guests` | `{ data: ReservationGuest }` | 201 |
| `PATCH /api/reservations/:id/guests/:reservationGuestId` | `{ data: ReservationGuest }` | 200 |
| `POST /api/reservations/:id/payments` | `{ data: ReservationPayment }` | 201 |

## Validation Rules

### Core Validation Functions (existing — extend only)

Existing functions in `src/modules/reservations/validation.ts`:
- `validateCreateReservation(input): ValidationError[]`
- `validateStatusTransition(from, to): ValidationError | null`
- `validateConfirmReservation(input): ValidationError[]`
- `validatePaymentAmount(amount, totalAmount, paidAmount): ValidationError | null`

### New Validation Functions to Add

| Function | Input | Rules |
|----------|-------|-------|
| `validateAddRoom(input)` | `{ roomId, reservationId, checkInDate, checkOutDate }` | room exists, room active, room not out_of_order, capacity sufficient, no date overlap |
| `validateChangeRoom(input)` | `{ currentRoomId, newRoomId, reservationId }` | new room exists, new room available for dates, new room capacity sufficient |
| `validateAddGuest(input)` | `{ guestId?, fullName, reservationId }` | guest ID exists if provided, name required if no guestId, reservation exists |
| `validateMarkNoShow(reservation)` | `Reservation` | current status is 'confirmed', check-in date has passed |
| `validateExtendStay(input)` | `{ reservationId, newCheckOutDate }` | new date after current checkout, no overlapping reservations for assigned rooms |
| `validateHoldCreation(input)` | `{ roomId, checkInDate, checkOutDate }` | room exists, room not out_of_order, no active hold by another user, no conflicting reservation |
| `validatePaymentRecording(input, reservation)` | `(RecordPaymentInput, Reservation)` | amount > 0, paid amount <= total (unless overpayment allowed), payment type valid |

### Error Response Format (route layer)

All validation errors are converted at the route layer to the structured format:

```ts
{
  errors: [
    { path: "checkOutDate", message: "Check-out date must be after check-in date", code: "invalid_date_range" },
    { path: "adults", message: "At least one adult is required", code: "min_value" }
  ]
}
```

The code converts `ValidationError[]` (from `validation.ts`) to this format by:
- `path` ← `ValidationError.field`
- `message` ← `ValidationError.message`
- `code` ← derived from the field + rule (e.g., `required`, `min_value`, `invalid_date_range`, `not_found`)

## State Transitions

Lifecycle mutations are validated against the existing transition map (`RESERVATION_STATUS_TRANSITIONS` in `types.ts`):

```
draft → held → confirmed → checked_in → checked_out
draft → cancelled
held → expired
held → cancelled
confirmed → cancelled
confirmed → no_show
```

Route handlers call `transitionStatus(reservationId, fromStatus, toStatus, userId)` from `statusService.ts` after community validation.

## Permission-to-Action Mapping

New granular actions to add to `src/config/actionPermissions.ts`:

| Action Constant | Action String | FRONT_DESK | ACCOUNTANT | ADMIN |
|----------------|---------------|-----------|-----------|-------|
| `RESERVATION_CONFIRM` | `reservation:confirm` | ✅ | ❌ | ✅ |
| `RESERVATION_CHECK_IN` | `reservation:check_in` | ✅ | ❌ | ✅ |
| `RESERVATION_CHECK_OUT` | `reservation:check_out` | ✅ | ❌ | ✅ |
| `RESERVATION_NO_SHOW` | `reservation:no_show` | ✅ | ❌ | ✅ |
| `RESERVATION_HOLD` | `reservation:hold` | ✅ | ❌ | ✅ |
| `RESERVATION_CHANGE_ROOM` | `reservation:change_room` | ✅ | ❌ | ✅ |
| `RESERVATION_EXTEND` | `reservation:extend_stay` | ✅ | ❌ | ✅ |
| `RESERVATION_MANAGE_GUESTS` | `reservation:manage_guests` | ✅ | ❌ | ✅ |
| `RESERVATION_RECORD_PAYMENT` | `reservation:record_payment` | ✅ | ❌ | ✅ |
| `RESERVATION_DELETE_ROOM` | `reservation:delete_room` | ❌ | ❌ | ✅ |

Existing actions that remain:
- `RESERVATION_CANCEL` — front_desk: ❌, admin: ✅ (manager-only)
- `RESERVATION_OVERRIDE_PRICE` — admin only
- `RESERVATION_OVERRIDE_DEPOSIT` — admin only
- `RESERVATION_FORCE_ASSIGN` — admin only
- `RESERVATION_ASSIGN_DIRTY` — admin only
- `RESERVATION_REFUND` — admin only
