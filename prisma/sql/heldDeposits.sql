-- No deposit liability register exists yet. Paid invoice amounts are not deposits.
SELECT currency, 0::numeric AS held
FROM public.invoices
WHERE FALSE
