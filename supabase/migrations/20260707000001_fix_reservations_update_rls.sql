-- ============================================================
-- Migration: Fix reservations UPDATE RLS for soft-delete
-- Purpose: The with_check clause had `deleted_at IS NULL` which
--          prevented setting deleted_at (soft-delete).
-- Fix: Move deleted_at IS NULL to the USING clause so it only
--      prevents updating already-deleted rows, while allowing
--      the UPDATE to set deleted_at (soft-delete).
-- ============================================================

drop policy if exists "reservations_update_writers" on public.reservations;

create policy "reservations_update_writers"
  on public.reservations for update
  to authenticated
  using (public.can_write_reservations() and deleted_at is null)
  with check (public.can_write_reservations());
