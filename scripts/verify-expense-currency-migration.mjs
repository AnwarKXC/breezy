import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

if (!process.env.JOURNAL_SQL_TOOLS) throw new Error('Set JOURNAL_SQL_TOOLS to local PGlite installation')
const require = createRequire(resolve(process.env.JOURNAL_SQL_TOOLS, 'package.json'))
const { PGlite } = require('@electric-sql/pglite')
const db = new PGlite()
await db.exec('CREATE TABLE expenses(id uuid PRIMARY KEY); CREATE TABLE accounting_ledger_entries(source_id uuid, source_type text, currency text);')
const ids = [1, 2, 3, 4].map((id) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`)
for (const id of ids) await db.query('INSERT INTO expenses(id) VALUES ($1)', [id])
for (const [id, currency] of [[ids[0], 'USD'], [ids[0], 'USD'], [ids[1], 'USD'], [ids[1], 'EUR'], [ids[3], 'EGP'], [ids[3], 'XYZ']]) {
  await db.query("INSERT INTO accounting_ledger_entries VALUES ($1, 'expense', $2)", [id, currency])
}
await db.exec(await readFile('prisma/migrations/20261001140000_expense_currency/migration.sql', 'utf8'))
const { rows } = await db.query('SELECT currency FROM expenses ORDER BY id')
assert.deepEqual(rows.map((row) => row.currency), ['USD', null, null, null])
await assert.rejects(db.query('UPDATE expenses SET currency = $1 WHERE id = $2', ['XYZ', ids[2]]), /expenses_currency_check/)
await db.exec('CREATE TABLE expense_categories(id uuid PRIMARY KEY, deleted_at timestamptz); ALTER TABLE expenses ADD COLUMN category_id uuid REFERENCES expense_categories(id); ALTER TABLE expenses ADD COLUMN deleted_at timestamptz;')
await db.query('INSERT INTO expense_categories(id) VALUES ($1)', [ids[0]])
await db.query('UPDATE expenses SET category_id = $1 WHERE id = $2', [ids[0], ids[0]])
await db.transaction(async (tx) => {
  await tx.query('UPDATE expenses SET deleted_at = now() WHERE category_id = $1', [ids[0]])
  await tx.query('UPDATE expense_categories SET deleted_at = now() WHERE id = $1', [ids[0]])
})
const archived = await db.query('SELECT e.id FROM expenses e JOIN expense_categories c ON c.id=e.category_id WHERE e.deleted_at IS NOT NULL AND c.deleted_at IS NOT NULL')
assert.equal(archived.rows.length, 1)
await db.close()
console.log('PASS 6 migration checks: unique evidence, conflicting evidence, absent evidence, unsupported evidence, currency constraint, category archival preserves foreign-key history')
