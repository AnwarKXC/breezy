import 'server-only'

import { z } from 'zod'

import type { CellValue, ResultBlock, TableColumn } from '@/modules/assistant/types'

import { guardSql, SqlGuardError } from '../sql/guard'
import { runReadonlySql, SqlExecutionError, SQL_MAX_ROWS, type SqlResult } from '../sql/runner'
import { aiSqlSchemaDoc } from '../sql/schemaDoc'
import { defineTool, ToolInputError } from './registry'
import { limitForModel } from './shared'

const MONEY_COLUMN = /amount|total|revenue|paid|balance|price|rate|collected|invoiced|outstanding|spent|cost|value|net|sum|refund|expense|adr|revpar/i

export const getSqlSchema = defineTool({
  name: 'get_sql_schema',
  description:
    'Returns the read-only database views, columns and rules needed to write SQL for run_readonly_sql. Call it once before your first run_readonly_sql in a conversation.',
  args: z.object({}),
  async run(_args, ctx) {
    return { data: { schema: aiSqlSchemaDoc(ctx.today) }, blocks: [] }
  },
})

function toCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value)
}

function toBlocks(result: SqlResult, title: string): ResultBlock[] {
  const hasCurrency = result.columns.some((c) => c.name === 'currency')
  const columns: TableColumn[] = result.columns.map((column) => {
    if (column.kind === 'number') {
      return hasCurrency && MONEY_COLUMN.test(column.name) ? { key: column.name, format: 'money', currencyKey: 'currency' } : { key: column.name, format: 'number' }
    }
    return { key: column.name, format: column.kind === 'date' ? 'date' : 'text' }
  })
  const rows = result.rows.map((row) => Object.fromEntries(result.columns.map((c) => [c.name, toCell(row[c.name])])))
  const blocks: ResultBlock[] = []

  // Two-column "label, number" results also get a bar chart.
  const [first, second] = result.columns
  if (result.columns.length === 2 && first.kind !== 'number' && second.kind === 'number' && rows.length >= 2 && rows.length <= 40) {
    blocks.push({ type: 'bars', title: 'custom_query', subtitle: title, labelKey: first.name, labelFormat: first.kind === 'date' ? 'date' : 'text', valueKey: second.name, format: 'number', rows })
  }
  blocks.push({ type: 'table', title: 'custom_query', subtitle: title, columns, rows, totalRows: result.truncated ? SQL_MAX_ROWS + 1 : rows.length })
  return blocks
}

export const runReadonlySqlTool = defineTool({
  name: 'run_readonly_sql',
  description:
    'LAST RESORT for questions no other tool answers (unusual combinations of tables/filters). Runs ONE read-only PostgreSQL SELECT over the ai.* views described by get_sql_schema. Returns at most 200 rows. On an error, fix the SQL and retry (max 2 retries).',
  args: z.object({
    sql: z.string().min(1).max(4000).describe('One SELECT or WITH query, no semicolon'),
    title: z.string().min(1).max(120).describe("Short title for the result table, in the user's language"),
  }),
  async run(args) {
    let sql: string
    try {
      sql = guardSql(args.sql)
    } catch (error) {
      if (error instanceof SqlGuardError) throw new ToolInputError(`SQL rejected: ${error.message}`)
      throw error
    }
    let result: SqlResult
    try {
      result = await runReadonlySql(sql)
    } catch (error) {
      if (error instanceof SqlExecutionError) throw new ToolInputError(error.message)
      throw error
    }
    return {
      data: {
        row_count: result.rows.length,
        truncated: result.truncated,
        columns: result.columns.map((c) => c.name),
        rows: limitForModel(result.rows, 30),
      },
      blocks: toBlocks(result, args.title),
    }
  },
})
