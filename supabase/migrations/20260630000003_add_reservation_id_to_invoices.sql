-- ============================================================
-- Migration: Add reservation_id to invoices
-- Purpose: Allow invoices to reference reservations (not just legacy bookings)
-- Covers scenarios: H01-H10
-- ============================================================

alter table public.invoices add column if not exists reservation_id uuid references public.reservations(id) on delete set null;

create index if not exists idx_invoices_reservation_id on public.invoices(reservation_id);

-- Update the compatibility view to include invoices
create or replace view public.v_reservation_with_booking as
select
  r.id as reservation_id,
  r.confirmation_number,
  r.status as reservation_status,
  r.check_in,
  r.check_out,
  r.total_amount,
  r.paid_amount,
  r.balance,
  r.created_at,
  b.id as legacy_booking_id,
  b.status as legacy_booking_status,
  b.guest_name as legacy_guest_name,
  b.room_number as legacy_room_number
from public.reservations r
full outer join public.bookings b on r.legacy_booking_id = b.id;

notify pgrst, 'reload schema';
