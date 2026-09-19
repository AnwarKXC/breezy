-- Total paid per contact across live invoices.
SELECT i.contact_id, sum(p.amount) AS paid
FROM public.payments p
JOIN public.invoices i ON i.id = p.invoice_id
WHERE p.deleted_at IS NULL AND i.deleted_at IS NULL
GROUP BY i.contact_id
