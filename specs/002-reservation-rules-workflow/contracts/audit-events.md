# Contract: Required Audit Events

## Purpose

Every sensitive reservation action MUST produce an audit log entry. This contract defines the required events, their metadata, and their mapping to the existing `log_action` enum.

## Required Events

| Event | When Triggered | Existing log_action Mapping |
|-------|----------------|---------------------------|
| `reservation.created` | Draft reservation created | `reservation_created` |
| `reservation.updated` | Draft fields updated | `reservation_updated` |
| `reservation.held` | Hold created on room(s) | (new: `reservation_held`) |
| `reservation.confirmed` | Draft/hold converted to confirmed | (new: `reservation_confirmed`) |
| `reservation.cancelled` | Reservation cancelled | (new: `reservation_cancelled`) |
| `reservation.checked_in` | Guest checked in | (new: `reservation_checked_in`) |
| `reservation.checked_out` | Guest checked out | (new: `reservation_checked_out`) |
| `reservation.no_show` | Guest marked as no-show | (new: `reservation_no_show`) |
| `room.assigned` | Room assigned to reservation | (new: `room_assigned`) |
| `room.changed` | Room changed during stay | (new: `room_changed`) |
| `room.released` | Room released from reservation | (new: `room_released`) |
| `price.calculated` | Initial pricing calculated | (new: `price_calculated`) |
| `price.overridden` | Manual price override applied | (new: `price_overridden`) |
| `payment.recorded` | Payment recorded | `reservation_created` (accounting) |
| `payment.refunded` | Payment refunded | (new: `payment_refunded`) |
| `conflict.prevented` | Double booking blocked | (new: `conflict_prevented`) |
| `permission.denied` | Insufficient permission for action | (new: `permission_denied`) |
| `hold.created` | Hold created (same as reservation.held) | (new: `hold_created`) |
| `hold.expired` | Hold auto-expired via cron | (new: `hold_expired`) |
| `hold.released` | Hold manually released | (new: `hold_released`) |

## Required Metadata Shape

Every audit entry MUST include:

```typescript
{
  reservationId: string;
  reservationNumber: string;
  guestId?: string;
  companyId?: string;
  roomIds?: string[];
  checkInDate?: string;
  checkOutDate?: string;
  totalAmount?: number;
  priceSource?: string;
  oldStatus?: string;
  newStatus?: string;
}
```

Price override events MUST additionally include:

```typescript
{
  oldPrice: number;
  newPrice: number;
  reason: string;
  actorId: string;
  permissionUsed: string;
  timestamp: string;
}
```

## Existing Integration

The `auditService.ts` at `src/modules/reservations/services/auditService.ts` already provides:
- `logReservationAction(session, input)` — inserts into `audit_logs` table
- `mapToLogAction(action)` — maps event names to `log_action` enum values
- `AuditInput` interface: `{ action, description, module?, target?, metadata? }`

New `log_action` enum values must be added to the database migration for the new events not currently mapped.
