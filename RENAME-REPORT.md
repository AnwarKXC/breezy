# Rename debitAmount/creditAmount → incomeAmount/outcomeAmount

## Status: DONE

## Commits Created

1. `11e7536` — refactor: rename debitAmount/creditAmount to incomeAmount/outcomeAmount in types
2. `eacc65a` — refactor: rename debit/credit to income/outcome in ledgerAmounts
3. `2451641` — refactor: rename debit/credit to income/outcome in ledgerService
4. `d644c18` — refactor: rename debit/credit to income/outcome in accountingService
5. `e57dd7e` — refactor: rename debit/credit to income/outcome in remaining services

## Files Changed

| File | Task |
|------|------|
| `src/modules/accounting/types.ts` | Task 3 |
| `src/modules/accounting/services/ledgerAmounts.ts` | Task 4 |
| `src/modules/accounting/services/ledgerService.ts` | Task 5 |
| `src/modules/accounting/services/accountingService.ts` | Task 6 |
| `src/modules/accounting/services/expenseService.ts` | Task 7 |
| `src/modules/accounting/services/paymentService.ts` | Task 7 |
| `src/modules/accounting/services/invoiceService.ts` | Task 7 |

## Remaining Old References (outside scope)

- `components/LedgerTab.tsx` — UI column references
- `components/InvoiceLedgerTab.tsx` — UI display logic
- `components/InvoiceDetailModal.tsx` — UI display logic
- `services/types.mappers.test.ts` — test file
- `services/ledgerAmounts.test.ts` — test file
