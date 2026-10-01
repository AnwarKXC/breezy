import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJournalReports, buildAccountStatement } from './reports'
import { JOURNAL_CHART } from './chart'
import type { JournalEntry } from './types'

function entry(id: string, date: string, debitAccount: string, creditAccount: string, amount: string, currency = 'EGP', rate: string | null = '1'): JournalEntry {
  return { kind: 'manual', id, entryNumber: id, date, currency: currency as JournalEntry['currency'], description: id, createdBy: 'actor', createdAt: `${date}T00:00:00Z`, reversalOfId: null, reversedById: null, total: amount, exchangeRate: rate, exchangeRateDate: rate ? date : null, exchangeRateSource: rate ? 'manual' : null, baseTotal: rate ? amount : null, lines: [
    { id: `${id}-d`, accountCode: debitAccount, debit: amount, credit: '0', baseDebit: rate ? amount : null, baseCredit: rate ? '0' : null, description: '', contactId: null, contactName: null },
    { id: `${id}-c`, accountCode: creditAccount, debit: '0', credit: amount, baseDebit: rate ? '0' : null, baseCredit: rate ? amount : null, description: '', contactId: null, contactName: null },
  ] }
}
const chart = JOURNAL_CHART.map((account) => ({ ...account, active: true }))
test('uses month-end balances and opening balances, excluding future postings', () => {
  const entries = [entry('opening', '2026-09-30', '1101', '3101', '100.00'), entry('sale', '2026-10-01', '1101', '4101', '25.00'), entry('expense', '2026-10-02', '5201', '1101', '5.00'), entry('future', '2026-11-01', '1101', '4101', '999.00')]
  const result = buildJournalReports(chart, entries, 'EGP', '2026-10', 'native')
  assert.equal(result.owner.cash, '120.00')
  assert.deepEqual(result.reports.incomeStatement, { revenue: '25.00', expenses: '5.00', profit: '20.00' })
  assert.deepEqual(result.reports.balanceSheet, { asOf: '2026-10-31', assets: '120.00', liabilities: '0.00', equity: '100.00', currentEarnings: '20.00', balanced: true })
  const cash = result.reports.trialBalance.find((account) => account.code === '1101')!
  assert.equal(cash.openingDebit, '100.00'); assert.equal(cash.closingDebit, '120.00')
  assert.equal(buildAccountStatement(chart, entries, 'EGP', '2026-10', 'native', '1101').closing, '120.00')
})
test('cash trends exclude internal transfers and party controls remain separate', () => {
  const transfer = entry('transfer', '2026-10-02', '1102', '1101', '50.00')
  const receivable = entry('receivable', '2026-10-03', '1201', '4101', '20.00')
  const payable = entry('payable', '2026-10-03', '5201', '2101', '7.00')
  receivable.lines[0].contactId = payable.lines[1].contactId = 'contact'
  receivable.lines[0].contactName = payable.lines[1].contactName = 'Company'
  const result = buildJournalReports(chart, [transfer, receivable, payable], 'EGP', '2026-10', 'native')
  assert.equal(result.trend.find((row) => row.date === '2026-10-02')!.cashOut, '0.00')
  assert.equal(result.parties[0].receivable, '20.00'); assert.equal(result.parties[0].payable, '7.00')
})
test('functional official reports block missing historical valuation while native remains usable', () => {
  const missing = entry('legacy', '2026-09-01', '1101', '3101', '10.00', 'USD', null)
  const native = buildJournalReports(chart, [missing], 'USD', '2026-10', 'native')
  assert.equal(native.reports.available, true)
  const functional = buildJournalReports(chart, [missing], 'EGP', '2026-10', 'functional')
  assert.equal(functional.reports.available, false); assert.equal(functional.reportingCoverage.unvalued, 1)
  assert.equal(functional.reports.balanceSheet, null)
  assert.equal(buildAccountStatement(chart, [missing], 'EGP', '2026-10', 'functional', '1101').available, false)
})
test('functional reporting uses stored base values instead of mixing native currencies', () => {
  const usd = entry('foreign-sale', '2026-10-01', '1101', '4101', '2.00', 'USD', '50')
  usd.lines[0].baseDebit = usd.lines[1].baseCredit = '100.00'
  usd.baseTotal = '100.00'
  const egp = entry('local-sale', '2026-10-02', '1101', '4101', '10.00')
  const native = buildJournalReports(chart, [usd, egp], 'USD', '2026-10', 'native')
  assert.equal(native.owner.monthRevenue, '2.00')
  const functional = buildJournalReports(chart, [usd, egp], 'EGP', '2026-10', 'functional')
  assert.equal(functional.owner.monthRevenue, '110.00')
  assert.equal(functional.reports.balanceSheet?.balanced, true)
  assert.equal(buildAccountStatement(chart, [usd, egp], 'EGP', '2026-10', 'functional', '1101').closing, '110.00')
})
