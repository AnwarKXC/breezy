-- ============================================================
-- Migration: Enhance invoice items and add snapshot fields
-- Purpose: Add new item types, snapshot fields, sort_order, ledger/audit support
-- ============================================================

-- 1. Extend invoice_items type check to include new types
ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_type_check;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_type_check
  CHECK (type IN (
    'room_charge', 'extra_service', 'minibar', 'laundry', 'restaurant',
    'late_checkout', 'early_check_in', 'damage_fee', 'cleaning_fee',
    'parking', 'transportation', 'discount', 'tax', 'service_charge',
    'manual_adjustment', 'other'
  ));

-- 2. Add sort_order to invoice_items
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_invoice_items_sort ON public.invoice_items(invoice_id, sort_order);

-- 3. Add snapshot fields to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS public_notes TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES auth.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EGP';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS billing_address TEXT;

-- 4. Add invoice_id and contact_id to accounting_ledger_entries for better tracking
ALTER TABLE public.accounting_ledger_entries ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);
ALTER TABLE public.accounting_ledger_entries ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id);

CREATE INDEX IF NOT EXISTS idx_ledger_invoice_id ON public.accounting_ledger_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ledger_contact_id ON public.accounting_ledger_entries(contact_id);

-- 5. Payments enhancements
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_number TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES auth.users(id);

-- 6. Invoice events / audit table
CREATE TABLE IF NOT EXISTS public.invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'draft_saved', 'updated', 'issued', 'voided',
    'payment_recorded', 'payment_refunded', 'payment_voided',
    'adjusted', 'pdf_downloaded', 'printed', 'status_changed'
  )),
  actor_id UUID REFERENCES auth.users(id),
  old_status TEXT,
  new_status TEXT,
  amount_changed NUMERIC(10,2),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_events_staff_all" ON public.invoice_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
  );

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice ON public.invoice_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_events_type ON public.invoice_events(event_type);
CREATE INDEX IF NOT EXISTS idx_invoice_events_created ON public.invoice_events(created_at DESC);

-- 7. Add transaction_date and updated_at to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_payments_updated_at();

-- 8. Add updated_at trigger for invoice_items
CREATE OR REPLACE FUNCTION public.set_invoice_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_set_updated_at ON public.invoice_items;
CREATE TRIGGER invoice_items_set_updated_at
BEFORE UPDATE ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.set_invoice_items_updated_at();

-- 9. Reload schema cache
NOTIFY pgrst, 'reload schema';
