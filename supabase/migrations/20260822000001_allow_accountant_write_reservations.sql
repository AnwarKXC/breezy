-- ============================================================
-- Migration: Allow accountant to create reservations
-- Generated: 2026-08-22
-- Addresses: accountant role could not create reservations because
--   can_write_reservations() only allowed admin/front_desk, so the
--   create_reservation_with_rooms RPC failed RLS with
--   "new row violates row-level security policy for table reservations"
-- ============================================================

create or replace function public.can_write_reservations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;
