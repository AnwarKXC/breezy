# Hotel accounting workspace

The accountant section follows BreezyIsland's Next.js/React interface, authenticated APIs, existing contacts and Prisma/PostgreSQL conventions. Copied source snapshots are no longer part of the deliverable.

## Implemented behavior

The manual journal supports simple and advanced entries, exact decimal balancing, active leaf accounts and contacts, immutable history, linked reversals and monthly close/reopen/permanent-lock controls. Balances derive directly from journal lines.

Owner metrics and daily charts share calculations with accountant trial balance, income statement, balance sheet, account/contact statements and CSV/PDF exports. Reports distinguish opening balances, month activity and closing balances as of month end. Future entries are excluded. Transfers between recognized cash accounts are netted per entry.

EGP/USD/EUR/GBP transaction-currency reports remain separate. Functional EGP reporting uses recorded historical rates, dates, provenance and balanced base amounts. Reversals preserve historical valuation. Legacy entries without confirmed rates block functional consolidated reports; rates are not fabricated.

Operational safeguards include positive-only receipts, positive-source refund/idempotency checks, immutable payment history, unpaid draft invoice deletion restrictions, paid expense immutability, persisted expense currency and paid-only expense cash movement. Billed net reports exclude drafts/voids and tax.

## Implementation map

| Responsibility | Files |
| --- | --- |
| Contracts and exact input validation | src/modules/accounting/journal/types.ts, validation.ts |
| Posting, reversal, periods and API data | src/modules/accounting/journal/service.ts; src/app/api/accounting/journal/ |
| Historical valuation | src/modules/accounting/journal/fx.ts |
| Scoped balances and reporting | src/modules/accounting/journal/reports.ts |
| CSV/PDF export sections | src/modules/accounting/journal/reportExport.ts |
| Journal interface | src/modules/accounting/components/GeneralJournalTab.tsx, JournalReportsPanel.tsx |
| Operational workflows | src/modules/accounting/services/ |
| Local migrations | prisma/migrations/20261001120000_general_journal/, 20261001130000_journal_reporting/, 20261001140000_expense_currency/ |

## Material boundaries

The journal is manual: invoices, receipts, refunds and expenses do not automatically post into it. Journal reports describe journal activity, not a reconciled complete hotel ledger. Billed summaries do not prove accommodation/services were earned. Unified automatic posting requires recognition rules, unique source identity, retry idempotency, historical backfill controls and reconciliation.

Historical EGP valuation is implemented; closing-date monetary revaluation and realized settlement FX remain future work. No accounting/tax-standard certification is claimed. Unknown historical expense currency remains explicitly unclassified.

Local migration files do not prove live activation. Inspect configured database status and pending migrations before an authorized deployment. No remote DDL is implied.

## Verification

```powershell
npx tsx --test src/modules/accounting/journal/validation.test.ts src/modules/accounting/journal/fx.test.ts src/modules/accounting/journal/reports.test.ts src/modules/accounting/journal/reportExport.test.ts
npm run build
npx playwright test --config=e2e/journal.config.ts
```

Run targeted ESLint on changed executable files. scripts/verify-general-journal.mjs checks local migration SQL in a disposable PostgreSQL-compatible engine when its test dependency is available. Static browser checks establish rendering and payload wiring, not authenticated live persistence. Report actual test results separately.
