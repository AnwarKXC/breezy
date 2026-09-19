-- ============================================================
-- Migration: Fix inverted payment ledger sides
-- Generated: 2026-08-22
-- Addresses: payment ledger entries were written with cash-in on
--   outcome_amount and refunds on income_amount, so received payments
--   displayed under "Outcome" in the ledger table.
-- Revenue/expense/reversal entries are already on correct sides.
-- ============================================================

update accounting_ledger_entries
set income_amount = outcome_amount,
    outcome_amount = income_amount
where type = 'payment'
  and income_amount <> outcome_amount;
