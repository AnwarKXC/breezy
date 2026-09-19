# Audit Logging Contract

## Mechanism

Application-level logging: API services call `INSERT INTO public.audit_logs` after each reservation mutation. No database triggers.

## Audit Log Entry Format

```sql
INSERT INTO public.audit_logs (action, actor, target, module, metadata)
VALUES (
  '<log_action_value>',
  jsonb_build_object('id', auth.uid()::text, 'role', public.current_app_role()),
  jsonb_build_object('table', '<table_name>', 'id', '<record_id>'),
  'reservations',
  jsonb_build_object(<optional context>)
);
```

## Required Fields

| Field | Type | Content |
|-------|------|---------|
| `action` | `public.log_action` | One of the reservation-specific action types (see below) |
| `actor` | JSONB | `{"id": "<user_uuid>", "role": "<app_role>"}` |
| `target` | JSONB | `{"table": "<table_name>", "id": "<record_uuid>"}` |
| `module` | text | Always `'reservations'` |
| `metadata` | JSONB | Optional context (field changes, amounts, reasons) |

## Reservation-Specific log_action Values

These already exist in the enum (added by Phase 2 migration `20260628000001`):

| Action | Triggered By |
|--------|-------------|
| `reservation_held` | Hold created or reservation status → held |
| `reservation_confirmed` | Reservation confirmed |
| `reservation_cancelled` | Reservation cancelled |
| `reservation_checked_in` | Guest checked in |
| `reservation_checked_out` | Guest checked out |
| `reservation_no_show` | Reservation marked no-show |
| `room_assigned` | Room assigned to reservation |
| `room_changed` | Room assignment changed |
| `room_released` | Room released from reservation |
| `price_override` | Pricing manually overridden |
| `payment_recorded` | Payment recorded |
| `payment_refunded` | Payment refunded |
| `hold_created` | Hold placed on room |
| `hold_expired` | Hold expired |
| `hold_released` | Hold released |

## When to Log

| Operation | Log Action | Notes |
|-----------|-----------|-------|
| Reservation INSERT (create) | `reservation_held` (if held), no action if draft | Draft is pre-log — log when first actionable status is set |
| Reservation UPDATE status → confirmed | `reservation_confirmed` | |
| Reservation UPDATE status → cancelled | `reservation_cancelled` | |
| Reservation UPDATE status → checked_in | `reservation_checked_in` | |
| Reservation UPDATE status → checked_out | `reservation_checked_out` | |
| Reservation UPDATE status → no_show | `reservation_no_show` | |
| Reservation UPDATE pricing fields | `price_override` | Include before/after values in metadata |
| reservation_payments INSERT | `payment_recorded` or `payment_refunded` | Refund if amount < 0 |
| reservation_rooms INSERT | `room_assigned` | |
| reservation_rooms UPDATE (room_id change) | `room_changed` | Include old and new room IDs |
| reservation_rooms DELETE | `room_released` | |
| reservation_holds INSERT | `hold_created` | |
| reservation_holds UPDATE (status change) | `hold_expired` or `hold_released` | |
| reservation_notes INSERT/UPDATE/DELETE | Not logged individually | Notes are low-sensitivity; audit trail is the note record's created_at/updated_at |
