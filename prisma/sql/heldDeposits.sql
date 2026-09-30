-- Money received beyond what live invoices still owe, per currency.
SELECT currency, sum(greatest(0, coalesce(paid_amount, 0) - coalesce(remaining_balance, 0))) AS held
FROM public.invoices
WHERE deleted_at IS NULL AND status NOT IN ('void', 'refunded')
GROUP BY currency
