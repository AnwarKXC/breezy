-- AI assistant, phase 2: guarded read-only SQL.
--
-- The model may write ad-hoc SELECTs, but they run as the NOLOGIN role
-- `ai_reader` (via SET LOCAL ROLE inside a READ ONLY transaction), which can only
-- read the curated views in schema `ai`. The views expose business columns only:
-- no auth data (users, sessions, tokens), no free-text notes, no passport/ID
-- numbers, and soft-deleted rows are filtered out.

CREATE SCHEMA IF NOT EXISTS ai;

-- Arabic-aware folding for name search: alef/yaa/taa-marbuta/hamza variants,
-- tashkeel + tatweel removed, Arabic-Indic digits -> 0-9, lower-cased.
CREATE OR REPLACE FUNCTION ai.normalize_ar(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT btrim(lower(regexp_replace(regexp_replace(
    translate(coalesce(value, ''), 'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩', 'اااايهوي0123456789'),
    '[ً-ٰٟـ]', '', 'g'), '\s+', ' ', 'g')))
$$;

CREATE OR REPLACE VIEW ai.room_types AS
SELECT id, name, default_capacity
FROM public.room_types WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.rooms AS
SELECT id, number, floor, room_type_id, capacity, occupancy_status, housekeeping_status, operational_status
FROM public.rooms WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.guests AS
SELECT id, first_name, last_name, (first_name || ' ' || last_name) AS full_name, phone, email, country, status, created_at
FROM public.guests WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.contacts AS
SELECT id, type, name, phone, email, country, city, created_at
FROM public.contacts WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.reservations AS
SELECT id, reservation_number, status, source, booking_type, billing_party,
       check_in_date, check_out_date, nights, adults, children, infants, room_count,
       primary_guest_id, company_id, booker_name, currency,
       subtotal_amount, discount_amount, tax_amount, service_amount, total_amount, paid_amount, balance_amount,
       created_at, cancelled_at, checked_in_at, checked_out_at
FROM public.reservations WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.reservation_rooms AS
SELECT rr.id, rr.reservation_id, rr.room_id, rr.room_type_id, rr.check_in_date, rr.check_out_date, rr.nights,
       rr.status, rr.adults, rr.children, rr.rate_per_night, rr.total_amount, rr.price_source, r.currency
FROM public.reservation_rooms rr
JOIN public.reservations r ON r.id = rr.reservation_id AND r.deleted_at IS NULL
WHERE rr.deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.reservation_guests AS
SELECT reservation_id, guest_id, contact_id, full_name, role, nationality, is_primary, is_vip, reservation_room_id
FROM public.reservation_guests WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.invoices AS
SELECT id, invoice_number, contact_id, reservation_id, status, currency,
       amount, subtotal, discount, tax_amount, service_charge, paid_amount, refunded_amount, remaining_balance,
       issue_date, due_date, paid_at, payment_method, guest_name, company_name, room_number
FROM public.invoices WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.payments AS
SELECT p.id, p.invoice_id, p.method, p.amount, p.currency, p.transaction_date, p.created_at
FROM public.payments p WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.expense_categories AS
SELECT id, name, name_ar
FROM public.expense_categories WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW ai.expenses AS
SELECT e.id, e.category_id, e.date, e.status, e.vendor, e.payment_method, e.description,
       CASE WHEN e.total_amount > 0 THEN e.total_amount ELSE e.amount END AS amount,
       coalesce(e.currency, (SELECT s.value ->> 'code' FROM public.accounting_settings s WHERE s.key = 'currency'), 'EGP') AS currency
FROM public.expenses e WHERE e.deleted_at IS NULL;

-- Role: no login, no inherited privileges, read access to schema ai only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_reader') THEN
    CREATE ROLE ai_reader NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- The app's database user may switch into ai_reader (SET ROLE) but never
-- inherits its privileges (PostgreSQL 16+ grant options).
GRANT ai_reader TO current_user WITH SET TRUE, INHERIT FALSE;

REVOKE ALL ON SCHEMA ai FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ai FROM PUBLIC;
REVOKE ALL ON FUNCTION ai.normalize_ar(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA ai TO ai_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ai TO ai_reader;
GRANT EXECUTE ON FUNCTION ai.normalize_ar(text) TO ai_reader;

DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA ai FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA ai FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON FUNCTION ai.normalize_ar(text) FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
