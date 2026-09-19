create type public.room_status as enum ('available', 'occupied', 'maintenance', 'cleaning');
create type public.room_type as enum ('standard', 'deluxe', 'suite', 'family');
create type public.guest_status as enum ('active', 'inactive', 'vip', 'blacklist');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  floor integer not null,
  type public.room_type not null,
  status public.room_status not null default 'available',
  price numeric(10,2) not null,
  capacity integer not null,
  amenities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_price_nonnegative check (price >= 0),
  constraint rooms_capacity_positive check (capacity > 0)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  country text,
  passport_number text,
  status public.guest_status not null default 'active',
  total_bookings integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  last_visit timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_total_bookings_nonnegative check (total_bookings >= 0),
  constraint guests_total_spent_nonnegative check (total_spent >= 0)
);

create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

create trigger guests_set_updated_at
before update on public.guests
for each row
execute function public.set_updated_at();

create or replace function private.can_read_rooms()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_write_rooms()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin()
$$;

create or replace function private.can_read_guests()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_write_guests()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

alter table public.rooms enable row level security;
alter table public.guests enable row level security;

create policy "rooms_select_staff"
on public.rooms
for select
to authenticated
using (private.can_read_rooms());

create policy "rooms_insert_admin"
on public.rooms
for insert
to authenticated
with check (private.can_write_rooms());

create policy "rooms_update_admin"
on public.rooms
for update
to authenticated
using (private.can_write_rooms())
with check (private.can_write_rooms());

create policy "rooms_delete_admin"
on public.rooms
for delete
to authenticated
using (private.can_write_rooms());

create policy "guests_select_staff"
on public.guests
for select
to authenticated
using (private.can_read_guests());

create policy "guests_insert_writers"
on public.guests
for insert
to authenticated
with check (private.can_write_guests());

create policy "guests_update_writers"
on public.guests
for update
to authenticated
using (private.can_write_guests())
with check (private.can_write_guests());

create policy "guests_delete_writers"
on public.guests
for delete
to authenticated
using (private.can_write_guests());

create index rooms_status_type_idx on public.rooms (status, type);
create index rooms_floor_idx on public.rooms (floor);
create index rooms_number_idx on public.rooms (number);

create index guests_status_idx on public.guests (status);
create index guests_email_lower_idx on public.guests (lower(email));
create index guests_name_idx on public.guests (lower(last_name), lower(first_name));
create index guests_created_at_id_idx on public.guests (created_at desc, id desc);
