// Disposable local PostgreSQL verification; never reads hotel credentials.
// JOURNAL_SQL_TOOLS points to a temporary install of @electric-sql/pglite.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

if (!process.env.JOURNAL_SQL_TOOLS) throw new Error('Set JOURNAL_SQL_TOOLS to a temporary directory containing @electric-sql/pglite')
const require = createRequire(resolve(process.env.JOURNAL_SQL_TOOLS, 'package.json'))
const { PGlite } = require('@electric-sql/pglite')
const projectRequire = createRequire(import.meta.url)
projectRequire('tsx/cjs')
const { valueJournalLines } = projectRequire('../src/modules/accounting/journal/fx.ts')
const { buildJournalReports, buildAccountStatement } = projectRequire('../src/modules/accounting/journal/reports.ts')
const db = new PGlite()
const actor = randomUUID(), contact = randomUUID()
let passed = 0
async function check(name, action) { await action(); passed++; console.log(`PASS ${name}`) }
async function reject(action, pattern) { await assert.rejects(db.transaction(action), pattern) }

async function legacyEntry(tx, currency) {
  const id = randomUUID()
  await tx.query('INSERT INTO accounting_journal_entries(id,entry_number,date,currency,description,created_by) VALUES($1,$2,$3,$4,$5,$6)', [id, `LEGACY-${id}`, '2026-09-30', currency, 'Historical capital', actor])
  await tx.query("INSERT INTO accounting_journal_lines(entry_id,account_code,debit,credit,sort_order) VALUES($1,'1101',10,0,0),($1,'3101',0,10,1)", [id])
  return id
}
async function post(tx, lines, options = {}) {
  const id = randomUUID(), date = options.date ?? '2026-10-01', currency = options.currency ?? 'EGP'
  const rate = 'rate' in options ? options.rate : currency === 'EGP' ? '1' : '50'
  const rateDate = 'rateDate' in options ? options.rateDate : rate ? date : null
  const source = 'source' in options ? options.source : rate ? 'Bank receipt TEST' : null
  const base = rate ? valueJournalLines(lines.map((line) => ({ debit: line.debit ?? '0', credit: line.credit ?? '0' })), rate) : lines.map(() => ({ baseDebit: null, baseCredit: null }))
  await tx.query('INSERT INTO accounting_journal_entries(id,entry_number,date,currency,description,created_by,reversal_of_id,exchange_rate,exchange_rate_date,exchange_rate_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, `FX-${id}`, date, currency, 'FX verification', actor, options.reversalOf ?? null, rate, rateDate, source])
  for (const [index, line] of lines.entries()) await tx.query('INSERT INTO accounting_journal_lines(entry_id,account_code,debit,credit,contact_id,sort_order,base_debit,base_credit) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, line.account, line.debit ?? '0', line.credit ?? '0', line.contact ?? null, index, 'baseDebit' in line ? line.baseDebit : base[index].baseDebit, 'baseCredit' in line ? line.baseCredit : base[index].baseCredit])
  return id
}
const capital = [{ account: '1101', debit: '2.00' }, { account: '3101', credit: '2.00' }]
async function reportingData() {
  const accountRows = (await db.query('SELECT * FROM accounting_accounts ORDER BY code')).rows
  const entryRows = (await db.query('SELECT * FROM accounting_journal_entries ORDER BY date,created_at,id')).rows
  const lineRows = (await db.query('SELECT * FROM accounting_journal_lines ORDER BY sort_order,id')).rows
  return {
    accounts: accountRows.map((row) => ({ code: row.code, nameEn: row.name_en, nameAr: row.name_ar, type: row.type, parentCode: row.parent_code, postable: row.postable, requiresContact: row.requires_contact, active: row.active })),
    entries: entryRows.map((row) => ({
      id: row.id, entryNumber: row.entry_number, date: row.date.toISOString().slice(0, 10), currency: row.currency, description: row.description,
      createdBy: row.created_by, createdAt: row.created_at.toISOString(), reversalOfId: row.reversal_of_id, reversedById: entryRows.find((candidate) => candidate.reversal_of_id === row.id)?.id ?? null,
      exchangeRate: row.exchange_rate, exchangeRateDate: row.exchange_rate_date?.toISOString().slice(0, 10) ?? null, exchangeRateSource: row.exchange_rate_source,
      total: '0', baseTotal: null,
      lines: lineRows.filter((line) => line.entry_id === row.id).map((line) => ({ id: line.id, accountCode: line.account_code, contactId: line.contact_id, contactName: line.contact_id ? 'Company' : null, debit: line.debit, credit: line.credit, baseDebit: line.base_debit, baseCredit: line.base_credit, description: line.description })),
    })),
  }
}
try {
  await db.exec('CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE contacts(id uuid PRIMARY KEY, deleted_at timestamptz); CREATE ROLE anon; CREATE ROLE authenticated;')
  await db.query('INSERT INTO users VALUES($1)', [actor]); await db.query('INSERT INTO contacts VALUES($1,NULL)', [contact])
  await db.exec(await readFile(resolve('prisma/migrations/20261001120000_general_journal/migration.sql'), 'utf8'))
  const legacyEGP = await db.transaction((tx) => legacyEntry(tx, 'EGP'))
  const legacyUSD = await db.transaction((tx) => legacyEntry(tx, 'USD'))
  await db.exec(await readFile(resolve('prisma/migrations/20261001130000_journal_reporting/migration.sql'), 'utf8'))

  await check('forward migration values only known EGP history and seeds FX accounts', async () => {
    const egp = (await db.query('SELECT exchange_rate,exchange_rate_source FROM accounting_journal_entries WHERE id=$1', [legacyEGP])).rows[0]
    assert.equal(egp.exchange_rate, '1.00000000'); assert.equal(egp.exchange_rate_source, 'legacy-egp')
    assert.equal((await db.query('SELECT base_debit FROM accounting_journal_lines WHERE entry_id=$1 AND debit>0', [legacyEGP])).rows[0].base_debit, '10.00')
    const usd = (await db.query('SELECT exchange_rate,exchange_rate_date,exchange_rate_source FROM accounting_journal_entries WHERE id=$1', [legacyUSD])).rows[0]
    assert.deepEqual(usd, { exchange_rate: null, exchange_rate_date: null, exchange_rate_source: null })
    assert.equal((await db.query('SELECT count(*)::int AS count FROM accounting_accounts')).rows[0].count, 27)
  })
  await check('new foreign postings require rates and dated source evidence', async () => {
    await reject((tx) => post(tx, capital, { currency: 'USD', rate: null }), /positive historical/)
    await reject((tx) => post(tx, capital, { currency: 'USD', rateDate: '2026-09-30' }), /positive historical/)
    await reject((tx) => post(tx, capital, { currency: 'USD', source: '' }), /positive historical/)
    await reject((tx) => post(tx, capital, { rate: '2' }), /positive historical/)
  })
  let original
  await check('foreign posting stores immutable exact native and EGP values', async () => {
    original = await db.transaction((tx) => post(tx, capital, { currency: 'USD', rate: '50.12345678' }))
    const lines = (await db.query('SELECT debit,credit,base_debit,base_credit FROM accounting_journal_lines WHERE entry_id=$1 ORDER BY sort_order', [original])).rows
    assert.deepEqual(lines, [{ debit: '2.00', credit: '0.00', base_debit: '100.25', base_credit: '0.00' }, { debit: '0.00', credit: '2.00', base_debit: '0.00', base_credit: '100.25' }])
    await assert.rejects(db.exec("UPDATE accounting_journal_entries SET exchange_rate=99 WHERE currency='USD'"), /immutable/)
    await assert.rejects(db.exec('UPDATE accounting_journal_lines SET base_debit=99'), /immutable/)
  })
  await check('rounding residual is allocated deterministically and remains balanced', async () => {
    const id = await db.transaction((tx) => post(tx, [{ account: '1101', debit: '0.01' }, { account: '1102', debit: '0.01' }, { account: '3101', credit: '0.02' }], { currency: 'EUR', rate: '1.5' }))
    assert.deepEqual((await db.query('SELECT base_debit,base_credit FROM accounting_journal_lines WHERE entry_id=$1 ORDER BY sort_order', [id])).rows, [{ base_debit: '0.01', base_credit: '0.00' }, { base_debit: '0.02', base_credit: '0.00' }, { base_debit: '0.00', base_credit: '0.03' }])
  })
  await check('arbitrary balanced base allocation and unvalued new lines are rejected', async () => {
    await reject((tx) => post(tx, [{ ...capital[0], baseDebit: '99.00' }, { ...capital[1], baseCredit: '99.00' }], { currency: 'USD', rate: '50' }), /deterministic rounding/)
    await reject((tx) => post(tx, [{ ...capital[0], baseDebit: null, baseCredit: null }, capital[1]], { currency: 'USD' }), /functional amounts/)
    await reject((tx) => post(tx, [{ ...capital[0], baseCredit: '1.00' }, capital[1]], { currency: 'USD' }), /check constraint/)
  })
  await check('reversal retains original rate, date, source and exact EGP sides', async () => {
    const reversed = [{ account: '1101', credit: '2.00', baseDebit: '0.00', baseCredit: '100.25' }, { account: '3101', debit: '2.00', baseDebit: '100.25', baseCredit: '0.00' }]
    await reject((tx) => post(tx, reversed, { currency: 'USD', rate: '55', date: '2026-10-02', rateDate: '2026-10-01', reversalOf: original }), /exchange-rate provenance/)
    await reject((tx) => post(tx, [{ ...reversed[0], baseCredit: '100.24' }, { ...reversed[1], baseDebit: '100.24' }], { currency: 'USD', rate: '50.12345678', date: '2026-10-02', rateDate: '2026-10-01', reversalOf: original }), /exact inverse/)
    await db.transaction((tx) => post(tx, reversed, { currency: 'USD', rate: '50.12345678', date: '2026-10-02', rateDate: '2026-10-01', reversalOf: original }))
  })
  await check('unvalued legacy reversal stays explicitly unknown', async () => {
    await db.transaction((tx) => post(tx, [{ account: '1101', credit: '10.00' }, { account: '3101', debit: '10.00' }], { currency: 'USD', date: '2026-10-03', rate: null, rateDate: null, source: null, reversalOf: legacyUSD }))
  })
  await check('month-end cutoff, trial balance, owner metrics and statements use real SQL rows', async () => {
    await db.transaction((tx) => post(tx, [{ account: '1101', debit: '25.00' }, { account: '4101', credit: '25.00' }]))
    await db.transaction((tx) => post(tx, [{ account: '5201', debit: '5.00' }, { account: '1101', credit: '5.00' }], { date: '2026-10-02' }))
    await db.transaction((tx) => post(tx, [{ account: '1101', debit: '999.00' }, { account: '4101', credit: '999.00' }], { date: '2026-11-01' }))
    const { accounts, entries } = await reportingData()
    const report = buildJournalReports(accounts, entries, 'EGP', '2026-10', 'native')
    assert.equal(report.owner.cash, '30.00'); assert.equal(report.owner.monthProfit, '20.00')
    assert.equal(report.reports.balanceSheet.balanced, true); assert.equal(report.reports.balanceSheet.asOf, '2026-10-31')
    assert.equal(report.reports.trialBalance.find((row) => row.code === '1101').openingDebit, '10.00')
    assert.equal(buildAccountStatement(accounts, entries, 'EGP', '2026-10', 'native', '1101').closing, '30.00')
  })
  await check('unknown historical FX blocks consolidated formal reports but preserves native reports', async () => {
    const { accounts, entries } = await reportingData()
    const report = buildJournalReports(accounts, entries, 'EGP', '2026-10', 'functional')
    assert.equal(report.reportingCoverage.unvalued, 2); assert.equal(report.reports.available, false)
    assert.equal(report.reports.incomeStatement, null); assert.equal(report.reports.balanceSheet, null)
    assert.equal(buildJournalReports(accounts, entries, 'USD', '2026-10', 'native').reports.available, true)
    assert.equal(buildAccountStatement(accounts, entries, 'EGP', '2026-10', 'functional', '1101').available, false)
  })
  await check('forward migration preserves closed-period posting guards', async () => {
    await db.exec("UPDATE accounting_periods SET status='closed' WHERE month='2026-10'")
    await reject((tx) => post(tx, capital), /period is not open/)
  })
  console.log(`${passed} journal reporting PostgreSQL checks passed. No hotel database was accessed.`)
} finally { await db.close() }
