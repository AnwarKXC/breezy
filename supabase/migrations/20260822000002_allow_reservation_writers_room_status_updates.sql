-- ============================================================
-- Migration: Allow reservation writers to update room status
-- Generated: 2026-08-22
-- Addresses: rooms UPDATE was admin-only (can_write_rooms), so the
--   confirm/check-in/check-out/change-room flows silently failed to flip
--   room status for front_desk users (RLS USING failure = 0-row update)
--   and would hard-fail for accountant after write access was granted.
-- Keeps rooms INSERT/DELETE admin-only.
-- ============================================================

create or replace function private.can_update_room_status()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

drop policy if exists "rooms_update_admin" on public.rooms;
create policy "rooms_update_status_writers"
on public.rooms
for update
to authenticated
using (private.can_update_room_status())
with check (private.can_update_room_status());
