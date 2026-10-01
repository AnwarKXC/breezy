import 'server-only'

import { astVisitor, parse } from 'pgsql-ast-parser'

// Layer 2 of the read-only SQL path (layer 1 is the database: READ ONLY
// transaction + `ai_reader` role that can only read schema `ai`). The guard
// rejects anything that is not a single plain query over the curated views
// using allow-listed functions, and gives the model a fixable error message.
//
// The ORIGINAL text is executed, not a re-serialization: pgsql-ast-parser's
// toSql turns `GROUP BY 1` into `GROUP BY (1)` (a constant), silently changing
// results. A parser/Postgres disagreement cannot escalate: the extended query
// protocol rejects multiple statements and the role/transaction stay read-only.

export const AI_SQL_VIEWS = [
  'room_types',
  'rooms',
  'guests',
  'contacts',
  'reservations',
  'reservation_rooms',
  'reservation_guests',
  'invoices',
  'payments',
  'expense_categories',
  'expenses',
] as const

const VIEWS = new Set<string>(AI_SQL_VIEWS)

const ALLOWED_FUNCTIONS = new Set([
  // aggregates
  'count', 'sum', 'avg', 'min', 'max', 'string_agg', 'array_agg', 'bool_and', 'bool_or', 'percentile_cont', 'percentile_disc', 'mode', 'stddev', 'variance',
  // window
  'row_number', 'rank', 'dense_rank', 'percent_rank', 'ntile', 'lag', 'lead', 'first_value', 'last_value',
  // conditional / math
  'coalesce', 'nullif', 'greatest', 'least', 'round', 'trunc', 'floor', 'ceil', 'ceiling', 'abs', 'sign', 'mod', 'power', 'sqrt', 'div',
  // dates
  'date_trunc', 'date_part', 'extract', 'age', 'make_date', 'make_interval', 'to_char', 'to_date', 'now', 'current_date', 'generate_series', 'justify_days', 'isfinite',
  // text
  'lower', 'upper', 'initcap', 'trim', 'btrim', 'ltrim', 'rtrim', 'length', 'char_length', 'concat', 'concat_ws', 'substring', 'substr', 'left', 'right', 'replace', 'position', 'split_part', 'lpad', 'rpad', 'format',
])

const MAX_SQL_LENGTH = 4000

export class SqlGuardError extends Error {}

/** Validates model-written SQL; returns the text to execute. */
export function guardSql(raw: string): string {
  const sql = raw.trim().replace(/;\s*$/, '').trim()
  if (!sql) throw new SqlGuardError('SQL is empty.')
  if (sql.length > MAX_SQL_LENGTH) throw new SqlGuardError(`SQL is longer than ${MAX_SQL_LENGTH} characters; simplify it.`)

  let statements
  try {
    statements = parse(sql)
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : 'syntax error'
    throw new SqlGuardError(`Could not parse the SQL (${detail}). Use plain PostgreSQL SELECT syntax.`)
  }
  if (statements.length !== 1) throw new SqlGuardError('Exactly one statement is allowed (no semicolons).')
  const [statement] = statements
  if (!['select', 'union', 'union all', 'with', 'values'].includes(statement.type)) {
    throw new SqlGuardError('Only SELECT queries are allowed.')
  }

  const problems = new Set<string>()
  const cteNames = new Set<string>()
  const tables: Array<{ schema?: string; name: string }> = []

  const visitor = astVisitor((map) => ({
    insert: () => void problems.add('INSERT is not allowed.'),
    update: () => void problems.add('UPDATE is not allowed.'),
    delete: () => void problems.add('DELETE is not allowed.'),
    withRecursive: () => void problems.add('WITH RECURSIVE is not allowed.'),
    selection: (selection) => {
      if (selection.for) problems.add('FOR UPDATE/SHARE is not allowed.')
      map.super().selection(selection)
    },
    with: (withStatement) => {
      for (const bind of withStatement.bind) cteNames.add(bind.alias.name.toLowerCase())
      map.super().with(withStatement)
    },
    tableRef: (ref) => {
      tables.push({ schema: ref.schema?.toLowerCase(), name: ref.name.toLowerCase() })
    },
    call: (call) => {
      const schema = call.function.schema?.toLowerCase()
      const name = call.function.name.toLowerCase()
      if (schema === 'ai' ? name !== 'normalize_ar' : schema !== undefined || !ALLOWED_FUNCTIONS.has(name)) {
        problems.add(`Function ${schema ? `${schema}.` : ''}${name}() is not allowed.`)
      }
      map.super().call(call)
    },
  }))
  visitor.statement(statement)

  for (const table of tables) {
    const isCte = table.schema === undefined && cteNames.has(table.name)
    const isView = (table.schema === undefined || table.schema === 'ai') && VIEWS.has(table.name)
    if (!isCte && !isView) {
      problems.add(`Unknown table "${table.schema ? `${table.schema}.` : ''}${table.name}". Only these views exist: ${AI_SQL_VIEWS.map((v) => `ai.${v}`).join(', ')}.`)
    }
  }

  if (problems.size) throw new SqlGuardError([...problems].join(' '))
  return sql
}
