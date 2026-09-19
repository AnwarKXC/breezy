-- ========================================================================
-- 20260520000000 — Add room_types, room_type_pricing, and settings features
-- ========================================================================

-- Create tables
create table if not exists public.room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  base_price numeric(10,2) not null,
  default_capacity integer not null,
  amenities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_types_name_unique unique (name),
  constraint room_types_slug_unique unique (slug),
  constraint room_types_base_price_nonnegative check (base_price >= 0),
  constraint room_types_default_capacity_positive check (default_capacity > 0)
);

create table if not exists public.room_type_pricing (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  price numeric(10,2) not null,
  currency text not null default 'USD',
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_type_pricing_price_nonnegative check (price >= 0)
);

-- Updated_at triggers (shared function)
create trigger room_types_set_updated_at
  before update on public.room_types
  for each row execute function public.set_updated_at();

create trigger room_type_pricing_set_updated_at
  before update on public.room_type_pricing
  for each row execute function public.set_updated_at();

-- Indexes
create unique index room_type_pricing_current_unique
  on public.room_type_pricing (room_type_id, currency)
  where effective_from is null;

create index room_type_pricing_room_type_id_idx on public.room_type_pricing (room_type_id);
create index room_type_pricing_effective_from_idx on public.room_type_pricing (effective_from);

-- Add room_type_id FK to rooms
alter table public.rooms
  add column room_type_id uuid references public.room_types(id) on delete restrict;

-- Backfill default room types from the existing enum
insert into public.room_types (name, slug, description, base_price, default_capacity)
values
  ('Standard', 'standard', null, 100.00, 2),
  ('Deluxe', 'deluxe', null, 180.00, 2),
  ('Suite', 'suite', null, 350.00, 4),
  ('Family', 'family', null, 250.00, 4)
on conflict (slug) do nothing;

update public.rooms r
set room_type_id = rt.id
from public.room_types rt
where rt.slug = r.type::text
  and r.room_type_id is null;

alter table public.rooms
  alter column room_type_id set not null;

alter table public.rooms
  drop column type;

drop type if exists public.room_type;

-- Index for FK lookups on rooms
create index rooms_room_type_id_idx on public.rooms (room_type_id);
create index rooms_status_room_type_id_idx on public.rooms (status, room_type_id);

-- RLS helper functions
create or replace function private.can_read_room_types()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role)
$$;

create or replace function private.can_write_room_types()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin() or private.current_app_role() = 'accountant'::public.app_role
$$;

-- RLS: room_types
alter table public.room_types enable row level security;

create policy "room_types_select_staff"
  on public.room_types for select
  to authenticated
  using (private.can_read_room_types());

create policy "room_types_insert_writers"
  on public.room_types for insert
  to authenticated
  with check (private.can_write_room_types());

create policy "room_types_update_writers"
  on public.room_types for update
  to authenticated
  using (private.can_write_room_types())
  with check (private.can_write_room_types());

create policy "room_types_delete_writers"
  on public.room_types for delete
  to authenticated
  using (private.can_write_room_types());

-- RLS: room_type_pricing
alter table public.room_type_pricing enable row level security;

create policy "room_type_pricing_select_staff"
  on public.room_type_pricing for select
  to authenticated
  using (private.can_read_room_types());

create policy "room_type_pricing_insert_writers"
  on public.room_type_pricing for insert
  to authenticated
  with check (private.can_write_room_types());

create policy "room_type_pricing_update_writers"
  on public.room_type_pricing for update
  to authenticated
  using (private.can_write_room_types())
  with check (private.can_write_room_types());

create policy "room_type_pricing_delete_writers"
  on public.room_type_pricing for delete
  to authenticated
  using (private.can_write_room_types());
