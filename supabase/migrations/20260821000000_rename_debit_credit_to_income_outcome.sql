ALTER TABLE public.accounting_ledger_entries
  RENAME COLUMN debit_amount TO income_amount;

ALTER TABLE public.accounting_ledger_entries
  RENAME COLUMN credit_amount TO outcome_amount;
