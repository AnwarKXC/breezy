create type public.app_role as enum ('admin', 'accountant', 'front_desk');
create type public.booking_status as enum ('pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled');
create type public.log_module as enum ('accounting', 'auth', 'contacts', 'reservations', 'users');
create type public.log_action as enum (
  'accounting_created',
  'accounting_deleted',
  'accounting_updated',
  'contact_created',
  'contact_deleted',
  'contact_updated',
  'login',
  'logout',
  'reservation_created',
  'reservation_deleted',
  'reservation_updated',
  'user_created',
  'user_deleted',
  'user_updated',
  'user_viewed'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  external_firebase_id text unique,
  name text not null,
  email text not null unique,
  phone text,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  external_firebase_id text unique,
  action public.log_action not null,
  module public.log_module not null,
  description text not null,
  actor jsonb not null,
  target jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_is_object check (jsonb_typeof(actor) = 'object'),
  constraint audit_logs_target_is_object check (target is null or jsonb_typeof(target) = 'object'),
  constraint audit_logs_metadata_is_object check (metadata is null or jsonb_typeof(metadata) = 'object')
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  external_firebase_id text unique,
  guest_id text not null,
  guest_name text not null,
  room_id text not null,
  room_number text not null,
  check_in timestamptz not null,
  check_out timestamptz not null,
  status public.booking_status not null default 'pending',
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_check_out_after_check_in check (check_out >= check_in),
  constraint bookings_total_amount_nonnegative check (total_amount >= 0),
  constraint bookings_paid_amount_nonnegative check (paid_amount >= 0)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin'::public.app_role, false)
$$;

create or replace function public.can_read_logs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
$$;

create or replace function public.can_read_bookings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function public.can_write_bookings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.bookings enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_admin"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "profiles_delete_admin"
on public.profiles
for delete
to authenticated
using (public.is_admin());

create policy "audit_logs_insert_authenticated"
on public.audit_logs
for insert
to authenticated
with check (true);

create policy "audit_logs_select_logs_readers"
on public.audit_logs
for select
to authenticated
using (public.can_read_logs());

create policy "bookings_select_staff"
on public.bookings
for select
to authenticated
using (public.can_read_bookings());

create policy "bookings_insert_writers"
on public.bookings
for insert
to authenticated
with check (public.can_write_bookings());

create policy "bookings_update_writers"
on public.bookings
for update
to authenticated
using (public.can_write_bookings())
with check (public.can_write_bookings());

create policy "bookings_delete_writers"
on public.bookings
for delete
to authenticated
using (public.can_write_bookings());

create index profiles_role_created_at_id_idx on public.profiles (role, created_at desc, id desc);
create index profiles_created_at_id_idx on public.profiles (created_at desc, id desc);
create index profiles_email_lower_idx on public.profiles (lower(email));
create index profiles_name_lower_idx on public.profiles (lower(name));
create index profiles_phone_idx on public.profiles (phone);

create index audit_logs_created_at_id_idx on public.audit_logs (created_at desc, id desc);
create index audit_logs_action_created_at_id_idx on public.audit_logs (action, created_at desc, id desc);
create index audit_logs_module_created_at_id_idx on public.audit_logs (module, created_at desc, id desc);
create index audit_logs_actor_id_created_at_id_idx on public.audit_logs (((actor ->> 'id')), created_at desc, id desc);
create index audit_logs_combined_filter_idx on public.audit_logs (action, module, ((actor ->> 'id')), created_at desc, id desc);

create index bookings_guest_check_in_id_idx on public.bookings (guest_id, check_in desc, id desc);
create index bookings_check_in_id_idx on public.bookings (check_in desc, id desc);
create index bookings_status_idx on public.bookings (status);
