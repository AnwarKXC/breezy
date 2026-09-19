# API Contracts: Reservation Module

**Base URL**: `/api/reservations`

All mutation endpoints are wrapped with `secureMutationEndpoint`,
all read endpoints with `secureReadEndpoint`.

## Authentication

- **Cookie-based session** via `createServerSupabaseClient()`
- **Rate limiting**: READ_MUTATION tier (30 req/min per session)

## Permission Actions

| Action | Required Role |
|--------|---------------|
| `bookings:read` | front_desk, admin |
| `bookings:write` | front_desk, admin |
| `reservation:confirm` | front_desk, admin |
| `reservation:cancel` | front_desk, admin |
| `reservation:check_in` | front_desk, admin |
| `reservation:check_out` | front_desk, admin |
| `reservation:override_price` | admin |
| `reservation:record_payment` | front_desk, admin |
| `reservation:refund_payment` | admin |

## Response Envelope

All endpoints return:
```json
{
  "data": { ... },
  "error": null
}
```

On error:
```json
{
  "data": null,
  "error": { "message": "...", "code": "..." }
}
```

## Endpoints

| # | Method | Route | Description | Reference |
|---|--------|-------|-------------|-----------|
| 1 | GET | `/api/reservations/availability` | Room availability search | [availability.md](availability.md) |
| 2 | POST | `/api/reservations` | Create reservation draft/initial | [reservations.md](reservations.md) |
| 3 | GET | `/api/reservations` | List reservations | [reservations.md](reservations.md) |
| 4 | GET | `/api/reservations/[id]` | Get reservation details | [reservations.md](reservations.md) |
| 5 | PATCH | `/api/reservations/[id]` | Update reservation | [reservations.md](reservations.md) |
| 6 | DELETE | `/api/reservations/[id]` | Soft delete reservation | [reservations.md](reservations.md) |
| 7 | POST | `/api/reservations/[id]/confirm` | Confirm reservation | [confirm.md](confirm.md) |
| 8 | POST | `/api/reservations/[id]/check-in` | Check-in | [check-in.md](check-in.md) |
| 9 | POST | `/api/reservations/[id]/check-out` | Check-out | [check-out.md](check-out.md) |
| 10 | POST | `/api/reservations/[id]/cancel` | Cancel reservation | [cancel.md](cancel.md) |
| 11 | POST | `/api/reservations/[id]/payments` | Record payment | [payments.md](payments.md) |
| 12 | PATCH | `/api/reservations/[id]/override-price` | Price override | [pricing-override.md](pricing-override.md) |
| 13 | GET | `/api/reservations/[id]/history` | Status history | [history.md](history.md) |
| 14 | POST | `/api/reservations/[id]/holds` | Create hold | [holds.md](holds.md) |
| 15 | POST | `/api/reservations/[id]/notes` | Add note | [notes.md](notes.md) |
