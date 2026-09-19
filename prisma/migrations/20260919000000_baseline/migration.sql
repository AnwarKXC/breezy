-- Baseline: Supabase is used as a plain Postgres database.
-- Auth, sessions and file storage are owned by the Next.js app (Prisma).
-- Generated from the live catalog of the previous project; RLS policies and
-- Supabase Auth/Storage dependencies were removed on purpose.

SET check_function_bodies = off;

-- Remove the unused schema created by the abandoned NestJS prototype (0 rows).
DROP SCHEMA IF EXISTS app CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'front_desk');
CREATE TYPE public.billing_party AS ENUM ('guest', 'company', 'split', 'complimentary');
CREATE TYPE public.billing_type AS ENUM ('guest_pays', 'company_room_only', 'company_all_charges', 'split');
CREATE TYPE public.booking_status AS ENUM ('pending', 'booked', 'confirmed', 'checked-in', 'checked-out', 'cancelled');
CREATE TYPE public.contact_type AS ENUM ('company', 'individual');
CREATE TYPE public.guest_status AS ENUM ('active', 'inactive', 'vip', 'blacklist');
CREATE TYPE public.log_action AS ENUM ('accounting_created', 'accounting_deleted', 'accounting_updated', 'contact_created', 'contact_deleted', 'contact_updated', 'login', 'logout', 'reservation_created', 'reservation_deleted', 'reservation_updated', 'user_created', 'user_deleted', 'user_updated', 'user_viewed', 'reservation_cancelled', 'reservation_checked_in', 'reservation_checked_out', 'reservation_confirmed', 'reservation_extended', 'reservation_held', 'reservation_no_show', 'reservation_note_added', 'reservation_payment_recorded', 'reservation_price_override', 'reservation_refund_recorded', 'reservation_room_changed');
CREATE TYPE public.log_module AS ENUM ('accounting', 'auth', 'contacts', 'reservations', 'users');
CREATE TYPE public.occupancy_code AS ENUM ('S', 'D', 'T');
CREATE TYPE public.payment_type AS ENUM ('instapay', 'vodafone_cash', 'cash', 'bank_transfer', 'visa', 'card', 'online', 'ota', 'company_credit', 'other');
CREATE TYPE public.price_source AS ENUM ('default_room_type_rate', 'room_specific_rate', 'company_override', 'seasonal_rate', 'manual_override');
CREATE TYPE public.reservation_booking_type AS ENUM ('individual', 'company', 'group', 'travel_agent', 'internal');
CREATE TYPE public.reservation_guest_role AS ENUM ('primary_guest', 'additional_guest', 'company_guest', 'child');
CREATE TYPE public.reservation_payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'company_credit', 'voucher', 'other');
CREATE TYPE public.reservation_payment_type AS ENUM ('deposit', 'partial_payment', 'full_payment', 'refund', 'company_invoice', 'guarantee_only');
CREATE TYPE public.reservation_room_status AS ENUM ('selected', 'held', 'reserved', 'occupied', 'checked_out', 'cancelled', 'released');
CREATE TYPE public.reservation_source AS ENUM ('walk_in', 'phone', 'website', 'whatsapp', 'email', 'company', 'travel_agent', 'ota', 'manual');
CREATE TYPE public.reservation_status AS ENUM ('draft', 'held', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'expired');
CREATE TYPE public.room_status AS ENUM ('available', 'occupied', 'maintenance', 'cleaning', 'dirty');

-- Credentials and sessions (replaces Supabase Auth)
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);
CREATE UNIQUE INDEX users_email_key ON public.users (email);

-- id stores sha256(token); the raw token only lives in the HttpOnly cookie.
CREATE TABLE public.sessions (
  id text NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX sessions_user_id_idx ON public.sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON public.sessions (expires_at);

-- Binary uploads (contact logos) previously kept in Supabase Storage.
CREATE TABLE public.files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  data bytea NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT files_pkey PRIMARY KEY (id),
  CONSTRAINT files_size_limit CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  CONSTRAINT files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Tables
CREATE TABLE public.accounting_ledger_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL,
  type text NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  income_amount numeric(12,2) NOT NULL DEFAULT 0,
  outcome_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP'::text,
  account_category text,
  description text NOT NULL DEFAULT ''::text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  reversal_of_transaction_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  invoice_id uuid,
  contact_id uuid
);
CREATE TABLE public.accounting_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_firebase_id text,
  action log_action NOT NULL,
  module log_module NOT NULL,
  description text NOT NULL,
  actor jsonb NOT NULL,
  target jsonb,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_logs_archive (
  id uuid NOT NULL,
  external_firebase_id text,
  action log_action NOT NULL,
  module log_module NOT NULL,
  description text NOT NULL,
  actor jsonb NOT NULL,
  target jsonb,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.company_price_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  room_category text NOT NULL,
  occupancy_code occupancy_code NOT NULL,
  price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type contact_type NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  logo text,
  country text,
  city text,
  responsible_person text,
  id_passport text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);
CREATE TABLE public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  name_ar text
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  vendor text,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  receipt_url text,
  cost_center text,
  approved_by uuid,
  approved_at timestamp with time zone,
  status text NOT NULL DEFAULT 'draft'::text
);
CREATE TABLE public.guests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  country text,
  passport_number text,
  status guest_status NOT NULL DEFAULT 'active'::guest_status,
  total_bookings integer NOT NULL DEFAULT 0,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  last_visit timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);
CREATE TABLE public.invoice_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_id uuid,
  old_status text,
  new_status text,
  amount_changed numeric(10,2),
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  type text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  invoice_number text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  paid_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  payment_method text,
  room_id text,
  room_number text,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  service_charge numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  remaining_balance numeric(10,2) NOT NULL DEFAULT 0,
  stay_check_in date,
  stay_check_out date,
  created_by uuid,
  updated_by uuid,
  void_reason text,
  voided_at timestamp with time zone,
  voided_by uuid,
  guest_name text,
  company_name text,
  public_notes text,
  internal_notes text,
  issued_at timestamp with time zone,
  issued_by uuid,
  refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EGP'::text,
  billing_address text,
  reservation_id uuid,
  discount_reason text
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  type payment_type NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_number text,
  refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  void_reason text,
  received_by uuid,
  idempotency_key text
);
CREATE TABLE public.price_override_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  room_id uuid NOT NULL,
  night_date date NOT NULL,
  old_rate numeric(10,2) NOT NULL,
  new_rate numeric(10,2) NOT NULL,
  reason text NOT NULL,
  actor_id uuid NOT NULL,
  permission_level text NOT NULL,
  threshold_checked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  needs_review boolean NOT NULL DEFAULT false
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  external_firebase_id text,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);
CREATE TABLE public.rate_change_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.reservation_company_info (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  company_id uuid NOT NULL,
  company_name text NOT NULL,
  contact_person_name text,
  contact_person_phone text,
  contact_person_email text,
  tax_number text,
  billing_address text,
  payment_terms text NOT NULL DEFAULT 'pay_on_arrival'::text,
  credit_limit numeric(12,2),
  credit_approved boolean NOT NULL DEFAULT false,
  company_rate_plan_id uuid,
  company_price_override_applied boolean NOT NULL DEFAULT false,
  company_pays text NOT NULL DEFAULT 'room_only'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.reservation_guests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  guest_id uuid,
  role reservation_guest_role NOT NULL DEFAULT 'additional_guest'::reservation_guest_role,
  full_name text NOT NULL,
  phone text,
  email text,
  nationality text,
  document_type text,
  document_number text,
  assigned_room_id uuid,
  reservation_room_id uuid,
  is_primary boolean NOT NULL DEFAULT false,
  is_vip boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  contact_id uuid
);
CREATE TABLE public.reservation_holds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid,
  room_id uuid NOT NULL,
  held_by_user_id uuid NOT NULL,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.reservation_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'front_desk'::text,
  visibility text NOT NULL DEFAULT 'internal'::text,
  message text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.reservation_pricing_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  reservation_room_id uuid,
  pricing_level text NOT NULL DEFAULT 'room'::text,
  price_date date,
  room_id uuid,
  room_type_id uuid,
  base_rate numeric(12,2) NOT NULL DEFAULT 0,
  applied_rate numeric(12,2) NOT NULL DEFAULT 0,
  nights integer NOT NULL DEFAULT 1,
  quantity integer NOT NULL DEFAULT 1,
  discount_type text,
  discount_value numeric(12,2),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  service_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD'::text,
  price_source price_source NOT NULL,
  manual_override_reason text,
  manual_override_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source_type text,
  source_ref uuid,
  rate_per_night_at_booking numeric(10,2)
);
CREATE TABLE public.reservation_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  room_id uuid NOT NULL,
  room_type_id uuid NOT NULL,
  stay_segment_type text NOT NULL DEFAULT 'full_stay'::text,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  status reservation_room_status NOT NULL DEFAULT 'selected'::reservation_room_status,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  infants integer NOT NULL DEFAULT 0,
  assigned_guest_id uuid,
  rate_per_night numeric(12,2) NOT NULL DEFAULT 0,
  nights integer NOT NULL,
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  price_source price_source NOT NULL DEFAULT 'default_room_type_rate'::price_source,
  housekeeping_requirement text NOT NULL DEFAULT 'clean_required'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  occupancy_code occupancy_code
);
CREATE TABLE public.reservation_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_number text NOT NULL,
  booking_type reservation_booking_type NOT NULL,
  status reservation_status NOT NULL DEFAULT 'draft'::reservation_status,
  source reservation_source NOT NULL DEFAULT 'manual'::reservation_source,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  check_in_time time without time zone,
  check_out_time time without time zone,
  nights integer NOT NULL,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  infants integer NOT NULL DEFAULT 0,
  room_count integer NOT NULL DEFAULT 1,
  primary_guest_id uuid,
  company_id uuid,
  booker_name text,
  booker_phone text,
  booker_email text,
  billing_party billing_party NOT NULL DEFAULT 'guest'::billing_party,
  currency text NOT NULL DEFAULT 'USD'::text,
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  service_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance_amount numeric(12,2) NOT NULL DEFAULT 0,
  guarantee_type text NOT NULL DEFAULT 'none'::text,
  special_requests text,
  internal_notes text,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cancelled_at timestamp with time zone,
  checked_in_at timestamp with time zone,
  checked_out_at timestamp with time zone,
  deleted_at timestamp with time zone,
  billing_type billing_type NOT NULL DEFAULT 'guest_pays'::billing_type,
  split_percentage numeric(5,2)
);
CREATE TABLE public.room_specific_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  override_rate numeric(10,2) NOT NULL,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.room_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  reservation_id uuid,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.room_type_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_type_id uuid NOT NULL,
  price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  effective_from timestamp with time zone,
  effective_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  price_single numeric,
  price_double numeric,
  price_triple numeric
);
CREATE TABLE public.room_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  base_price numeric(10,2) NOT NULL,
  default_capacity integer NOT NULL,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  number text NOT NULL,
  floor integer NOT NULL,
  status room_status NOT NULL DEFAULT 'available'::room_status,
  price numeric(10,2) NOT NULL,
  capacity integer NOT NULL,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  room_type_id uuid NOT NULL,
  deleted_at timestamp with time zone
);
CREATE TABLE public.seasonal_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  room_type_id uuid NOT NULL,
  override_rate numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  status text NOT NULL DEFAULT 'active'::text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.accounting_settings ADD CONSTRAINT accounting_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_logs_archive ADD CONSTRAINT audit_logs_archive_pkey PRIMARY KEY (id);
ALTER TABLE public.company_price_overrides ADD CONSTRAINT company_price_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);
ALTER TABLE public.guests ADD CONSTRAINT guests_pkey PRIMARY KEY (id);
ALTER TABLE public.invoice_events ADD CONSTRAINT invoice_events_pkey PRIMARY KEY (id);
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE public.price_override_audit_log ADD CONSTRAINT price_override_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.rate_change_audit_log ADD CONSTRAINT rate_change_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_company_info ADD CONSTRAINT reservation_company_info_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_guests ADD CONSTRAINT reservation_guests_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_holds ADD CONSTRAINT reservation_holds_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_notes ADD CONSTRAINT reservation_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_pricing_items ADD CONSTRAINT reservation_pricing_items_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_pkey PRIMARY KEY (id);
ALTER TABLE public.reservation_status_history ADD CONSTRAINT reservation_status_history_pkey PRIMARY KEY (id);
ALTER TABLE public.reservations ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);
ALTER TABLE public.room_specific_rates ADD CONSTRAINT room_specific_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.room_status_history ADD CONSTRAINT room_status_history_pkey PRIMARY KEY (id);
ALTER TABLE public.room_type_pricing ADD CONSTRAINT room_type_pricing_pkey PRIMARY KEY (id);
ALTER TABLE public.room_types ADD CONSTRAINT room_types_pkey PRIMARY KEY (id);
ALTER TABLE public.rooms ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);
ALTER TABLE public.seasonal_rates ADD CONSTRAINT seasonal_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_transaction_number_key UNIQUE (transaction_number);
ALTER TABLE public.accounting_settings ADD CONSTRAINT accounting_settings_key_key UNIQUE (key);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_external_firebase_id_key UNIQUE (external_firebase_id);
ALTER TABLE public.company_price_overrides ADD CONSTRAINT company_price_overrides_unique_override UNIQUE (contact_id, room_category, occupancy_code);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_external_firebase_id_key UNIQUE (external_firebase_id);
ALTER TABLE public.reservation_company_info ADD CONSTRAINT reservation_company_info_reservation_id_key UNIQUE (reservation_id);
ALTER TABLE public.reservations ADD CONSTRAINT reservations_reservation_number_key UNIQUE (reservation_number);
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_credit_amount_check CHECK ((outcome_amount >= (0)::numeric));
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_debit_amount_check CHECK ((income_amount >= (0)::numeric));
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_source_type_check CHECK ((source_type = ANY (ARRAY['invoice'::text, 'payment'::text, 'expense'::text, 'booking'::text, 'manual'::text])));
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_type_check CHECK ((type = ANY (ARRAY['revenue'::text, 'payment'::text, 'expense'::text, 'refund'::text, 'adjustment'::text, 'tax'::text, 'deposit'::text, 'reversal'::text])));
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_is_object CHECK ((jsonb_typeof(actor) = 'object'::text));
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_metadata_is_object CHECK (((metadata IS NULL) OR (jsonb_typeof(metadata) = 'object'::text)));
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_target_is_object CHECK (((target IS NULL) OR (jsonb_typeof(target) = 'object'::text)));
ALTER TABLE public.company_price_overrides ADD CONSTRAINT company_price_overrides_price_nonnegative CHECK ((price >= (0)::numeric));
ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'paid'::text, 'void'::text])));
ALTER TABLE public.guests ADD CONSTRAINT guests_total_bookings_nonnegative CHECK ((total_bookings >= 0));
ALTER TABLE public.guests ADD CONSTRAINT guests_total_spent_nonnegative CHECK ((total_spent >= (0)::numeric));
ALTER TABLE public.invoice_events ADD CONSTRAINT invoice_events_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'draft_saved'::text, 'updated'::text, 'issued'::text, 'voided'::text, 'payment_recorded'::text, 'payment_refunded'::text, 'payment_voided'::text, 'adjusted'::text, 'pdf_downloaded'::text, 'printed'::text, 'status_changed'::text])));
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_type_check CHECK ((type = ANY (ARRAY['room_charge'::text, 'extra_service'::text, 'minibar'::text, 'laundry'::text, 'restaurant'::text, 'late_checkout'::text, 'early_check_in'::text, 'damage_fee'::text, 'cleaning_fee'::text, 'parking'::text, 'transportation'::text, 'discount'::text, 'tax'::text, 'service_charge'::text, 'manual_adjustment'::text, 'cancellation_fee'::text, 'other'::text])));
ALTER TABLE public.invoices ADD CONSTRAINT invoices_amount_nonnegative CHECK ((amount >= (0)::numeric));
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'partially_paid'::text, 'partially_refunded'::text, 'paid'::text, 'overdue'::text, 'void'::text, 'refunded'::text])));
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK ((amount <> (0)::numeric));
ALTER TABLE public.price_override_audit_log ADD CONSTRAINT price_override_audit_log_permission_level_check CHECK ((permission_level = ANY (ARRAY['admin'::text, 'front_desk'::text])));
ALTER TABLE public.rate_change_audit_log ADD CONSTRAINT rate_change_audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])));
ALTER TABLE public.reservation_holds ADD CONSTRAINT reservation_holds_check_out_after_check_in CHECK ((check_out_date > check_in_date));
ALTER TABLE public.reservation_pricing_items ADD CONSTRAINT reservation_pricing_items_source_type_check CHECK ((source_type = ANY (ARRAY['default_rate'::text, 'seasonal_rate'::text, 'room_specific_rate'::text, 'company_override'::text, 'manual_override'::text])));
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_adults_nonnegative CHECK ((adults >= 0));
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_check_out_after_check_in CHECK ((check_out_date > check_in_date));
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_children_nonnegative CHECK ((children >= 0));
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_infants_nonnegative CHECK ((infants >= 0));
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_nights_positive CHECK ((nights > 0));
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_total_nonnegative CHECK ((total_amount >= (0)::numeric));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_adults_nonnegative CHECK ((adults >= 0));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_at_least_one_guest CHECK (((adults + children) > 0));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_balance_amount_nonnegative CHECK ((balance_amount >= (0)::numeric));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_check_out_after_check_in CHECK ((check_out_date > check_in_date));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_children_nonnegative CHECK ((children >= 0));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_infants_nonnegative CHECK ((infants >= 0));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_nights_positive CHECK ((nights > 0));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_paid_amount_nonnegative CHECK ((paid_amount >= (0)::numeric));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_room_count_positive CHECK ((room_count > 0));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_split_percentage_check CHECK (((split_percentage >= (0)::numeric) AND (split_percentage <= (100)::numeric)));
ALTER TABLE public.reservations ADD CONSTRAINT reservations_total_amount_nonnegative CHECK ((total_amount >= (0)::numeric));
ALTER TABLE public.room_specific_rates ADD CONSTRAINT room_specific_rates_override_rate_check CHECK ((override_rate >= (0)::numeric));
ALTER TABLE public.room_type_pricing ADD CONSTRAINT room_type_pricing_price_nonnegative CHECK ((price >= (0)::numeric));
ALTER TABLE public.room_types ADD CONSTRAINT room_types_base_price_nonnegative CHECK ((base_price >= (0)::numeric));
ALTER TABLE public.room_types ADD CONSTRAINT room_types_default_capacity_positive CHECK ((default_capacity > 0));
ALTER TABLE public.rooms ADD CONSTRAINT rooms_capacity_positive CHECK ((capacity > 0));
ALTER TABLE public.rooms ADD CONSTRAINT rooms_price_nonnegative CHECK ((price >= (0)::numeric));
ALTER TABLE public.seasonal_rates ADD CONSTRAINT seasonal_rates_override_rate_check CHECK ((override_rate >= (0)::numeric));
ALTER TABLE public.seasonal_rates ADD CONSTRAINT seasonal_rates_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_no_overlap EXCLUDE USING gist (room_id WITH =, daterange(check_in_date, check_out_date, '[)'::text) WITH &&) WHERE (((deleted_at IS NULL) AND (status = ANY (ARRAY['held'::reservation_room_status, 'reserved'::reservation_room_status, 'occupied'::reservation_room_status]))));
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_reversal_of_transaction_id_fkey FOREIGN KEY (reversal_of_transaction_id) REFERENCES accounting_ledger_entries(id);
ALTER TABLE public.accounting_settings ADD CONSTRAINT accounting_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE public.company_price_overrides ADD CONSTRAINT company_price_overrides_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.invoice_events ADD CONSTRAINT invoice_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);
ALTER TABLE public.invoice_events ADD CONSTRAINT invoice_events_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);
ALTER TABLE public.price_override_audit_log ADD CONSTRAINT price_override_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);
ALTER TABLE public.price_override_audit_log ADD CONSTRAINT price_override_audit_log_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id);
ALTER TABLE public.price_override_audit_log ADD CONSTRAINT price_override_audit_log_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.rate_change_audit_log ADD CONSTRAINT rate_change_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);
ALTER TABLE public.reservation_company_info ADD CONSTRAINT reservation_company_info_company_id_fkey FOREIGN KEY (company_id) REFERENCES contacts(id);
ALTER TABLE public.reservation_company_info ADD CONSTRAINT reservation_company_info_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_guests ADD CONSTRAINT reservation_guests_assigned_room_id_fkey FOREIGN KEY (assigned_room_id) REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE public.reservation_guests ADD CONSTRAINT reservation_guests_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.reservation_guests ADD CONSTRAINT reservation_guests_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE public.reservation_guests ADD CONSTRAINT reservation_guests_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_guests ADD CONSTRAINT reservation_guests_reservation_room_id_fkey FOREIGN KEY (reservation_room_id) REFERENCES reservation_rooms(id) ON DELETE SET NULL;
ALTER TABLE public.reservation_holds ADD CONSTRAINT reservation_holds_held_by_user_id_fkey FOREIGN KEY (held_by_user_id) REFERENCES profiles(id);
ALTER TABLE public.reservation_holds ADD CONSTRAINT reservation_holds_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_holds ADD CONSTRAINT reservation_holds_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id);
ALTER TABLE public.reservation_notes ADD CONSTRAINT reservation_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.reservation_notes ADD CONSTRAINT reservation_notes_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_pricing_items ADD CONSTRAINT reservation_pricing_items_manual_override_by_fkey FOREIGN KEY (manual_override_by) REFERENCES profiles(id);
ALTER TABLE public.reservation_pricing_items ADD CONSTRAINT reservation_pricing_items_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_pricing_items ADD CONSTRAINT reservation_pricing_items_reservation_room_id_fkey FOREIGN KEY (reservation_room_id) REFERENCES reservation_rooms(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_assigned_guest_id_fkey FOREIGN KEY (assigned_guest_id) REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id);
ALTER TABLE public.reservation_rooms ADD CONSTRAINT reservation_rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES room_types(id);
ALTER TABLE public.reservation_status_history ADD CONSTRAINT reservation_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id);
ALTER TABLE public.reservation_status_history ADD CONSTRAINT reservation_status_history_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_company_id_fkey FOREIGN KEY (company_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.reservations ADD CONSTRAINT reservations_primary_guest_id_fkey FOREIGN KEY (primary_guest_id) REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
ALTER TABLE public.room_specific_rates ADD CONSTRAINT room_specific_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.room_specific_rates ADD CONSTRAINT room_specific_rates_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id);
ALTER TABLE public.room_status_history ADD CONSTRAINT room_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id);
ALTER TABLE public.room_status_history ADD CONSTRAINT room_status_history_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations(id);
ALTER TABLE public.room_status_history ADD CONSTRAINT room_status_history_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id);
ALTER TABLE public.room_type_pricing ADD CONSTRAINT room_type_pricing_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE RESTRICT;
ALTER TABLE public.seasonal_rates ADD CONSTRAINT seasonal_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.seasonal_rates ADD CONSTRAINT seasonal_rates_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES room_types(id);
ALTER TABLE public.reservation_holds ADD CONSTRAINT reservation_holds_status_check CHECK (status IN ('active', 'released', 'expired'));
ALTER TABLE public.reservation_status_history ADD CONSTRAINT reservation_status_history_status_check CHECK (to_status IN ('draft', 'held', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'expired') AND (from_status IS NULL OR from_status IN ('draft', 'held', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'expired')));

-- Indexes
CREATE INDEX audit_logs_action_created_at_id_idx ON public.audit_logs USING btree (action, created_at DESC, id DESC);
CREATE INDEX audit_logs_actor_id_created_at_id_idx ON public.audit_logs USING btree (((actor ->> 'id'::text)), created_at DESC, id DESC);
CREATE INDEX audit_logs_combined_filter_idx ON public.audit_logs USING btree (action, module, ((actor ->> 'id'::text)), created_at DESC, id DESC);
CREATE INDEX audit_logs_created_at_id_idx ON public.audit_logs USING btree (created_at DESC, id DESC);
CREATE INDEX audit_logs_module_created_at_id_idx ON public.audit_logs USING btree (module, created_at DESC, id DESC);
CREATE INDEX idx_audit_logs_created_at_desc ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_audit_logs_module_action ON public.audit_logs USING btree (module, action);
CREATE INDEX idx_audit_logs_archive_created_at ON public.audit_logs_archive USING btree (created_at DESC);
CREATE INDEX company_price_overrides_contact_id_idx ON public.company_price_overrides USING btree (contact_id);
CREATE INDEX company_price_overrides_deleted_at_idx ON public.company_price_overrides USING btree (deleted_at);
CREATE INDEX contacts_country_city_idx ON public.contacts USING btree (country, city);
CREATE INDEX contacts_created_at_id_idx ON public.contacts USING btree (created_at DESC, id DESC);
CREATE INDEX contacts_deleted_at_idx ON public.contacts USING btree (deleted_at);
CREATE INDEX contacts_email_lower_idx ON public.contacts USING btree (lower(email));
CREATE INDEX contacts_name_lower_idx ON public.contacts USING btree (lower(name));
CREATE UNIQUE INDEX contacts_phone_unique_idx ON public.contacts USING btree (phone) WHERE ((deleted_at IS NULL) AND (phone IS NOT NULL) AND (phone <> ''::text));
CREATE INDEX contacts_type_created_at_id_idx ON public.contacts USING btree (type, created_at DESC, id DESC);
CREATE INDEX contacts_type_name_idx ON public.contacts USING btree (type, lower(name));
CREATE INDEX idx_expenses_category_id ON public.expenses USING btree (category_id);
CREATE INDEX idx_expenses_cost_center ON public.expenses USING btree (cost_center);
CREATE INDEX idx_expenses_date ON public.expenses USING btree (date);
CREATE INDEX idx_expenses_deleted_at ON public.expenses USING btree (deleted_at);
CREATE INDEX idx_expenses_status ON public.expenses USING btree (status);
CREATE INDEX idx_expenses_vendor ON public.expenses USING btree (vendor);
CREATE INDEX guests_created_at_id_idx ON public.guests USING btree (created_at DESC, id DESC);
CREATE INDEX guests_deleted_at_idx ON public.guests USING btree (deleted_at);
CREATE UNIQUE INDEX guests_email_active_unique ON public.guests USING btree (email) WHERE (deleted_at IS NULL);
CREATE INDEX guests_email_lower_idx ON public.guests USING btree (lower(email));
CREATE INDEX guests_name_idx ON public.guests USING btree (lower(last_name), lower(first_name));
CREATE INDEX guests_status_idx ON public.guests USING btree (status);
CREATE INDEX idx_invoice_events_created ON public.invoice_events USING btree (created_at DESC);
CREATE INDEX idx_invoice_events_invoice ON public.invoice_events USING btree (invoice_id);
CREATE INDEX idx_invoice_events_type ON public.invoice_events USING btree (event_type);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);
CREATE INDEX idx_invoice_items_type ON public.invoice_items USING btree (type);
CREATE INDEX idx_invoices_payment_method ON public.invoices USING btree (payment_method);
CREATE INDEX idx_invoices_reservation_id ON public.invoices USING btree (reservation_id) WHERE (reservation_id IS NOT NULL);
CREATE INDEX invoices_contact_id_idx ON public.invoices USING btree (contact_id);
CREATE INDEX invoices_deleted_at_idx ON public.invoices USING btree (deleted_at);
CREATE INDEX invoices_due_date_idx ON public.invoices USING btree (due_date);
CREATE UNIQUE INDEX invoices_invoice_number_active_unique ON public.invoices USING btree (invoice_number) WHERE (deleted_at IS NULL);
CREATE INDEX invoices_issue_date_idx ON public.invoices USING btree (issue_date DESC);
CREATE UNIQUE INDEX invoices_reservation_id_active_unique ON public.invoices USING btree (reservation_id) WHERE ((reservation_id IS NOT NULL) AND (deleted_at IS NULL) AND (status <> ALL (ARRAY['void'::text, 'cancelled'::text])));
CREATE INDEX invoices_status_idx ON public.invoices USING btree (status);
CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at);
CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);
CREATE UNIQUE INDEX payments_idempotency_key_active_unique ON public.payments USING btree (idempotency_key) WHERE ((idempotency_key IS NOT NULL) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX payments_idempotency_key_idx ON public.payments USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX idx_price_override_audit_actor ON public.price_override_audit_log USING btree (actor_id);
CREATE INDEX idx_price_override_audit_reservation ON public.price_override_audit_log USING btree (reservation_id);
CREATE INDEX idx_price_override_needs_review ON public.price_override_audit_log USING btree (needs_review);
CREATE INDEX profiles_created_at_id_idx ON public.profiles USING btree (created_at DESC, id DESC);
CREATE INDEX profiles_deleted_at_idx ON public.profiles USING btree (deleted_at);
CREATE UNIQUE INDEX profiles_email_active_unique ON public.profiles USING btree (email) WHERE (deleted_at IS NULL);
CREATE INDEX profiles_email_lower_idx ON public.profiles USING btree (lower(email));
CREATE INDEX profiles_name_lower_idx ON public.profiles USING btree (lower(name));
CREATE INDEX profiles_phone_idx ON public.profiles USING btree (phone);
CREATE INDEX profiles_role_created_at_id_idx ON public.profiles USING btree (role, created_at DESC, id DESC);
CREATE INDEX idx_rate_change_audit_actor ON public.rate_change_audit_log USING btree (actor_id);
CREATE INDEX idx_rate_change_audit_table_record ON public.rate_change_audit_log USING btree (table_name, record_id);
CREATE INDEX idx_reservation_guests_contact_id ON public.reservation_guests USING btree (contact_id);
CREATE INDEX idx_reservation_guests_guest ON public.reservation_guests USING btree (guest_id) WHERE (guest_id IS NOT NULL);
CREATE INDEX idx_reservation_guests_reservation ON public.reservation_guests USING btree (reservation_id);
CREATE UNIQUE INDEX reservation_guests_single_primary ON public.reservation_guests USING btree (reservation_id) WHERE ((is_primary = true) AND (deleted_at IS NULL));
CREATE INDEX idx_reservation_holds_active ON public.reservation_holds USING btree (room_id, check_in_date, check_out_date, expires_at) WHERE (status = 'active'::text);
CREATE INDEX idx_reservation_holds_expiry_cleanup ON public.reservation_holds USING btree (expires_at, status) WHERE (status = 'active'::text);
CREATE INDEX idx_reservation_holds_reservation ON public.reservation_holds USING btree (reservation_id);
CREATE INDEX idx_reservation_notes_reservation ON public.reservation_notes USING btree (reservation_id, created_at DESC);
CREATE INDEX idx_reservation_pricing_items_reservation ON public.reservation_pricing_items USING btree (reservation_id);
CREATE INDEX idx_reservation_pricing_items_room ON public.reservation_pricing_items USING btree (reservation_room_id) WHERE (reservation_room_id IS NOT NULL);
CREATE INDEX idx_reservation_rooms_reservation ON public.reservation_rooms USING btree (reservation_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_reservation_rooms_room_dates ON public.reservation_rooms USING btree (room_id, check_in_date, check_out_date) WHERE (deleted_at IS NULL);
CREATE INDEX idx_reservation_rooms_status ON public.reservation_rooms USING btree (status) WHERE (deleted_at IS NULL);
CREATE INDEX idx_reservation_status_history_reservation ON public.reservation_status_history USING btree (reservation_id, changed_at DESC);
CREATE INDEX idx_reservations_company ON public.reservations USING btree (company_id) WHERE ((company_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX idx_reservations_created_at ON public.reservations USING btree (created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_reservations_created_by ON public.reservations USING btree (created_by) WHERE (deleted_at IS NULL);
CREATE INDEX idx_reservations_dates ON public.reservations USING btree (check_in_date, check_out_date) WHERE (deleted_at IS NULL);
CREATE INDEX idx_reservations_primary_guest ON public.reservations USING btree (primary_guest_id) WHERE ((primary_guest_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX idx_reservations_status ON public.reservations USING btree (status) WHERE (deleted_at IS NULL);
CREATE INDEX idx_room_specific_rates_room_dates ON public.room_specific_rates USING btree (room_id, start_date, end_date);
CREATE INDEX idx_room_status_history_room_time ON public.room_status_history USING btree (room_id, changed_at DESC);
CREATE UNIQUE INDEX room_type_pricing_current_active_unique ON public.room_type_pricing USING btree (room_type_id) WHERE ((effective_until IS NULL) AND (deleted_at IS NULL));
CREATE INDEX room_type_pricing_deleted_at_idx ON public.room_type_pricing USING btree (deleted_at);
CREATE INDEX room_type_pricing_effective_from_idx ON public.room_type_pricing USING btree (effective_from);
CREATE INDEX room_type_pricing_room_type_id_idx ON public.room_type_pricing USING btree (room_type_id);
CREATE INDEX room_types_deleted_at_idx ON public.room_types USING btree (deleted_at);
CREATE UNIQUE INDEX room_types_name_active_unique ON public.room_types USING btree (name) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX room_types_slug_active_unique ON public.room_types USING btree (slug) WHERE (deleted_at IS NULL);
CREATE INDEX rooms_deleted_at_idx ON public.rooms USING btree (deleted_at);
CREATE INDEX rooms_floor_idx ON public.rooms USING btree (floor);
CREATE UNIQUE INDEX rooms_number_active_unique ON public.rooms USING btree (number) WHERE (deleted_at IS NULL);
CREATE INDEX rooms_number_idx ON public.rooms USING btree (number);
CREATE INDEX rooms_room_type_id_idx ON public.rooms USING btree (room_type_id);
CREATE INDEX rooms_status_room_type_id_idx ON public.rooms USING btree (status, room_type_id);
CREATE INDEX idx_seasonal_rates_room_type_dates ON public.seasonal_rates USING btree (room_type_id, start_date, end_date);
CREATE INDEX idx_seasonal_rates_status ON public.seasonal_rates USING btree (status);
CREATE INDEX accounting_ledger_entries_contact_id_idx ON public.accounting_ledger_entries USING btree (contact_id);
CREATE INDEX accounting_ledger_entries_invoice_id_idx ON public.accounting_ledger_entries USING btree (invoice_id);
CREATE INDEX accounting_ledger_entries_reversal_of_transaction_id_idx ON public.accounting_ledger_entries USING btree (reversal_of_transaction_id);
CREATE INDEX price_override_audit_log_room_id_idx ON public.price_override_audit_log USING btree (room_id);
CREATE INDEX reservation_company_info_company_id_idx ON public.reservation_company_info USING btree (company_id);
CREATE INDEX reservation_guests_assigned_room_id_idx ON public.reservation_guests USING btree (assigned_room_id);
CREATE INDEX reservation_guests_reservation_room_id_idx ON public.reservation_guests USING btree (reservation_room_id);
CREATE INDEX reservation_rooms_assigned_guest_id_idx ON public.reservation_rooms USING btree (assigned_guest_id);
CREATE INDEX reservation_rooms_room_type_id_idx ON public.reservation_rooms USING btree (room_type_id);
CREATE INDEX room_status_history_reservation_id_idx ON public.room_status_history USING btree (reservation_id);

-- Acting user for DB functions. Set per transaction by the app:
--   select set_config('app.user_id', '<uuid>', true)
CREATE FUNCTION private.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE
AS $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Functions
CREATE OR REPLACE FUNCTION private.current_app_role()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.role
  from public.profiles as p
  where p.id = private.current_user_id()
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.auto_clean_dirty_rooms()
 RETURNS TABLE(room_id uuid, old_status text, new_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  r record;
  sys_user uuid;
begin
  select id into sys_user from public.profiles order by created_at asc limit 1;

  for r in
    update public.rooms
    set status = 'available', updated_at = now()
    where (status = 'dirty' or status = 'cleaning')
      and updated_at <= now() - interval '2 hours'
    returning id, status::text, 'available'::text
  loop
    insert into public.room_status_history (room_id, from_status, to_status, reason, changed_by, metadata)
    values (r.id, r.old_status, 'available', 'Auto-cleaned after 2-hour timer', sys_user, '{}'::jsonb);

    room_id := r.id;
    old_status := r.old_status;
    new_status := 'available';
    return next;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_write_reservations()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role, 'front_desk'::public.app_role)
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation_hold(p_room_id uuid, p_check_in date, p_check_out date, p_reservation_id uuid DEFAULT NULL::uuid, p_hold_duration_minutes integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := private.current_user_id();
  v_hold_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Permission guard
  IF NOT public.can_write_reservations() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Check for conflicting holds/bookings
  IF EXISTS (
    SELECT 1 FROM public.reservation_holds rh
    WHERE rh.room_id = p_room_id
      AND rh.status = 'active'
      AND rh.expires_at > now()
      AND rh.check_in_date < p_check_out
      AND rh.check_out_date > p_check_in
      AND (p_reservation_id IS NULL OR rh.reservation_id != p_reservation_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is already held for this period', 'code', 'HOLD_CONFLICT');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservation_rooms rr
    JOIN public.reservations r ON r.id = rr.reservation_id
    WHERE rr.room_id = p_room_id
      AND rr.status != 'cancelled'
      AND r.status NOT IN ('cancelled', 'expired', 'checked_out')
      AND r.deleted_at IS NULL
      AND r.check_in_date < p_check_out
      AND r.check_out_date > p_check_in
      AND (p_reservation_id IS NULL OR r.id != p_reservation_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is already booked for this period', 'code', 'BOOKING_CONFLICT');
  END IF;

  -- Check room not in maintenance
  IF EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id AND status = 'maintenance') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is under maintenance', 'code', 'ROOM_MAINTENANCE');
  END IF;

  v_expires_at := now() + (p_hold_duration_minutes || ' minutes')::interval;

  INSERT INTO public.reservation_holds (
    reservation_id, room_id, held_by_user_id,
    check_in_date, check_out_date,
    status, expires_at
  ) VALUES (
    p_reservation_id, p_room_id, v_user_id,
    p_check_in, p_check_out,
    'active', v_expires_at
  )
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'room_id', p_room_id,
    'expires_at', v_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation_with_rooms(p_check_in date, p_check_out date, p_room_type_counts jsonb, p_contact_id uuid DEFAULT NULL::uuid, p_guest_name text DEFAULT ''::text, p_guest_id uuid DEFAULT NULL::uuid, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_reservation_id uuid;
  v_selected_rooms jsonb := '[]'::jsonb;
  v_room_record record;
  v_requested jsonb;
  v_room_type_id uuid;
  v_count int;
  v_occupancy_code text;
  v_got int;
  v_insufficient jsonb := '[]'::jsonb;
  v_nights int;
  v_total_amount numeric(12,2) := 0;
  v_created_reservation_room_id uuid;
  v_primary_reservation_room_id uuid;
  v_current_room_status text;
  v_contact_type text;
  v_company_id uuid;
  v_override_applied boolean := false;
  v_effective_price numeric(10,2);
  v_has_override boolean;
begin
  if p_check_in >= p_check_out then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'check_in must be before check_out')
    );
  end if;

  if p_room_type_counts is null or jsonb_array_length(p_room_type_counts) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'At least one room type is required')
    );
  end if;

  v_nights := p_check_out - p_check_in;

  if p_contact_id is not null then
    select c.type into v_contact_type
    from public.contacts c
    where c.id = p_contact_id and c.deleted_at is null;

    if v_contact_type = 'company' then
      v_company_id := p_contact_id;
    end if;
  end if;

  for v_requested in
    select value
    from jsonb_array_elements(p_room_type_counts) as counts(value)
    order by value->>'roomTypeId'
  loop
    v_room_type_id := (v_requested->>'roomTypeId')::uuid;
    v_count := (v_requested->>'count')::int;
    v_occupancy_code := v_requested->>'occupancyCode';

    if v_count < 0 then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Room count must be non-negative')
      );
    end if;

    if v_count = 0 then continue; end if;

    perform pg_advisory_xact_lock(hashtextextended('reservation-room-type:' || v_room_type_id::text, 0));

    v_got := 0;
    for v_room_record in
      select rm.id, rm.number, rm.price, rt.slug as room_type_slug
      from public.rooms rm
      join public.room_types rt on rt.id = rm.room_type_id
      where rm.room_type_id = v_room_type_id
        and rm.status::text != 'maintenance'
        and rm.deleted_at is null
        and not exists (
          select 1
          from public.reservation_rooms rr
          join public.reservations r on r.id = rr.reservation_id
          where rr.room_id = rm.id
            and rr.status::text not in ('cancelled', 'released')
            and r.status::text not in ('cancelled', 'expired', 'no_show', 'checked_out')
            and r.deleted_at is null
            and r.check_in_date < p_check_out
            and r.check_out_date > p_check_in
        )
        and not exists (
          select 1
          from public.reservation_holds rh
          where rh.room_id = rm.id
            and rh.status = 'active'
            and rh.expires_at > now()
            and rh.check_in_date < p_check_out
            and rh.check_out_date > p_check_in
        )
        and not exists (
          select 1
          from jsonb_array_elements(v_selected_rooms) vsel
          where (vsel->>'roomId')::uuid = rm.id
        )
      order by rm.number
      limit v_count
    loop
      v_effective_price := v_room_record.price;
      v_has_override := false;

      if v_company_id is not null and v_occupancy_code is not null then
        select
          cpo.price,
          true
        into v_effective_price, v_has_override
        from public.company_price_overrides cpo
        where cpo.contact_id = v_company_id
          and cpo.room_category = v_room_record.room_type_slug
          and cpo.occupancy_code = v_occupancy_code::occupancy_code
          and cpo.deleted_at is null
        limit 1;

        if not found then
          v_effective_price := v_room_record.price;
          v_has_override := false;
        end if;
      end if;

      if not v_has_override then
        select
          case
            when v_occupancy_code = 'S' then coalesce(rtp.price_single, rtp.price)
            when v_occupancy_code = 'D' then coalesce(rtp.price_double, rtp.price)
            when v_occupancy_code = 'T' then coalesce(rtp.price_triple, rtp.price)
            else rtp.price
          end,
          true
        into v_effective_price, v_has_override
        from public.room_type_pricing rtp
        where rtp.room_type_id = v_room_type_id
          and rtp.deleted_at is null
          and (rtp.effective_from is null or rtp.effective_from <= p_check_in)
          and (rtp.effective_until is null or rtp.effective_until >= p_check_out)
        order by rtp.effective_from desc nulls last
        limit 1;

        if not found then
          v_effective_price := v_room_record.price;
          v_has_override := false;
        end if;
      end if;

      if v_has_override then
        v_override_applied := true;
      end if;

      v_selected_rooms := v_selected_rooms || jsonb_build_object(
        'roomId', v_room_record.id,
        'roomNumber', v_room_record.number,
        'roomTypeId', v_room_type_id,
        'occupancyCode', v_occupancy_code,
        'nightlyRate', v_effective_price
      );
      v_got := v_got + 1;
      v_total_amount := v_total_amount + (v_effective_price * v_nights);
    end loop;

    if v_got < v_count then
      v_insufficient := v_insufficient || jsonb_build_object(
        'roomTypeId', v_room_type_id,
        'requested', v_count,
        'got', v_got
      );
    end if;
  end loop;

  if jsonb_array_length(v_insufficient) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'ROOM_UNAVAILABLE',
        'message', 'Some room types do not have enough available rooms for the requested dates',
        'details', jsonb_build_object('availability', v_insufficient)
      )
    );
  end if;

  insert into public.reservations (
    status, booking_type, source, currency,
    check_in_date, check_out_date, nights, total_amount, paid_amount,
    balance_amount, room_count, created_by, company_id, booker_name
  ) values (
    'draft'::reservation_status,
    'individual'::reservation_booking_type,
    'manual'::reservation_source,
    'EGP',
    p_check_in, p_check_out, v_nights, v_total_amount, 0,
    v_total_amount, jsonb_array_length(v_selected_rooms), p_created_by,
    v_company_id, p_guest_name
  )
  returning id into v_reservation_id;

  for v_room_record in select * from jsonb_array_elements(v_selected_rooms)
  loop
    insert into public.reservation_rooms (
      reservation_id, room_id, room_type_id,
      status, rate_per_night, nights, total_amount,
      check_in_date, check_out_date, occupancy_code
    ) values (
      v_reservation_id,
      (v_room_record.value->>'roomId')::uuid,
      (v_room_record.value->>'roomTypeId')::uuid,
      'reserved'::reservation_room_status,
      (v_room_record.value->>'nightlyRate')::numeric,
      v_nights, (v_room_record.value->>'nightlyRate')::numeric * v_nights,
      p_check_in, p_check_out,
      (v_room_record.value->>'occupancyCode')::occupancy_code
    )
    returning id into v_created_reservation_room_id;

    v_current_room_status := (select status::text from public.rooms where id = (v_room_record.value->>'roomId')::uuid);
    insert into public.room_status_history (
      room_id, from_status, to_status, reason, reservation_id, changed_by, changed_at, metadata
    ) values (
      (v_room_record.value->>'roomId')::uuid,
      v_current_room_status,
      v_current_room_status,
      'Reservation created',
      v_reservation_id, p_created_by, now(), '{}'::jsonb
    );

    if v_primary_reservation_room_id is null then
      v_primary_reservation_room_id := v_created_reservation_room_id;
    end if;
  end loop;

  insert into public.reservation_status_history (
    reservation_id, from_status, to_status, changed_by, changed_at
  ) values (
    v_reservation_id, null, 'draft', p_created_by, now()
  );

  if p_guest_name != '' then
    insert into public.reservation_guests (
      reservation_id, reservation_room_id, role, full_name,
      is_primary, is_vip, guest_id, contact_id, created_at, updated_at
    ) values (
      v_reservation_id, v_primary_reservation_room_id,
      'primary_guest'::reservation_guest_role,
      p_guest_name, true, false,
      p_guest_id, p_contact_id, now(), now()
    );
  end if;

  if v_company_id is not null then
    insert into public.reservation_company_info (
      reservation_id, company_id, company_name, contact_person_name, payment_terms,
      credit_approved, company_pays, company_price_override_applied, created_at, updated_at
    ) values (
      v_reservation_id, v_company_id, p_guest_name, p_guest_name, 'due_on_invoice',
      false, 'company'::text, v_override_applied, now(), now()
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'reservationId', v_reservation_id,
      'rooms', v_selected_rooms
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.flag_overrides_for_review(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.price_override_audit_log
  SET needs_review = true
  WHERE reservation_id = p_reservation_id
    AND threshold_checked = true
    AND needs_review = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_reservation_number()
 RETURNS text
 LANGUAGE sql
AS $function$
  select 'RSV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
$function$;

CREATE OR REPLACE FUNCTION public.get_room_availability(p_check_in date, p_check_out date, p_room_type_id uuid DEFAULT NULL::uuid, p_capacity integer DEFAULT NULL::integer, p_contact_id uuid DEFAULT NULL::uuid, p_exclude_reservation_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(room_id uuid, room_number text, floor integer, room_type_id uuid, room_type_name text, capacity integer, amenities jsonb, status text, reason text, base_price numeric, effective_price numeric, price_source text, currency text, price_single numeric, price_double numeric, price_triple numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with booked_room_ids as (
    select distinct rr.room_id
    from public.reservation_rooms rr
    join public.reservations r on r.id = rr.reservation_id
    where rr.room_id is not null
      and rr.status != 'cancelled'
      and r.status not in ('cancelled', 'expired', 'checked_out')
      and r.deleted_at is null
      and (p_exclude_reservation_id is null or r.id != p_exclude_reservation_id)
      and r.check_in_date < p_check_out
      and r.check_out_date > p_check_in
  ),
  held_room_ids as (
    select distinct rh.room_id
    from public.reservation_holds rh
    where rh.room_id is not null
      and rh.status not in ('released', 'expired')
      and rh.expires_at > now()
      and rh.check_in_date < p_check_out
      and rh.check_out_date > p_check_in
      and (p_exclude_reservation_id is null or rh.reservation_id != p_exclude_reservation_id)
  ),
  unavailable_room_ids as (
    select room_id from booked_room_ids
    union
    select room_id from held_room_ids
    union
    select id from public.rooms where status = 'maintenance'
  ),
  company_rate as (
    select
      max(cpo.price) as price,
      min(cpo.price) filter (where cpo.occupancy_code = 'S') as price_single,
      min(cpo.price) filter (where cpo.occupancy_code = 'D') as price_double,
      min(cpo.price) filter (where cpo.occupancy_code = 'T') as price_triple
    from public.company_price_overrides cpo
    where cpo.contact_id = p_contact_id
      and cpo.deleted_at is null
  ),
  seasonal_rate as (
    select
      rtp.price,
      rtp.price_single,
      rtp.price_double,
      rtp.price_triple,
      rtp.room_type_id
    from public.room_type_pricing rtp
    where (rtp.effective_from is null or rtp.effective_from <= p_check_in)
      and (rtp.effective_until is null or rtp.effective_until >= p_check_out)
      and rtp.deleted_at is null
  )
  select
    rm.id,
    rm.number,
    rm.floor,
    rt.id,
    rt.name,
    rm.capacity,
    rm.amenities,
    case
      when ua.room_id is not null then 'unavailable'
      else 'available'
    end::text,
    case
      when rm.status = 'maintenance' then 'maintenance'
      when rm.status = 'dirty' then 'dirty'
      when exists (select 1 from booked_room_ids b where b.room_id = rm.id) then 'booked'
      when exists (select 1 from held_room_ids h where h.room_id = rm.id) then 'held'
      else null
    end::text,
    rm.price,
    coalesce(
      (select cr.price from company_rate cr),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    ),
    case
      when exists (select 1 from company_rate) then 'company_override'
      when exists (select 1 from seasonal_rate sr where sr.room_type_id = rt.id) then 'seasonal'
      else 'standard'
    end::text,
    'EGP',
    coalesce(
      (select cr.price_single from company_rate cr),
      (select sr.price_single from seasonal_rate sr where sr.room_type_id = rt.id),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    ),
    coalesce(
      (select cr.price_double from company_rate cr),
      (select sr.price_double from seasonal_rate sr where sr.room_type_id = rt.id),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    ),
    coalesce(
      (select cr.price_triple from company_rate cr),
      (select sr.price_triple from seasonal_rate sr where sr.room_type_id = rt.id),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    )
  from public.rooms rm
  join public.room_types rt on rt.id = rm.room_type_id
  left join unavailable_room_ids ua on ua.room_id = rm.id
  where rm.deleted_at is null
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and (p_capacity is null or rm.capacity >= p_capacity)
  order by rm.number;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_rate_change_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := private.current_user_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rate_change_audit_log (table_name, record_id, action, old_data, new_data, actor_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, to_jsonb(NEW), v_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.rate_change_audit_log (table_name, record_id, action, old_data, new_data, actor_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.rate_change_audit_log (table_name, record_id, action, old_data, new_data, actor_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), NULL, v_user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_reservation_dates_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.check_in_date IS DISTINCT FROM NEW.check_in_date 
     OR OLD.check_out_date IS DISTINCT FROM NEW.check_out_date THEN
    PERFORM public.flag_overrides_for_review(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_reservation_rooms_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.flag_overrides_for_review(OLD.reservation_id);
    RETURN OLD;
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    PERFORM public.flag_overrides_for_review(NEW.reservation_id);
  ELSIF NEW.room_id IS DISTINCT FROM OLD.room_id THEN
    PERFORM public.flag_overrides_for_review(NEW.reservation_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Defaults that call app functions
ALTER TABLE public.reservations ALTER COLUMN reservation_number SET DEFAULT generate_reservation_number();

-- Triggers
CREATE TRIGGER company_price_overrides_audit AFTER INSERT OR DELETE OR UPDATE ON public.company_price_overrides FOR EACH ROW EXECUTE FUNCTION trg_rate_change_audit();
CREATE TRIGGER company_price_overrides_set_updated_at BEFORE UPDATE ON public.company_price_overrides FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER guests_set_updated_at BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reservation_company_info_set_updated_at BEFORE UPDATE ON public.reservation_company_info FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reservation_guests_set_updated_at BEFORE UPDATE ON public.reservation_guests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reservation_holds_set_updated_at BEFORE UPDATE ON public.reservation_holds FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reservation_pricing_items_set_updated_at BEFORE UPDATE ON public.reservation_pricing_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reservation_rooms_changed AFTER DELETE OR UPDATE ON public.reservation_rooms FOR EACH ROW EXECUTE FUNCTION trg_reservation_rooms_changed();
CREATE TRIGGER reservation_rooms_set_updated_at BEFORE UPDATE ON public.reservation_rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reservation_dates_changed AFTER UPDATE OF check_in_date, check_out_date ON public.reservations FOR EACH ROW EXECUTE FUNCTION trg_reservation_dates_changed();
CREATE TRIGGER reservations_set_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER room_specific_rates_audit AFTER INSERT OR DELETE OR UPDATE ON public.room_specific_rates FOR EACH ROW EXECUTE FUNCTION trg_rate_change_audit();
CREATE TRIGGER room_specific_rates_set_updated_at BEFORE UPDATE ON public.room_specific_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER room_type_pricing_set_updated_at BEFORE UPDATE ON public.room_type_pricing FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER room_types_set_updated_at BEFORE UPDATE ON public.room_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER rooms_set_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER seasonal_rates_audit AFTER INSERT OR DELETE OR UPDATE ON public.seasonal_rates FOR EACH ROW EXECUTE FUNCTION trg_rate_change_audit();
CREATE TRIGGER seasonal_rates_set_updated_at BEFORE UPDATE ON public.seasonal_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Data API lockdown: the app connects as the database owner through Prisma.
-- anon/authenticated must not reach any table or function via PostgREST.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON SCHEMA private FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
