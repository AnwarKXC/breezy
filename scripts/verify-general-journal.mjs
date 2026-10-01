// Disposable, local PostgreSQL (PGlite) verification; never reads hotel credentials.
// Install the test engine outside the repository and pass JOURNAL_SQL_TOOLS.
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

async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${name}`)
}
async function reject(action, pattern) {
  await assert.rejects(db.transaction(action), pattern)
}
async function entry(tx, lines, options = {}) {
  const id = randomUUID()
  await tx.query('INSERT INTO accounting_journal_entries(id,entry_number,date,currency,description,created_by,reversal_of_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, `TEST-${id}`, options.date ?? '2026-10-01', options.currency ?? 'EGP', 'Verification', actor, options.reversalOf ?? null])
  for (const [position, line] of lines.entries()) await tx.query('INSERT INTO accounting_journal_lines(entry_id,account_code,debit,credit,contact_id,sort_order) VALUES($1,$2,$3,$4,$5,$6)', [id, line.account, line.debit ?? '0', line.credit ?? '0', line.contact ?? null, position])
  return id
}
const cash = [{ account: '1101', debit: '10.00' }, { account: '3101', credit: '10.00' }]
try {
  await db.exec('CREATE TABLE public.users(id uuid PRIMARY KEY); CREATE TABLE public.contacts(id uuid PRIMARY KEY, deleted_at timestamptz); CREATE ROLE anon; CREATE ROLE authenticated;')
  await db.query('INSERT INTO users VALUES($1)', [actor])
  await db.query('INSERT INTO contacts VALUES($1,NULL)', [contact])
  const sql = await readFile(resolve('prisma/migrations/20261001120000_general_journal/migration.sql'), 'utf8')
  await db.exec(sql)
  await check('migration seeds the complete hotel chart', async () => { assert.equal((await db.query('SELECT count(*)::int AS count FROM accounting_accounts')).rows[0].count, 23) })
  let original
  await check('balanced entries commit with exact decimals', async () => {
    original = await db.transaction((tx) => entry(tx, cash))
    await db.transaction((tx) => entry(tx, [{ account: '1101', debit: '0.10' }, { account: '1102', debit: '0.20' }, { account: '3101', credit: '0.30' }]))
  })
  await check('header without lines fails at commit', () => reject((tx) => entry(tx, []), /balanced positive lines/))
  await check('unbalanced entry fails at commit', () => reject((tx) => entry(tx, [cash[0], { account: '3101', credit: '9.99' }]), /balanced positive lines/))
  await check('double-sided and negative lines are rejected', async () => { await reject((tx) => entry(tx, [{ account: '1101', debit: '10', credit: '1' }, cash[1]]), /check constraint/); await reject((tx) => entry(tx, [{ account: '1101', debit: '-10' }, cash[1]]), /check constraint/) })
  await check('heading accounts and unknown accounts are rejected', async () => { for (const account of ['1', '9999']) await reject((tx) => entry(tx, [{ ...cash[0], account }, cash[1]]), /active postable leaf/) })
  await check('control account requires a contact', () => reject((tx) => entry(tx, [{ ...cash[0], account: '1201' }, cash[1]]), /requires a contact/))
  await check('meaningless same-account offsets fail', () => reject((tx) => entry(tx, [cash[0], { account: '1101', credit: '10' }]), /change at least one/))
  await check('unsupported currencies fail', () => reject((tx) => entry(tx, cash, { currency: 'JPY' }), /check constraint/))
  await check('posted headers and lines cannot change or be deleted', async () => {
    for (const sql of ['UPDATE accounting_journal_entries SET description = description', 'DELETE FROM accounting_journal_entries', 'UPDATE accounting_journal_lines SET debit = debit', 'DELETE FROM accounting_journal_lines']) await assert.rejects(db.exec(sql), /immutable/)
  })
  await check('new lines cannot be attached to an existing posting', () => reject((tx) => tx.query('INSERT INTO accounting_journal_lines(entry_id,account_code,debit) VALUES($1,$2,1)', [original, '1101']), /Cannot add a line/))
  await check('reversal must exactly mirror the original', () => reject((tx) => entry(tx, [{ account: '3101', debit: '9' }, { account: '1101', credit: '9' }], { reversalOf: original }), /exactly reverse/))
  let reversal
  await check('exact reversal commits once', async () => {
    reversal = await db.transaction((tx) => entry(tx, [{ account: '3101', debit: '10' }, { account: '1101', credit: '10' }], { reversalOf: original }))
    await reject((tx) => entry(tx, [{ account: '3101', debit: '10' }, { account: '1101', credit: '10' }], { reversalOf: original }), /unique constraint/)
  })
  await check('reversal of reversal is rejected', () => reject((tx) => entry(tx, cash, { reversalOf: reversal }), /Invalid journal reversal/))
  await check('inactive accounts reject ordinary entries', async () => {
    await db.exec("UPDATE accounting_accounts SET active = false WHERE code = '1102'")
    await reject((tx) => entry(tx, [{ ...cash[0], account: '1102' }, cash[1]]), /active postable leaf/)
  })
  await check('deleted contact rejects normal posts but historical reversal still works', async () => {
    const linked = await db.transaction((tx) => entry(tx, [{ account: '1201', contact, debit: '10' }, cash[1]]))
    await db.query('UPDATE contacts SET deleted_at = now() WHERE id = $1', [contact])
    await reject((tx) => entry(tx, [{ account: '1201', contact, debit: '10' }, cash[1]]), /contact must be active/)
    await db.exec("UPDATE accounting_accounts SET active = false WHERE code = '1201'")
    await db.transaction((tx) => entry(tx, [{ account: '3101', debit: '10' }, { account: '1201', contact, credit: '10' }], { reversalOf: linked }))
  })
  await check('closed periods block posting and can reopen', async () => {
    await db.exec("UPDATE accounting_periods SET status = 'closed' WHERE month = '2026-10'")
    await reject((tx) => entry(tx, cash), /period is not open/)
    await db.exec("UPDATE accounting_periods SET status = 'open' WHERE month = '2026-10'")
    await db.transaction((tx) => entry(tx, cash))
  })
  await check('locked periods never reopen and cannot be deleted', async () => {
    await db.exec("UPDATE accounting_periods SET status = 'locked' WHERE month = '2026-10'")
    await assert.rejects(db.exec("UPDATE accounting_periods SET status = 'open' WHERE month = '2026-10'"), /cannot be reopened/)
    await assert.rejects(db.exec("DELETE FROM accounting_periods WHERE month = '2026-10'"), /cannot be deleted/)
    await reject((tx) => entry(tx, cash), /period is not open/)
  })
  await check('anon and authenticated have no journal table privileges', async () => {
    const rows = (await db.query("SELECT rolname, has_table_privilege(rolname,'accounting_journal_entries','SELECT') AS read, has_table_privilege(rolname,'accounting_journal_entries','INSERT') AS write FROM pg_roles WHERE rolname IN ('anon','authenticated')")).rows
    assert.equal(rows.length, 2)
    for (const row of rows) { assert.equal(row.read, false); assert.equal(row.write, false) }
  })
  console.log(`${passed} local PostgreSQL checks passed. No hotel database was accessed.`)
} finally { await db.close() }
