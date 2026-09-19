create type public.contact_type as enum ('company', 'individual');
create type public.occupancy_code as enum ('S', 'D', 'T');

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  type public.contact_type not null,
  name text not null,
  phone text not null,
  email text,

  logo text,

  country text,
  city text,
  responsible_person text,

  id_passport text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_price_overrides (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  room_category text not null,
  occupancy_code public.occupancy_code not null,
  price numeric(10,2) not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_price_overrides_price_nonnegative check (price >= 0)
);

create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

create trigger company_price_overrides_set_updated_at
before update on public.company_price_overrides
for each row
execute function public.set_updated_at();

create or replace function private.can_read_contacts()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_write_contacts()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_write_company_price_overrides()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin()
$$;

alter table public.contacts enable row level security;
alter table public.company_price_overrides enable row level security;

create policy "contacts_select_staff"
on public.contacts
for select
to authenticated
using (private.can_read_contacts());

create policy "contacts_insert_writers"
on public.contacts
for insert
to authenticated
with check (private.can_write_contacts());

create policy "contacts_update_writers"
on public.contacts
for update
to authenticated
using (private.can_write_contacts())
with check (private.can_write_contacts());

create policy "contacts_delete_writers"
on public.contacts
for delete
to authenticated
using (private.can_write_contacts());

create policy "company_price_overrides_select_readers"
on public.company_price_overrides
for select
to authenticated
using (private.can_read_contacts());

create policy "company_price_overrides_insert_admin"
on public.company_price_overrides
for insert
to authenticated
with check (private.can_write_company_price_overrides());

create policy "company_price_overrides_update_admin"
on public.company_price_overrides
for update
to authenticated
using (private.can_write_company_price_overrides())
with check (private.can_write_company_price_overrides());

create policy "company_price_overrides_delete_admin"
on public.company_price_overrides
for delete
to authenticated
using (private.can_write_company_price_overrides());

create index contacts_type_name_idx on public.contacts (type, lower(name));
create index contacts_type_created_at_id_idx on public.contacts (type, created_at desc, id desc);
create index contacts_created_at_id_idx on public.contacts (created_at desc, id desc);
create index contacts_phone_idx on public.contacts (phone);
create index contacts_email_lower_idx on public.contacts (lower(email));
create index contacts_country_city_idx on public.contacts (country, city);
create index contacts_name_lower_idx on public.contacts (lower(name));

create index company_price_overrides_contact_id_idx on public.company_price_overrides (contact_id);
create index company_price_overrides_room_category_occupancy_idx on public.company_price_overrides (contact_id, room_category, occupancy_code);
