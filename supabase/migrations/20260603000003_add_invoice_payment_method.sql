-- ============================================================
-- Migration: Add payment_method to invoices
-- Purpose: Track expected payment method on invoice creation
-- ============================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_method ON public.invoices(payment_method);

NOTIFY pgrst, 'reload schema';
