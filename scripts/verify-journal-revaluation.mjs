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
const db = new PGlite()
const actor = randomUUID(), contact = randomUUID()
let passed = 0
async function check(name, action) { await action(); passed++; console.log(`PASS ${name}`) }
async function reject(action, pattern) { await assert.rejects(db.transaction(action), pattern) }

async function entry(tx, { kind = 'manual', currency = 'USD', rate = '50', date = '2026-10-01', rateDate = date, reversalOf = null } = {}) {
  const id = randomUUID()
  await tx.query('INSERT INTO accounting_journal_entries(id,kind,entry_number,date,currency,description,created_by,reversal_of_id,exchange_rate,exchange_rate_date,exchange_rate_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [id, kind, `T-${id}`, date, currency, 'Revaluation verification', actor, reversalOf, rate, rateDate, 'Central bank TEST'])
  return id
}
async function line(tx, id, account, debit, credit, baseDebit, baseCredit, order, contactId = null) {
  await tx.query('INSERT INTO accounting_journal_lines(entry_id,account_code,contact_id,debit,credit,base_debit,base_credit,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, account, contactId, debit, credit, baseDebit, baseCredit, order])
}
// Mirrors createJournalRevaluation: native zero lines, EGP-only delta, linked operation row.
async function revalue(tx, { account = '1101', gainAccount = '4402', delta = '200.00', rate = '52', contactId = null, date = '2026-10-31', record = true } = {}) {
  const id = await entry(tx, { kind: 'revaluation', rate, date })
  await line(tx, id, account, 0, 0, delta, 0, 0, contactId)
  await line(tx, id, gainAccount, 0, 0, 0, delta, 1)
  if (record) await tx.query('INSERT INTO accounting_revaluations(entry_id,date,currency,account_code,contact_id,closing_rate,source,native_balance,base_before,base_after,delta,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [id, date, 'USD', account, contactId, rate, 'Central bank TEST', '100.00', '5000.00', '5200.00', delta, actor])
  return id
}

try {
  await db.exec('CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE contacts(id uuid PRIMARY KEY, deleted_at timestamptz); CREATE ROLE anon; CREATE ROLE authenticated;')
  await db.query('INSERT INTO users(id) VALUES($1)', [actor])
  await db.query('INSERT INTO contacts(id) VALUES($1)', [contact])
  for (const name of ['20261001120000_general_journal', '20261001130000_journal_reporting', '20261001150000_journal_revaluation']) {
    await db.exec(await readFile(resolve(`prisma/migrations/${name}/migration.sql`), 'utf8'))
  }
  let cashEntry
  await check('manual postings still work and default to kind manual', async () => {
    await db.transaction(async (tx) => {
      cashEntry = await entry(tx)
      await line(tx, cashEntry, '1101', 100, 0, '5000.00', '0.00', 0)
      await line(tx, cashEntry, '3101', 0, 100, '0.00', '5000.00', 1)
    })
    assert.equal((await db.query('SELECT kind FROM accounting_journal_entries WHERE id=$1', [cashEntry])).rows[0].kind, 'manual')
  })
  await check('a balanced cash revaluation posts an EGP-only gain with its operation row', async () => {
    await db.transaction((tx) => revalue(tx))
    const rows = (await db.query("SELECT l.account_code, l.debit, l.credit, l.base_debit, l.base_credit FROM accounting_journal_lines l JOIN accounting_journal_entries e ON e.id=l.entry_id WHERE e.kind='revaluation' ORDER BY l.sort_order")).rows
    assert.deepEqual(rows.map((row) => [row.account_code, Number(row.debit), Number(row.credit), Number(row.base_debit), Number(row.base_credit)]), [['1101', 0, 0, 200, 0], ['4402', 0, 0, 0, 200]])
  })
  await check('a loss posts to 5602 and receivable revaluations keep their contact', async () => {
    await db.transaction(async (tx) => {
      const id = await entry(tx, { kind: 'revaluation', rate: '48', date: '2026-10-30' })
      await line(tx, id, '5602', 0, 0, '50.00', 0, 0)
      await line(tx, id, '1201', 0, 0, 0, '50.00', 1, contact)
    })
  })
  await check('revaluation lines cannot carry transaction-currency amounts', async () => {
    await reject(async (tx) => {
      const id = await entry(tx, { kind: 'revaluation', rate: '52' })
      await line(tx, id, '1101', 1, 0, '200.00', 0, 0)
      await line(tx, id, '4402', 0, 1, 0, '200.00', 1)
    }, /Revaluation requires/)
  })
  await check('revaluations only touch monetary accounts and the matching FX account', async () => {
    await reject((tx) => revalue(tx, { account: '4101', record: false }), /Revaluation requires/)
    await reject((tx) => revalue(tx, { gainAccount: '5602', record: false }), /Revaluation requires/)
  })
  await check('revaluations must balance in EGP and cannot be EGP entries', async () => {
    await reject(async (tx) => {
      const id = await entry(tx, { kind: 'revaluation', rate: '52' })
      await line(tx, id, '1101', 0, 0, '200.00', 0, 0)
      await line(tx, id, '4402', 0, 0, 0, '199.00', 1)
    }, /Revaluation requires/)
    await reject((tx) => entry(tx, { kind: 'revaluation', currency: 'EGP', rate: '1' }), /journal_revaluation_shape/)
  })
  await check('manual entries reject zero-native lines', async () => {
    await reject(async (tx) => {
      const id = await entry(tx)
      await line(tx, id, '1101', 100, 0, '5000.00', '0.00', 0)
      await line(tx, id, '3101', 0, 100, '0.00', '5000.00', 1)
      await line(tx, id, '1102', 0, 0, '1.00', '0.00', 2)
    }, /positive debit or credit/)
  })
  await check('zero-native lines need exactly one functional side', async () => {
    await reject(async (tx) => {
      const id = await entry(tx, { kind: 'revaluation', rate: '52' })
      await line(tx, id, '1101', 0, 0, null, null, 0)
    }, /journal_line_sides/)
  })
  await check('revaluations cannot be reversed and their operation rows are immutable', async () => {
    const id = (await db.query("SELECT id FROM accounting_journal_entries WHERE kind='revaluation' LIMIT 1")).rows[0].id
    await reject(async (tx) => {
      const reversal = await entry(tx, { reversalOf: id, date: '2026-10-31', rate: '52' })
      await line(tx, reversal, '1101', 0, 0, 0, '200.00', 0)
      await line(tx, reversal, '4402', 0, 0, '200.00', 0, 1)
    }, /journal_revaluation_shape|Invalid journal reversal/)
    await assert.rejects(db.exec('UPDATE accounting_revaluations SET source = $$edited$$'), /immutable/)
    await assert.rejects(db.exec('DELETE FROM accounting_revaluations'), /immutable/)
  })
  await check('operation rows must match their revaluation entry', async () => {
    await reject(async (tx) => {
      await tx.query('INSERT INTO accounting_revaluations(entry_id,date,currency,account_code,closing_rate,source,native_balance,base_before,base_after,delta,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [cashEntry, '2026-10-01', 'USD', '1101', '50', 'x', '100', '5000', '5100', '100', actor])
    }, /must match/)
  })
  await check('manual reversals remain available', async () => {
    await db.transaction(async (tx) => {
      const reversal = await entry(tx, { reversalOf: cashEntry, date: '2026-10-31', rateDate: '2026-10-01' })
      await line(tx, reversal, '1101', 0, 100, '0.00', '5000.00', 0)
      await line(tx, reversal, '3101', 100, 0, '5000.00', '0.00', 1)
    })
  })
  await check('anon and authenticated have no revaluation privileges', async () => {
    const rows = (await db.query("SELECT grantee FROM information_schema.role_table_grants WHERE table_name='accounting_revaluations' AND grantee IN ('anon','authenticated')")).rows
    assert.equal(rows.length, 0)
  })
  console.log(`${passed} revaluation PostgreSQL checks passed. No hotel database was accessed.`)
} finally {
  await db.close()
}
