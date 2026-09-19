-- Row lock so concurrent payments/adjustments on one invoice serialize.
-- @param {String} $1:invoiceId
SELECT id FROM public.invoices WHERE id = $1::uuid FOR UPDATE
