-- ============================================================
-- Migration: Add reservation schema
-- Purpose: Introduce reservation module tables, enums, RLS, and compatibility with legacy bookings
-- Covers scenarios: A01-A05
-- ============================================================

-- ============================================================
-- 1. New Enums
-- ============================================================

create type public.reservation_status as enum (
  'DRAFT',
  'HELD',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
  'EXPIRED',
  'FAILED'
);

create type public.payment_status as enum (
  'UNPAID',
  'DEPOSIT_REQUIRED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'COMPANY_BILLED',
  'GUARANTEED_ONLY'
);

create type public.billing_type as enum (
  'guest_pays_all',
  'company_pays_all',
  'company_room_only',
  'split_50_50'
);

create type public.guest_role as enum (
  'primary',
  'adult',
  'child'
);

create type public.room_assignment_state as enum (
  'assigned',
  'checked_in',
  'checked_out',
  'cancelled'
);

create type public.hold_action as enum (
  'created',
  'released',
  'expired',
  'consumed'
);

-- ============================================================
-- 2. Extend existing enums
-- ============================================================

alter type public.log_action add value if not exists 'reservation_held';
alter type public.log_action add value if not exists 'reservation_confirmed';
alter type public.log_action add value if not exists 'reservation_cancelled';
alter type public.log_action add value if not exists 'reservation_checked_in';
alter type public.log_action add value if not exists 'reservation_checked_out';
alter type public.log_action add value if not exists 'reservation_no_show';
alter type public.log_action add value if not exists 'reservation_extended';
alter type public.log_action add value if not exists 'reservation_room_changed';
alter type public.log_action add value if not exists 'reservation_note_added';
alter type public.log_action add value if not exists 'reservation_payment_recorded';
alter type public.log_action add value if not exists 'reservation_refund_recorded';
alter type public.log_action add value if not exists 'reservation_price_override';

-- ============================================================
-- 3. Reservation Tables
-- ============================================================

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  legacy_booking_id uuid references public.bookings(id) on delete set null,
  confirmation_number text unique,
  status public.reservation_status not null default 'DRAFT',
  payment_status public.payment_status not null default 'UNPAID',
  check_in date not null,
  check_out date not null,
  occupancy_adults int not null default 1 check (occupancy_adults >= 0),
  occupancy_children int not null default 0 check (occupancy_children >= 0),
  source text,
  source_booking_id text,
  cancellation_reason text,
  cancellation_at timestamptz,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  balance numeric(12,2) not null default 0,
  currency text not null default 'EGP',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reservations_check_out_after_check_in check (check_out > check_in)
);

create table public.reservation_rooms (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  room_type_id uuid references public.room_types(id) on delete set null,
  assignment_state public.room_assignment_state not null default 'assigned',
  assigned_at timestamptz default now(),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_at timestamptz,
  nightly_rate numeric(10,2) not null default 0,
  currency text not null default 'EGP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.reservation_guests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  reservation_room_id uuid references public.reservation_rooms(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  role public.guest_role not null default 'adult',
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  passport_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservation_company_info (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  billing_type public.billing_type not null default 'guest_pays_all',
  company_name text not null,
  company_address text,
  company_tax_id text,
  responsible_person_name text,
  responsible_person_phone text,
  responsible_person_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_company_info_unique_per_reservation unique (reservation_id)
);

create table public.reservation_pricing_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  reservation_room_id uuid references public.reservation_rooms(id) on delete cascade,
  item_type text not null check (item_type in (
    'nightly_rate', 'extra_bed', 'meal_plan', 'service_charge', 'tax',
    'discount', 'fee', 'manual_adjustment', 'cancellation_fee', 'no_show_fee'
  )),
  description text not null default '',
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'EGP',
  payer text not null default 'guest' check (payer in ('guest', 'company')),
  price_source text not null default 'standard' check (price_source in (
    'standard', 'seasonal', 'room_specific', 'company_override', 'manual_override', 'system'
  )),
  date date,
  created_at timestamptz not null default now()
);

create table public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  payment_type public.payment_type not null,
  payment_subtype text not null default 'payment' check (payment_subtype in ('payment', 'deposit', 'refund', 'guarantee')),
  amount numeric(12,2) not null check (amount != 0),
  currency text not null default 'EGP',
  reference_number text,
  idempotency_key text unique,
  payment_method_details jsonb,
  notes text,
  processed_by uuid references auth.users(id),
  processed_at timestamptz not null default now(),
  reversal_of_payment_id uuid references public.reservation_payments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_reservation_payments_idempotency on public.reservation_payments(idempotency_key) where idempotency_key is not null;

create table public.reservation_holds (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  room_type_id uuid references public.room_types(id) on delete set null,
  check_in date not null,
  check_out date not null,
  expires_at timestamptz not null,
  action public.hold_action not null default 'created',
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_reservation_holds_active on public.reservation_holds (room_id, check_in, check_out)
  where action = 'created' and expires_at > now();

create table public.reservation_notes (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  author_id uuid references auth.users(id),
  visibility text not null default 'internal' check (visibility in ('internal', 'guest_visible', 'admin_only')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  old_status public.reservation_status,
  new_status public.reservation_status not null,
  changed_by uuid references auth.users(id),
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.room_status_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  old_status public.room_status,
  new_status public.room_status not null,
  reservation_id uuid references public.reservations(id) on delete set null,
  notes text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.deposit_policy_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null unique,
  applies_to text not null default 'all' check (applies_to in ('all', 'rate', 'company', 'source', 'season')),
  applies_to_value text,
  deposit_type text not null default 'percentage' check (deposit_type in ('percentage', 'fixed', 'first_night', 'full_stay')),
  deposit_amount numeric(12,2) not null,
  due_before_checkin_days int not null default 0,
  is_active boolean not null default true,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_override_audit_log (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  old_amount numeric(12,2) not null,
  new_amount numeric(12,2) not null,
  delta numeric(12,2) not null,
  reason text not null,
  approval_id text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. Updated_at triggers
-- ============================================================

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

create trigger reservation_rooms_set_updated_at
  before update on public.reservation_rooms
  for each row execute function public.set_updated_at();

create trigger reservation_guests_set_updated_at
  before update on public.reservation_guests
  for each row execute function public.set_updated_at();

create trigger reservation_company_info_set_updated_at
  before update on public.reservation_company_info
  for each row execute function public.set_updated_at();

create trigger deposit_policy_rules_set_updated_at
  before update on public.deposit_policy_rules
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. Indexes for performance
-- ============================================================

create index idx_reservations_status on public.reservations(status);
create index idx_reservations_dates on public.reservations(check_in, check_out);
create index idx_reservations_legacy_booking on public.reservations(legacy_booking_id) where legacy_booking_id is not null;
create index idx_reservations_confirmation on public.reservations(confirmation_number) where confirmation_number is not null;
create index idx_reservations_created_by on public.reservations(created_by);
create index idx_reservations_deleted_at on public.reservations(deleted_at);

create index idx_reservation_rooms_reservation on public.reservation_rooms(reservation_id);
create index idx_reservation_rooms_room on public.reservation_rooms(room_id);
create index idx_reservation_rooms_state on public.reservation_rooms(assignment_state);
create index idx_reservation_rooms_deleted_at on public.reservation_rooms(deleted_at);

create index idx_reservation_guests_reservation on public.reservation_guests(reservation_id);
create index idx_reservation_guests_guest on public.reservation_guests(guest_id);
create index idx_reservation_guests_contact on public.reservation_guests(contact_id);

create index idx_reservation_company_info_reservation on public.reservation_company_info(reservation_id);
create index idx_reservation_company_info_contact on public.reservation_company_info(contact_id);

create index idx_reservation_pricing_items_reservation on public.reservation_pricing_items(reservation_id);
create index idx_reservation_pricing_items_room on public.reservation_pricing_items(reservation_room_id);

create index idx_reservation_payments_reservation on public.reservation_payments(reservation_id);
create index idx_reservation_payments_reversal on public.reservation_payments(reversal_of_payment_id);

create index idx_reservation_holds_reservation on public.reservation_holds(reservation_id);
create index idx_reservation_holds_room on public.reservation_holds(room_id);
create index idx_reservation_holds_expires on public.reservation_holds(expires_at);

create index idx_reservation_notes_reservation on public.reservation_notes(reservation_id);
create index idx_reservation_notes_author on public.reservation_notes(author_id);

create index idx_reservation_status_history_reservation on public.reservation_status_history(reservation_id);
create index idx_reservation_status_history_created on public.reservation_status_history(created_at desc);

create index idx_room_status_history_room on public.room_status_history(room_id);
create index idx_room_status_history_created on public.room_status_history(created_at desc);
create index idx_room_status_history_reservation on public.room_status_history(reservation_id);

create index idx_price_override_audit_reservation on public.price_override_audit_log(reservation_id);

-- ============================================================
-- 6. RLS Helper Functions (private schema)
-- ============================================================

create or replace function private.can_read_reservations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_write_reservations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_manage_pricing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin()
$$;

create or replace function private.can_override_pricing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'front_desk'::public.app_role)
$$;

create or replace function private.can_manage_deposit_policies()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin()
$$;

-- ============================================================
-- 7. RLS Policies
-- ============================================================

-- reservations
alter table public.reservations enable row level security;

create policy "reservations_select_staff"
  on public.reservations for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservations_insert_writers"
  on public.reservations for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservations_update_writers"
  on public.reservations for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

create policy "reservations_delete_writers"
  on public.reservations for delete
  to authenticated
  using (private.can_write_reservations());

-- reservation_rooms
alter table public.reservation_rooms enable row level security;

create policy "reservation_rooms_select_staff"
  on public.reservation_rooms for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_rooms_insert_writers"
  on public.reservation_rooms for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservation_rooms_update_writers"
  on public.reservation_rooms for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

create policy "reservation_rooms_delete_writers"
  on public.reservation_rooms for delete
  to authenticated
  using (private.can_write_reservations());

-- reservation_guests
alter table public.reservation_guests enable row level security;

create policy "reservation_guests_select_staff"
  on public.reservation_guests for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_guests_insert_writers"
  on public.reservation_guests for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservation_guests_update_writers"
  on public.reservation_guests for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

create policy "reservation_guests_delete_writers"
  on public.reservation_guests for delete
  to authenticated
  using (private.can_write_reservations());

-- reservation_company_info
alter table public.reservation_company_info enable row level security;

create policy "reservation_company_info_select_staff"
  on public.reservation_company_info for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_company_info_insert_writers"
  on public.reservation_company_info for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservation_company_info_update_writers"
  on public.reservation_company_info for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

create policy "reservation_company_info_delete_writers"
  on public.reservation_company_info for delete
  to authenticated
  using (private.can_write_reservations());

-- reservation_pricing_items
alter table public.reservation_pricing_items enable row level security;

create policy "reservation_pricing_items_select_staff"
  on public.reservation_pricing_items for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_pricing_items_insert_writers"
  on public.reservation_pricing_items for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservation_pricing_items_update_writers"
  on public.reservation_pricing_items for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

create policy "reservation_pricing_items_delete_writers"
  on public.reservation_pricing_items for delete
  to authenticated
  using (private.can_write_reservations());

-- reservation_payments
alter table public.reservation_payments enable row level security;

create policy "reservation_payments_select_staff"
  on public.reservation_payments for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_payments_insert_writers"
  on public.reservation_payments for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservation_payments_update_writers"
  on public.reservation_payments for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

-- reservation_holds
alter table public.reservation_holds enable row level security;

create policy "reservation_holds_select_staff"
  on public.reservation_holds for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_holds_insert_writers"
  on public.reservation_holds for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservation_holds_update_writers"
  on public.reservation_holds for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

create policy "reservation_holds_delete_writers"
  on public.reservation_holds for delete
  to authenticated
  using (private.can_write_reservations());

-- reservation_notes
alter table public.reservation_notes enable row level security;

create policy "reservation_notes_select_staff"
  on public.reservation_notes for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_notes_insert_writers"
  on public.reservation_notes for insert
  to authenticated
  with check (private.can_write_reservations());

create policy "reservation_notes_update_writers"
  on public.reservation_notes for update
  to authenticated
  using (private.can_write_reservations())
  with check (private.can_write_reservations());

create policy "reservation_notes_delete_writers"
  on public.reservation_notes for delete
  to authenticated
  using (private.can_write_reservations());

-- reservation_status_history
alter table public.reservation_status_history enable row level security;

create policy "reservation_status_history_select_staff"
  on public.reservation_status_history for select
  to authenticated
  using (private.can_read_reservations());

create policy "reservation_status_history_insert_staff"
  on public.reservation_status_history for insert
  to authenticated
  with check (private.can_write_reservations());

-- room_status_history
alter table public.room_status_history enable row level security;

create policy "room_status_history_select_staff"
  on public.room_status_history for select
  to authenticated
  using (private.can_read_reservations());

create policy "room_status_history_insert_staff"
  on public.room_status_history for insert
  to authenticated
  with check (private.can_write_reservations());

-- deposit_policy_rules
alter table public.deposit_policy_rules enable row level security;

create policy "deposit_policy_rules_select_staff"
  on public.deposit_policy_rules for select
  to authenticated
  using (private.can_read_reservations());

create policy "deposit_policy_rules_insert_admin"
  on public.deposit_policy_rules for insert
  to authenticated
  with check (private.can_manage_deposit_policies());

create policy "deposit_policy_rules_update_admin"
  on public.deposit_policy_rules for update
  to authenticated
  using (private.can_manage_deposit_policies())
  with check (private.can_manage_deposit_policies());

create policy "deposit_policy_rules_delete_admin"
  on public.deposit_policy_rules for delete
  to authenticated
  using (private.can_manage_deposit_policies());

-- price_override_audit_log
alter table public.price_override_audit_log enable row level security;

create policy "price_override_audit_log_select_admin"
  on public.price_override_audit_log for select
  to authenticated
  using (private.can_read_reservations());

create policy "price_override_audit_log_insert_writers"
  on public.price_override_audit_log for insert
  to authenticated
  with check (private.can_override_pricing());

-- ============================================================
-- 8. Sequence for confirmation numbers
-- ============================================================

create sequence if not exists public.reservation_confirmation_seq start 1000;

create or replace function public.generate_confirmation_number()
returns text
language sql
as $$
  select 'CNF-' || LPAD(nextval('public.reservation_confirmation_seq')::text, 6, '0')
$$;

-- ============================================================
-- 9. Create a compatibility view for legacy booking + reservation
-- ============================================================

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
