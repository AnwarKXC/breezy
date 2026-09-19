-- ============================================================
-- Migration: Performance — list-query indexes
-- Generated: 2026-08-19
-- Addresses: reservations/bookings list queries ordered by
--   created_at desc; reservation status filter on the rooms grid.
-- ============================================================

create index if not exists idx_reservations_created_at
  on public.reservations (created_at desc)
  where deleted_at is null;

create index if not exists bookings_created_at_active_idx
  on public.bookings (created_at desc)
  where deleted_at is null;

create index if not exists idx_reservations_status_active
  on public.reservations (status)
  where deleted_at is null;