import type { Json } from '@/services/db/rowTypes'
import type { LogAction, LogActor, LogDocument, LogMetadata, LogModule, LogTarget } from '@/types/logs'
import { timestampFromIso } from './logTime'

interface LogRow {
  action: LogAction
  actor: unknown
  created_at: string
  description: string
  id: string
  metadata: unknown
  module: LogModule
  target: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function jsonObject(value: unknown): Json {
  return value as Json
}

export function mapLogRow(row: LogRow): LogDocument {
  return {
    id: row.id,
    action: row.action,
    actor: isRecord(row.actor) ? (row.actor as unknown as LogActor) : { id: 'unknown', name: 'unknown' },
    description: row.description,
    metadata: isRecord(row.metadata) ? (row.metadata as LogMetadata) : undefined,
    module: row.module,
    target: isRecord(row.target) ? (row.target as LogTarget) : undefined,
    createdAt: timestampFromIso(row.created_at),
  }
}
