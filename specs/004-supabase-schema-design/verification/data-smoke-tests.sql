-- Data smoke tests for specs/004-supabase-schema-design
-- Run inside a disposable local Supabase database. Script assumes at least
-- one profile, room, room_type, guest/contact where tested; missing seed data
-- should be created by local fixtures before running.
-- Recommended: BEGIN before the script and ROLLBACK after inspection.

begin;

-- Seed references from existing local data.
with refs as (
  select
    (select id from public.profiles limit 1) as user_id,
    (select id from public.rooms limit 1) as room_id,
    (select room_type_id from public.rooms where room_type_id is not null limit 1) as room_type_id,
    (select id from public.guests limit 1) as guest_id,
    (select id from public.contacts limit 1) as contact_id

), r1 as (
  insert into public.reservations (
    booking_type, check_in_date, check_out_date, nights, adults,
    room_count, total_amount, balance_amount, created_by
  )
  select 'individual', current_date + 30, current_date + 33, 3, 1,
         1, 300, 300, user_id
  from refs
  where user_id is not null and room_id is not null and room_type_id is not null
  returning id, reservation_number, status, created_by
), r2 as (
  insert into public.reservations (
    booking_type, check_in_date, check_out_date, nights, adults,
    room_count, total_amount, balance_amount, created_by
  )
  select 'individual', current_date + 30, current_date + 33, 3, 1,
         1, 300, 300, user_id
  from refs
  where user_id is not null and room_id is not null and room_type_id is not null
  returning id, reservation_number
), rr1 as (
  insert into public.reservation_rooms (
    reservation_id, room_id, room_type_id, check_in_date, check_out_date,
    status, adults, nights, rate_per_night, subtotal_amount, total_amount
  )
  select r1.id, refs.room_id, refs.room_type_id, current_date + 30, current_date + 33,
         'reserved', 1, 3, 100, 300, 300
  from r1, refs
  returning id, reservation_id, room_id
), guest1 as (
  insert into public.reservation_guests (
    reservation_id, guest_id, full_name, role, is_primary
  )
  select r1.id, refs.guest_id, 'Primary Guest', 'primary_guest', true
  from r1, refs
  returning id
), pay1 as (
  insert into public.reservation_payments (
    reservation_id, payment_type, method, amount, status, created_by
  )
  select r1.id, 'deposit', 'cash', 100, 'completed', r1.created_by
  from r1
  returning id, amount
), price1 as (
  insert into public.reservation_pricing_items (
    reservation_id, reservation_room_id, price_source, base_rate, applied_rate,
    nights, quantity, service_amount, total_amount, manual_override_reason, manual_override_by
  )
  select r1.id, rr1.id, 'manual_override', 120, 100,
         3, 1, 30, 330, 'local smoke test', r1.created_by
  from r1, rr1
  returning id
), hold1 as (
  insert into public.reservation_holds (
    reservation_id, room_id, held_by_user_id, check_in_date, check_out_date, expires_at
  )
  select r2.id, refs.room_id, refs.user_id, current_date + 40, current_date + 42, now() + interval '30 minutes'
  from r2, refs
  returning id
), note1 as (
  insert into public.reservation_notes (reservation_id, type, visibility, message, created_by)
  select r1.id, 'front_desk', 'internal', 'Smoke test note', r1.created_by
  from r1
  returning id
), hist1 as (
  insert into public.reservation_status_history (reservation_id, from_status, to_status, reason, changed_by)
  select r1.id, 'draft', 'confirmed', 'Smoke test', r1.created_by
  from r1
  returning id
)
select
  r1.id as reservation_id,
  r1.reservation_number,
  rr1.id as reservation_room_id,
  guest1.id as reservation_guest_id,
  pay1.id as payment_id,
  price1.id as pricing_item_id,
  hold1.id as hold_id,
  note1.id as note_id,
  hist1.id as history_id
from r1, rr1, guest1, pay1, price1, hold1, note1, hist1;

-- RPC smoke checks.
select public.confirm_reservation(id, created_by)
from public.reservations
where reservation_number like 'RSV-%'
order by created_at desc
limit 1;

select * from public.get_room_availability(current_date + 30, current_date + 33) limit 5;

rollback;

