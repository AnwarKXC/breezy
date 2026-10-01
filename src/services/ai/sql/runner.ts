import 'server-only'

import { Pool, types, type FieldDef } from 'pg'

// Layer 1 of the read-only SQL path. Every query runs in its own transaction:
//   BEGIN READ ONLY → SET LOCAL statement_timeout/lock_timeout →
//   SET LOCAL ROLE ai_reader (can only SELECT schema `ai`) → query → ROLLBACK
// SET LOCAL keeps everything scoped to the transaction, which is what the
// Supabase transaction pooler requires. A small dedicated pool keeps ad-hoc
// queries from starving the app's Prisma pool.

const STATEMENT_TIMEOUT = '5s'
export const SQL_MAX_ROWS = 200

const globalForPool = globalThis as unknown as { aiSqlPool?: Pool }

function pool(): Pool {
  if (!globalForPool.aiSqlPool) {
    globalForPool.aiSqlPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 60_000, keepAlive: true })
  }
  return globalForPool.aiSqlPool
}

// Per-query parsers (the global pg.types registry is shared with Prisma's adapter).
const OID = { INT8: 20, NUMERIC: 1700, DATE: 1082, TIMESTAMP: 1114, TIMESTAMPTZ: 1184 } as const

const getTypeParser = ((oid: number, format?: 'text' | 'binary') => {
  if (oid === OID.INT8 || oid === OID.NUMERIC) return (value: string) => Number(value)
  if (oid === OID.DATE) return (value: string) => value
  if (oid === OID.TIMESTAMP || oid === OID.TIMESTAMPTZ) return (value: string) => new Date(value).toISOString()
  return types.getTypeParser(oid, format ?? 'text')
}) as typeof types.getTypeParser

const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700])

export interface SqlColumn {
  name: string
  kind: 'number' | 'date' | 'text'
}

export interface SqlResult {
  columns: SqlColumn[]
  rows: Record<string, unknown>[]
  truncated: boolean
}

function columnKind(field: FieldDef): SqlColumn['kind'] {
  if (NUMERIC_OIDS.has(field.dataTypeID)) return 'number'
  if (field.dataTypeID === OID.DATE) return 'date'
  return 'text'
}

/** Thrown when Postgres rejects the query (bad column, timeout …); the message is safe to show the model. */
export class SqlExecutionError extends Error {}

export async function runReadonlySql(sql: string): Promise<SqlResult> {
  const client = await pool().connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT}'`)
    await client.query(`SET LOCAL lock_timeout = '1s'`)
    await client.query('SET LOCAL ROLE ai_reader')
    await client.query('SET LOCAL search_path = ai, pg_catalog')
    // `values: []` forces the extended protocol, which rejects multi-statement text.
    const result = await client.query({
      text: `SELECT * FROM (${sql}\n) AS ai_query LIMIT ${SQL_MAX_ROWS + 1}`,
      values: [],
      types: { getTypeParser },
    })
    return {
      columns: result.fields.map((field) => ({ name: field.name, kind: columnKind(field) })),
      rows: result.rows.slice(0, SQL_MAX_ROWS),
      truncated: result.rows.length > SQL_MAX_ROWS,
    }
  } catch (error) {
    const pgError = error as { code?: string; message?: string }
    if (pgError.code === '57014') throw new SqlExecutionError(`Query took longer than ${STATEMENT_TIMEOUT}; filter by date or aggregate more.`)
    if (pgError.code === '42501') throw new SqlExecutionError('Permission denied: only the ai.* views can be read.')
    if (pgError.code && pgError.message) throw new SqlExecutionError(`PostgreSQL error ${pgError.code}: ${pgError.message}`)
    throw error
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    client.release()
  }
}
