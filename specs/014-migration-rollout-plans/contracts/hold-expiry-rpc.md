# Contract: `expire_reservation_holds()` RPC

## Overview

Called by the pg_cron scheduled job `expire-reservation-holds` every 1 minute. Transitions active holds past their expiry timestamp to `expired` status and writes audit log entries.

## SQL Signature

```sql
create or replace function public.expire_reservation_holds()
returns void
language plpgsql
security definer
set search_path = public;
```

## Behavior Contract

### Input
None — operates on all rows in `reservation_holds`.

### Processing Rules

1. **Selection**: `SELECT * FROM reservation_holds WHERE status = 'active' AND expires_at < now() FOR UPDATE`
2. **Transition**: For each selected row, set `status = 'expired'`, `updated_at = now()`
3. **Audit**: Insert into `public.logs` with:
   - `action` = `'hold_expired'`
   - `actor_id` = service user (or NULL for system action)
   - `target_id` = hold row `id`
   - `target_type` = `'reservation_hold'`
   - `metadata` = `jsonb_build_object('reservation_id', hold.reservation_id, 'room_id', hold.room_id, 'expires_at', hold.expires_at)`

### Output
`void` — no return value. Idempotent by design.

### Error Handling
- No exception raised on empty result set (no expired holds → nothing to do)
- Row-level `FOR UPDATE` lock prevents concurrent modification by `confirm_reservation` RPC
- If a hold was confirmed between selection and update, `FOR UPDATE` ensures we see the updated status

## PostgreSQL Cron Job

```sql
-- Schedule cleanup every 1 minute
select cron.schedule(
  'expire-reservation-holds',
  '1 minute',
  $$ select public.expire_reservation_holds(); $$
);
```

### Unscheduling (for migration rollback)
```sql
select cron.unschedule('expire-reservation-holds');
```
