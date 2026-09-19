# Task 8: Update Tests — Report

## Status: DONE

## Changes Applied

### `src/modules/accounting/services/ledgerAmounts.test.ts`
- Renamed all `debitAmount` → `incomeAmount` and `creditAmount` → `outcomeAmount` in assertions
- Updated test descriptions:
  - `'records a positive payment as a DEBIT (cash in)'` → `'records a positive payment as INCOME (cash in)'`
  - `'records a refund (negative payment) as a CREDIT (cash out)'` → `'records a refund (negative payment) as OUTCOME (cash out)'`
  - `'never books the same amount on both sides (no duplicate credit)'` → `'never books the same amount on both sides (no duplicate outcome)'`
  - `'books the expense total (net + tax) as a debit'` → `'books the expense total (net + tax) as income'`
  - `'never books a negative debit'` → `'never books a negative income'`

### `src/modules/accounting/services/types.mappers.test.ts`
- Updated test description: `'maps debit and credit sides'` → `'maps income and outcome sides'`
- Updated assertions: `entry.debitAmount` → `entry.incomeAmount`, `entry.creditAmount` → `entry.outcomeAmount`
- Updated `baseRow` fixture: `debit_amount` → `income_amount`, `credit_amount` → `outcome_amount`

## Test Results
- **Files:** 2 passed
- **Tests:** 14 passed (14 total)

## Commit
- **Hash:** `42a4c5f`
- **Message:** `test: update test descriptions and assertions for income/outcome rename`
