-- ============================================================
-- Migration: Fix accountant read access to contacts and rooms
-- Generated: 2026-08-21
-- Addresses: accountant role cannot see contacts or rooms
--   because audit_fixes migration (20260515) was never applied
-- ============================================================

-- 1. Add accountant to can_read_contacts()
create or replace function private.can_read_contacts()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

-- 2. Add accountant to can_read_rooms()
create or replace function private.can_read_rooms()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

-- 3. Create can_read_company_price_overrides() with accountant access
--    (was supposed to be created in audit_fixes migration)
create or replace function private.can_read_company_price_overrides()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

-- 4. Update company_price_overrides SELECT policy to use new function
drop policy if exists "company_price_overrides_select_readers" on public.company_price_overrides;
create policy "company_price_overrides_select_readers"
on public.company_price_overrides
for select
to authenticated
using (private.can_read_company_price_overrides());
