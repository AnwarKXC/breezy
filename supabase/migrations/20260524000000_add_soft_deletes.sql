alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.bookings add column if not exists deleted_at timestamptz;
alter table public.rooms add column if not exists deleted_at timestamptz;
alter table public.guests add column if not exists deleted_at timestamptz;
alter table public.contacts add column if not exists deleted_at timestamptz;
alter table public.company_price_overrides add column if not exists deleted_at timestamptz;
alter table public.invoices add column if not exists deleted_at timestamptz;
alter table public.room_types add column if not exists deleted_at timestamptz;
alter table public.room_type_pricing add column if not exists deleted_at timestamptz;

alter table public.profiles drop constraint if exists profiles_email_key;
alter table public.rooms drop constraint if exists rooms_number_key;
alter table public.guests drop constraint if exists guests_email_key;
alter table public.room_types drop constraint if exists room_types_name_unique;
alter table public.room_types drop constraint if exists room_types_slug_unique;
alter table public.invoices drop constraint if exists invoices_invoice_number_unique;

drop index if exists room_type_pricing_current_unique;

create unique index if not exists profiles_email_active_unique
  on public.profiles (email)
  where deleted_at is null;

create unique index if not exists rooms_number_active_unique
  on public.rooms (number)
  where deleted_at is null;

create unique index if not exists guests_email_active_unique
  on public.guests (email)
  where deleted_at is null;

create unique index if not exists room_types_name_active_unique
  on public.room_types (name)
  where deleted_at is null;

create unique index if not exists room_types_slug_active_unique
  on public.room_types (slug)
  where deleted_at is null;

create unique index if not exists invoices_invoice_number_active_unique
  on public.invoices (invoice_number)
  where deleted_at is null;

create unique index if not exists room_type_pricing_current_active_unique
  on public.room_type_pricing (room_type_id)
  where effective_until is null and deleted_at is null;

create index if not exists profiles_deleted_at_idx on public.profiles (deleted_at);
create index if not exists bookings_deleted_at_idx on public.bookings (deleted_at);
create index if not exists rooms_deleted_at_idx on public.rooms (deleted_at);
create index if not exists guests_deleted_at_idx on public.guests (deleted_at);
create index if not exists contacts_deleted_at_idx on public.contacts (deleted_at);
create index if not exists company_price_overrides_deleted_at_idx on public.company_price_overrides (deleted_at);
create index if not exists invoices_deleted_at_idx on public.invoices (deleted_at);
create index if not exists room_types_deleted_at_idx on public.room_types (deleted_at);
create index if not exists room_type_pricing_deleted_at_idx on public.room_type_pricing (deleted_at);
