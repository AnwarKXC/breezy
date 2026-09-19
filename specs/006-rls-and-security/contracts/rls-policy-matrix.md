# RLS Policy Matrix Contract

## Naming Convention

All policies follow the existing pattern:

```
{table_name}_{operation}_{suffix}
```

Where:
- `{table_name}` is the full table name (e.g., `reservations`, `reservation_rooms`)
- `{operation}` is one of: `select`, `insert`, `update`, `delete`
- `{suffix}` indicates the target role or scope: `staff` (readers), `writers` (front_desk + admin), `admin` (admin only)

Examples: `reservations_select_staff`, `reservations_insert_writers`, `reservations_delete_admin`

## Policy Target

All policies target `to authenticated` only. No policies target `to public` or `to anon`.

## Helper-Based Pattern

Every policy calls a helper function rather than inlining role checks:

```sql
-- Existing (keep as-is)
create policy "reservations_select_staff"
  on public.reservations for select
  to authenticated
  using (public.can_read_reservations());
```

New policies for sensitive operations:

```sql
create policy "reservations_update_admin"
  on public.reservations for update
  to authenticated
  using (public.can_write_reservations())
  with check (
    public.can_write_reservations()
    and (
      -- If updating pricing-sensitive columns, require override permission
      case when (
        subtotal_amount is distinct from subtotal_amount
        or discount_amount is distinct from discount_amount
        or tax_amount is distinct from tax_amount
        or service_amount is distinct from service_amount
        or total_amount is distinct from total_amount
        or paid_amount is distinct from paid_amount
        or balance_amount is distinct from balance_amount
      ) then public.can_override_pricing()
      else true end
    )
    and (
      -- If updating internal_notes, require admin
      case when internal_notes is distinct from internal_notes
        then public.can_manage_internal_notes()
        else true end
    )
    and (
      -- If updating deleted_at, block (managed by RPC)
      case when deleted_at is distinct from deleted_at
        then false
        else true end
    )
  );
```

## Terminal State Subquery

For child tables, the terminal state check uses a subquery:

```sql
create policy "reservation_rooms_update_writers"
  on public.reservation_rooms for update
  to authenticated
  using (public.can_write_reservations())
  with check (
    public.can_write_reservations()
    and (
      select r.status not in ('checked_out', 'cancelled', 'no_show')
      from public.reservations r
      where r.id = reservation_id
    )
  );
```

## Migration Order

1. Create new helper functions (`CREATE OR REPLACE FUNCTION`)
2. Drop existing coarse policies (`DROP POLICY IF EXISTS`)
3. Create refined policies (`CREATE POLICY IF NOT EXISTS`)
4. Update RPC bodies with permission guards (`CREATE OR REPLACE FUNCTION`)
