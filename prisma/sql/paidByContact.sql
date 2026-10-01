-- Total paid per contact and currency across live invoices.
SELECT i.contact_id, i.currency, sum(greatest(p.amount, 0)) AS paid
FROM public.payments p
JOIN public.invoices i ON i.id = p.invoice_id
WHERE p.deleted_at IS NULL AND i.deleted_at IS NULL AND i.status NOT IN ('draft', 'void') AND p.currency = i.currency
GROUP BY i.contact_id, i.currency
