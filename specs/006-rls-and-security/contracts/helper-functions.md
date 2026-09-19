# Helper Functions Contract

## Existing Helpers (preserved unchanged)

| Function | Purpose | Signature |
|----------|---------|-----------|
| `public.current_app_role()` | Returns role from JWT claim | `() → public.app_role` |
| `public.is_admin()` | Returns true if current_app_role() = 'admin' | `() → boolean` |
| `public.can_read_reservations()` | Returns true if role in (admin, accountant, front_desk) | `() → boolean` |
| `public.can_write_reservations()` | Returns true if role in (admin, front_desk) | `() → boolean` |
| `public.can_override_pricing()` | Returns true if is_admin() | `() → boolean` |

## New Helpers (added by this phase)

All new helpers use the same pattern:
- Language: SQL
- Volatility: STABLE
- Security: DEFINER
- Search Path: `public`
- Schema: `public`

| Function | Returns true when | SQL Definition |
|----------|------------------|---------------|
| `public.can_cancel_reservations()` | `is_admin()` | `select public.is_admin()` |
| `public.can_manage_internal_notes()` | `is_admin()` | `select public.is_admin()` |
| `public.can_manage_guarantee()` | any auth'd user (always true — front_desk can view/set standard, RLS policy handles override logic) | `select public.current_app_role() is not null` |
| `public.can_force_assign_room()` | `is_admin()` | `select public.is_admin()` |
| `public.can_refund_payment()` | `is_admin()` | `select public.is_admin()` |
| `public.can_delete_reservations()` | `is_admin()` | `select public.is_admin()` |

## Helper Usage in Policies

| Helper | Used In |
|--------|---------|
| `can_read_reservations()` | SELECT policies on all 9 tables |
| `can_write_reservations()` | INSERT + UPDATE policies (base writer check) |
| `can_override_pricing()` | UPDATE policies on pricing columns (reservations, reservation_pricing_items, reservation_company_info) |
| `can_manage_internal_notes()` | UPDATE policies on internal_notes column (reservations, reservation_notes) |
| `can_manage_guarantee()` | UPDATE WITH CHECK for guarantee_type |
| `can_force_assign_room()` | UPDATE on reservation_rooms (dirty/maintenance assignment) |
| `can_refund_payment()` | INSERT on reservation_payments with negative amount |
| `can_delete_reservations()` | DELETE policies on all mutable tables |
| `can_cancel_reservations()` | RPC permission guard for cancel_reservation() |
