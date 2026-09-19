-- ============================================================
-- Migration: Audit Fixes
-- Generated: 2026-05-15
-- Addresses: RLS issues, type mismatches, missing indexes,
--   missing constraints, partial index fix
-- ============================================================

-- 1. Fix RLS: Dedicated function for company_price_overrides SELECT
--    (was incorrectly reusing private.can_read_contacts())
create or replace function private.can_read_company_price_overrides()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

drop policy if exists "company_price_overrides_select_readers" on public.company_price_overrides;
create policy "company_price_overrides_select_readers"
on public.company_price_overrides
for select
to authenticated
using (private.can_read_company_price_overrides());

-- 2. Fix RLS: Grant accountant read-only access to rooms, contacts
drop policy if exists "rooms_select_staff" on public.rooms;
create policy "rooms_select_staff"
on public.rooms
for select
to authenticated
using (private.can_read_rooms());

create or replace function private.can_read_rooms()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

drop policy if exists "contacts_select_staff" on public.contacts;
create policy "contacts_select_staff"
on public.contacts
for select
to authenticated
using (private.can_read_contacts());

create or replace function private.can_read_contacts()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

-- 3. Fix Schema: bookings.guest_id and bookings.room_id type mismatches (text -> uuid)
--    First drop dependent policies/indexes that reference guest_id/room_id
drop policy if exists "bookings_select_staff" on public.bookings;
drop policy if exists "bookings_insert_writers" on public.bookings;
drop policy if exists "bookings_update_writers" on public.bookings;
drop policy if exists "bookings_delete_writers" on public.bookings;

drop index if exists bookings_guest_check_in_id_idx;

alter table public.bookings
  alter column guest_id type uuid using guest_id::uuid,
  alter column room_id type uuid using room_id::uuid;

-- Add FK constraints
alter table public.bookings
  add constraint bookings_guest_id_fkey foreign key (guest_id) references public.guests(id) on delete restrict,
  add constraint bookings_room_id_fkey foreign key (room_id) references public.rooms(id) on delete restrict;

-- Recreate indexes
create index bookings_guest_id_idx on public.bookings (guest_id);
create index bookings_room_id_idx on public.bookings (room_id);
create index bookings_check_in_out_idx on public.bookings (check_in, check_out);

-- Recreate policies
create policy "bookings_select_staff"
on public.bookings
for select
to authenticated
using (private.can_read_bookings());

create policy "bookings_insert_writers"
on public.bookings
for insert
to authenticated
with check (private.can_write_bookings());

create policy "bookings_update_writers"
on public.bookings
for update
to authenticated
using (private.can_write_bookings())
with check (private.can_write_bookings());

create policy "bookings_delete_writers"
on public.bookings
for delete
to authenticated
using (private.can_write_bookings());

-- 4. Add CHECK constraint: paid_amount <= total_amount on bookings
alter table public.bookings
  add constraint bookings_paid_not_exceed_total check (paid_amount <= total_amount);

-- 5. Convert audit_logs.external_firebase_id UNIQUE to partial unique index
--    (a true UNIQUE constraint fails on multiple NULLs; a partial index allows nullable uniqueness)
drop index if exists audit_logs_external_firebase_id_unique;
drop index if exists audit_logs_external_firebase_id_key;

create unique index audit_logs_external_firebase_id_unique on public.audit_logs (external_firebase_id)
  where external_firebase_id is not null;

-- 6. Add CHECK constraints for company vs individual contact fields
--    - Company contacts: responsible_person should NOT be null
--    - Individual contacts: id_passport should NOT be null
alter table public.contacts
  add constraint contacts_company_requires_person
    check (type != 'company' or (responsible_person is not null and responsible_person <> '')),
  add constraint contacts_individual_requires_passport
    check (type != 'individual' or (id_passport is not null and id_passport <> ''));

-- 7. Add uniqueness constraint on company_price_overrides(contact_id, room_category, occupancy_code)
alter table public.company_price_overrides
  add constraint company_price_overrides_unique_override
    unique (contact_id, room_category, occupancy_code);
