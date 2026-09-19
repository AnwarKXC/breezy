# API Contracts: Reservation Lifecycle Services

This directory documents the API contracts for new and modified endpoints in this phase.

## Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/reservations/[id]/hold` | Add permission check `reservation:hold` |
| `POST /api/reservations/[id]/release-hold` | Add permission check `reservation:hold` |
| `POST /api/reservations/[id]/confirm` | Change permission from `BOOKINGS_WRITE` → `reservation:confirm`; add hold revalidation |
| `POST /api/reservations/[id]/check-in` | Change permission from `BOOKINGS_WRITE` → `reservation:check_in` |
| `POST /api/reservations/[id]/check-out` | Change permission from `BOOKINGS_WRITE` → `reservation:check_out` |
| `POST /api/reservations/[id]/payments` | Add permission check `reservation:record_payment` |
| `POST /api/reservations` | Add audit logging |
| `PATCH /api/reservations/[id]` | Add permission check `reservation:update` + audit logging |

## New Endpoints

See individual contract files for details:
- [no-show.md](no-show.md) — `POST /api/reservations/[id]/no-show`
- [room-change.md](room-change.md) — Room assignment change endpoints
- [extend.md](extend.md) — `POST /api/reservations/[id]/extend`
