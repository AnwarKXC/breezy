-- Store the reason a discount was applied to an invoice, mirroring void_reason.
-- The discount amount itself already lives in invoices.discount
-- (20260603000001_add_enhanced_accounting.sql).

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_reason TEXT;

COMMENT ON COLUMN public.invoices.discount_reason IS 'Why the header discount was applied. Set by the apply-discount action.';
