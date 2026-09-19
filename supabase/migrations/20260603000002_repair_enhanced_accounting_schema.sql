-- ============================================================
-- Migration: Repair enhanced accounting schema
-- Purpose: Ensure invoice enhanced columns exist and reload PostgREST schema cache
-- ============================================================

ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'card';
ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'online';
ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'ota';
ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'company_credit';
ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS room_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS room_number TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stay_check_in DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stay_check_out DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
UPDATE public.invoices SET status = 'draft' WHERE status = 'pending';
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'refunded'));

CREATE OR REPLACE FUNCTION public.set_invoices_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_set_updated_at ON public.invoices;
CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_invoices_updated_by();

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'room_charge', 'extra_service', 'minibar', 'laundry', 'restaurant',
    'late_checkout', 'damage_fee', 'discount', 'tax', 'manual_adjustment'
  )),
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoice_items'
      AND policyname = 'invoice_items_staff_all'
  ) THEN
    CREATE POLICY "invoice_items_staff_all" ON public.invoice_items
      FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON public.invoice_items(type);

CREATE TABLE IF NOT EXISTS public.accounting_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN (
    'revenue', 'payment', 'expense', 'refund', 'adjustment', 'tax', 'deposit', 'reversal'
  )),
  source_type TEXT NOT NULL CHECK (source_type IN ('invoice', 'payment', 'expense', 'booking', 'manual')),
  source_id UUID,
  debit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  account_category TEXT,
  description TEXT NOT NULL DEFAULT '',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  reversal_of_transaction_id UUID REFERENCES public.accounting_ledger_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_ledger_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_ledger_entries'
      AND policyname = 'ledger_staff_all'
  ) THEN
    CREATE POLICY "ledger_staff_all" ON public.accounting_ledger_entries
      FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_ledger_transaction_date ON public.accounting_ledger_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON public.accounting_ledger_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.accounting_ledger_entries(type);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_number ON public.accounting_ledger_entries(transaction_number);
CREATE INDEX IF NOT EXISTS idx_ledger_created_by ON public.accounting_ledger_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_ledger_reversal ON public.accounting_ledger_entries(reversal_of_transaction_id);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS cost_center TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
UPDATE public.expenses SET status = 'paid' WHERE status IS NULL OR status = 'approved';
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IN ('draft', 'approved', 'paid', 'void'));

CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON public.expenses(vendor);
CREATE INDEX IF NOT EXISTS idx_expenses_cost_center ON public.expenses(cost_center);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);

CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_settings'
      AND policyname = 'accounting_settings_admin_all'
  ) THEN
    CREATE POLICY "accounting_settings_admin_all" ON public.accounting_settings
      FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
      );
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS accounting_settings_set_updated_at ON public.accounting_settings;
CREATE TRIGGER accounting_settings_set_updated_at
BEFORE UPDATE ON public.accounting_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_remaining_balance ON public.invoices(remaining_balance);

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'INV-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 6, '0');
$$;

INSERT INTO public.accounting_settings (key, value, description) VALUES
  ('vat_rate', '{"rate": 14}', 'Default VAT percentage'),
  ('service_charge_rate', '{"rate": 10}', 'Default service charge percentage'),
  ('approval_threshold', '{"amount": 5000}', 'Expenses above this amount require approval'),
  ('currency', '{"code": "EGP", "symbol": "E£"}', 'Default currency')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
