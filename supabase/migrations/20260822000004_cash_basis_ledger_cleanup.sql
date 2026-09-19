-- ============================================================
-- Migration: Cash-basis ledger cleanup
-- Generated: 2026-08-22
-- Addresses: ledger now records only real money movements. Revenue
--   entries posted on invoice issue are accrual artifacts; actual cash
--   in is captured by 'payment' entries, cash out by negative
--   'payment' (refund) and 'expense' entries.
-- ============================================================

delete from accounting_ledger_entries where type = 'revenue';
delete from accounting_ledger_entries where type = 'reversal';
