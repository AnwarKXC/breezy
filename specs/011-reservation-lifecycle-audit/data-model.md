# Data Model: Reservation Lifecycle Services & Audit Logs

## Existing Entity Relationships

```
reservations (parent)
├── reservation_rooms (1:N)
├── reservation_guests (1:N)
├── reservation_company_info (1:1)
├── reservation_pricing_items (1:N)
├── reservation_payments (1:N)
├── reservation_holds (1:N)
├── reservation_notes (1:N)
└── reservation_status_history (1:N)

audit_logs (cross-cutting) — references any entity via target JSON
```

## Reservation Status Lifecycle

```
draft → [held, confirmed, cancelled]
held → [confirmed, expired, cancelled]
confirmed → [checked_in, cancelled, no_show]
checked_in → [checked_out]
checked_out, cancelled, no_show, expired → [] (terminal)
```

## Reservation Room Status Lifecycle

```
selected → [held, reserved]
held → [reserved, cancelled, released]
reserved → [occupied, cancelled, released]
occupied → [checked_out]
checked_out, cancelled, released → [] (terminal)
```

## Hold Status Lifecycle

```
active → [expired, released]
expired, released → [] (terminal)
```

## Tables Requiring Changes

### `reservation_holds` — New Index

```sql
create index if not exists idx_reservation_holds_expiry_cleanup
on reservation_holds(expires_at, status)
where status = 'active';
```

### `audit_logs` — New Indexes

```sql
create index if not exists idx_audit_logs_created_at
on audit_logs(created_at desc);

create index if not exists idx_audit_logs_module_action
on audit_logs(module, action);
```

## No New Tables

This phase does not create any new database tables. All data already exists in:
- `reservations`, `reservation_rooms`, `reservation_guests`
- `reservation_holds`, `reservation_status_history`
- `audit_logs`

## New Service-Level Concepts

### Room Change Request
- **Input**: reservationId, targetRoomId, newCheckInDate?, newCheckOutDate?
- **Validation**: target room exists, is active, not out_of_order, no overlap conflicts
- **Transaction**: insert new reservation_room → update old reservation_room status to `released` → update reservation

### Stay Extension Request
- **Input**: reservationId, newCheckOutDate
- **Validation**: newCheckOutDate > currentCheckOutDate, room available for extension dates, no overlap conflicts
- **Transaction**: update reservation_room check_out_date + nights → update reservation check_out_date + nights

### No-Show Marking
- **Input**: reservationId, userId
- **Validation**: status is `confirmed`, current time > scheduled checkout time + grace period (default 2h)
- **Transaction**: update reservation status → release rooms → insert status history

## Permission Model (Two-Tier)

### Front Desk Permissions
```
reservation:create       — createReservationDraft
reservation:read         — getReservationById, listReservations
reservation:update       — updateReservationDraft
reservation:confirm      — confirmReservation
reservation:check_in     — checkInReservation
reservation:check_out    — checkOutReservation
reservation:hold         — createHold, releaseHold
reservation:change_room  — changeReservationRoom
reservation:extend_stay  — extendReservationStay
reservation:record_payment — recordPayment
```

### Manager/Admin Permissions (front desk +)
```
reservation:cancel              — cancelReservation
reservation:override_price      — manual price override
reservation:override_deposit    — deposit requirement override
reservation:force_assign_room   — assign room that has conflicts
reservation:assign_dirty_room   — assign dirty room
reservation:assign_maintenance_room — assign maintenance room
reservation:company_credit_override — override company credit limit
reservation:refund_payment      — refund
reservation:no_show             — markNoShow
```

## Audit Event Types

| Event | Trigger | Metadata |
|-------|---------|----------|
| `reservation.created` | Draft created | userId, reservationId, status: draft |
| `reservation.updated` | Draft updated | changed fields |
| `reservation.held` | Hold created | roomId, checkIn, checkOut, expiresAt |
| `reservation.confirmed` | Confirmed | selectedRooms, pricingAccepted |
| `reservation.cancelled` | Cancelled | reason, releasedRooms |
| `reservation.checked_in` | Checked in | checkedInAt, roomId |
| `reservation.checked_out` | Checked out | checkedOutAt, roomId |
| `reservation.no_show` | No-show marked | originalCheckOut |
| `room.assigned` | Room added to reservation | roomId, checkIn, checkOut |
| `room.changed` | Room changed mid-stay | oldRoomId, newRoomId |
| `room.released` | Room removed/released | roomId, reason |
| `price.calculated` | Price auto-calculated | roomId, ratePerNight, priceSource |
| `price.overridden` | Manual price override | oldPrice, newPrice, reason |
| `payment.recorded` | Payment recorded | amount, method, type |
| `payment.refunded` | Payment refunded | originalPaymentId, amount |
| `conflict.prevented` | Booking conflict blocked | conflictingReservationId, roomId |
| `permission.denied` | Permission check failed | attemptedAction, userId, targetId |
| `hold.created` | Hold placed | roomId, expiresAt |
| `hold.expired` | Hold auto-expired | roomId, originalExpiry |
| `hold.released` | Hold manually released | roomId, userId |
