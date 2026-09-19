# Endpoint Coverage Matrix — Reservation Testing Plans

Maps each endpoint from 012-api-routes-models-validation to its test coverage in this testing plan.

| Endpoint | Unit | Integration | E2E | Status |
|---|---|---|---|---|
| `GET /api/reservations` | — | `service` | `same-day-walk-in` | Tested |
| `POST /api/reservations` | — | `create-reservation` | `same-day-walk-in` | Tested |
| `GET /api/reservations/:id` | — | `create-reservation` | `future-reservation` | Tested |
| `PATCH /api/reservations/:id` | — | `hold-confirm-flow` | `future-reservation` | Tested |
| `DELETE /api/reservations/:id` | — | `cancel-releases-room` | `future-reservation` | Tested |
| `GET /api/reservations/:id/audit` | — | `audit-log-price-override` | — | Tested |
| `GET /api/rooms` | — | — | `maintenance-room` | Tested |
| `GET /api/rooms/:id` | — | — | `due-out-dirty` | Tested |
| `PATCH /api/rooms/:id` | — | — | `maintenance-room` | Tested |
| `GET /api/guests/:id/reservations` | — | — | `split-stay` | Tested |
| `POST /api/reservations/:id/payments` | — | `audit-log-price-override` | — | Tested |
| `GET /api/reservations/:id/payments` | — | `audit-log-price-override` | — | Tested |
