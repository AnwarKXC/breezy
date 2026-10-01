# Accounting implementation review

Updated 2026-10-02 after inspecting current local accounting services and journal valuation/reporting/export code. This is implementation evidence, not certified accounting, tax or regulatory compliance. No live records, secrets or remote DDL were inspected. Test execution and activation require separate evidence.

## Corrections visible in current code

| Earlier issue | Current implementation |
| --- | --- |
| Invalid lifecycle and tax totals | services/reportsService.ts uses posted/open predicates, excludes draft/void and removes tax from billed net totals. Room item classification is used. These remain billed summaries. |
| Unpaid expense cash movement | expenseService.ts writes outflow only for paid expenses. Approved/paid expenses enter cost summaries. Paid edits/deletion are blocked. |
| Historical currency relabeling | Expense currency is persisted; unknown history is explicitly UNKNOWN rather than the current default. |
| Cash history deletion | deletePayment rejects deletion; deleteInvoice accepts only unpaid drafts without any payment history. |
| Negative create refund bypass | createPayment rejects nonpositive receipts. Dedicated refund validates positive source, invoice lock, mixed-currency history and idempotency key. |
| Issued monetary edits | Invoice updates lock the document and restrict issued financial fields. |
| Invalid held-deposit formula | Overview no longer derives deposit liability from paid-minus-remaining. Journal deposits require liability postings. |
| Future balances | journal/reports.ts separates opening/activity/as-of closing and excludes future entries. |
| FX/report omissions | journal/fx.ts and service.ts persist historical EGP valuation; reports and account/contact statements support native/functional modes, charts and CSV/PDF. |
| Unsafe journal CSV | journal/reportExport.ts neutralizes formula-like text and includes report scope and valuation metadata. |

Journal amounts use integer cents/decimal strings; historical valuation allocates residual cents deterministically while preserving equal base debit/credit totals. Reversals mirror original historical amounts. Missing valuation blocks functional reports. Server period locks coordinate posting with closing. Active leaf/contact rules apply to new entries, historical references remain usable for exact reversals, and balances derive from lines without projection caches.

## Remaining priorities

### High: unified automatic posting and reconciliation

The manual journal and operational invoice/payment/expense workflows are still separate. There is no complete automatic business-event mapping into journal lines.

Define earned stay/service revenue, deposits, taxes, supplier obligations and credit-note treatment. Implement unique source identity, retry-safe transactional posting and reconciliation before backfill. Journal owner profit and balance-sheet reports represent manual postings only; do not combine independent operational/manual totals as though complete.

### High: closing FX revaluation and settlement gains/losses

Historical EGP valuation exists; complete closing-rate monetary revaluation and realized settlement-FX workflows do not.

Identify monetary positions, record approved closing-rate provenance and post controlled revaluation/reversal and realized FX. Keep native balances and historical values auditable. Historical conversion is not current-date valuation or full multi-currency accounting.

### Medium: legacy reconciliation and live activation

Legacy missing rates/currencies are surfaced. Current code cannot infer undocumented rates or reconstruct previously deleted cash history.

Verify migration status and representative historical records. Resolve unknown expense currency only from reliable evidence; reconcile receipts, refunds and reservation totals with documented corrections. Passing local tests does not establish live correctness.

### Medium: operational reporting basis and refund policy

Overview/daily/monthly billed views use issue-date scopes; reviewed getFinancialHealth still filters creation dates. Expense summaries include approved incurred costs and paid costs, while payment lists describe collection events. A cash refund alone is not an issued credit note or proof earned revenue declined.

Align report basis/date labels and document credit/deposit/overpayment refund semantics. Review expense tax recoverability and gross/net receipt/reservation reconciliation. Mixed operations need explicit policy before unified recognition.

### Medium: export and coverage verification

Journal exports have safe cells, scope metadata and missing-valuation gates. Operational CSV/PDF utilities are separate code paths; journal sanitation alone does not prove every export safe.

Check formula text, stable numeric/ISO currency columns, complete filtered totals and Arabic/English PDF rendering. Client export permission controls are affordances; readable data can be saved independently. Strict export boundaries require server-generated authorized exports and a matching read-data policy. Review receipt-linked refunds together with invoice-level refunds before claiming complete per-source allocation.

## Verification targets and limits

Cover lifecycle/tax filtering, approved versus paid expense, currency stability, positive receipts, refund retries, immutable posted history, concurrent payment/edit/refund/period operations, future balances, FX residuals, historical reversals, missing-valuation blocking, scoped statements and formula text.

```powershell
npx tsx --test src/modules/accounting/journal/validation.test.ts src/modules/accounting/journal/fx.test.ts src/modules/accounting/journal/reports.test.ts src/modules/accounting/journal/reportExport.test.ts
npm run build
npx playwright test --config=e2e/journal.config.ts
```

This update inspected code only. It does not certify live migration/RLS state, multi-session concurrency, dependency CVEs, authenticated persistence, complete financial coverage or jurisdictional compliance. Automatic posting/reconciliation and closing revaluation remain material gaps.
