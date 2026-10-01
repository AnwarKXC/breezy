-- Historical expenses have no reliable currency without linked ledger evidence.
ALTER TABLE public.expenses ADD COLUMN currency text;
WITH evidence AS (
  SELECT source_id, MIN(currency) AS currency
  FROM public.accounting_ledger_entries
  WHERE source_type = 'expense'
  GROUP BY source_id
  HAVING COUNT(DISTINCT currency) = 1 AND BOOL_AND(currency IN ('EGP', 'USD', 'EUR', 'GBP'))
)
UPDATE public.expenses e SET currency = evidence.currency
FROM evidence WHERE evidence.source_id = e.id;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_currency_check
  CHECK (currency IS NULL OR currency IN ('EGP', 'USD', 'EUR', 'GBP'));
-- Unresolved historical values intentionally remain NULL; no default relabels them.
