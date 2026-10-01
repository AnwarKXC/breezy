// Shapes shared by the AI chat route (server) and the assistant UI (client).
// Numbers shown to the admin always come from these blocks, which are built from
// database rows by the tools — never from the model's text.

import type { Money } from '@/shared/currency/money'

export type ValueFormat = 'money' | 'money_list' | 'number' | 'percent' | 'date' | 'text' | 'enum'

export type CellValue = string | number | null | Money

export interface PeriodRange {
  from: string
  to: string
}

export interface KpiItem {
  /** i18n key under `assistant.fields`. */
  key: string
  value: number | null
  format: ValueFormat
  currency?: string
}

export interface TableColumn {
  /** Row property and i18n key under `assistant.fields`. */
  key: string
  format: ValueFormat
  /** For format 'money': the row property holding the currency code. */
  currencyKey?: string
}

/**
 * `title` is an i18n key under `assistant.blocks`. `subtitle` is free text (e.g.
 * the model's title for an ad-hoc SQL result) and is always rendered as plain text.
 */
export type ResultBlock =
  | { type: 'kpi'; title: string; period?: PeriodRange; items: KpiItem[] }
  | {
      type: 'table'
      title: string
      subtitle?: string
      period?: PeriodRange
      columns: TableColumn[]
      rows: Record<string, CellValue>[]
      /** Rows matching before the limit was applied. */
      totalRows: number
    }
  | {
      type: 'bars'
      title: string
      subtitle?: string
      period?: PeriodRange
      labelKey: string
      labelFormat: ValueFormat
      valueKey: string
      format: ValueFormat
      currency?: string
      rows: Record<string, CellValue>[]
    }

/** NDJSON lines streamed by POST /api/ai/chat. */
export type ChatStreamLine =
  | { type: 'tool'; name: string }
  | { type: 'block'; block: ResultBlock }
  | { type: 'text'; delta: string }
  | { type: 'done' }
  | { type: 'error'; code: AiErrorCode }

export type AiErrorCode =
  | 'ai/unavailable'
  | 'ai/budget_exceeded'
  | 'ai/provider_error'
  | 'ai/rate_limited'
  | 'ai/blocked'
  | 'ai/too_many_steps'
  | 'ai/failed'

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  text: string
}

export const AI_HISTORY_LIMIT = 12
export const AI_MESSAGE_MAX_LENGTH = 1500

export interface ConversationSummary {
  id: string
  /** First question of the conversation. */
  title: string
  turns: number
  updatedAt: string
}

export interface ConversationTurn {
  id: string
  question: string
  answer: string
  blocks: ResultBlock[]
  status: string
  errorCode: string | null
  createdAt: string
}

export interface ConversationDetail {
  id: string
  turns: ConversationTurn[]
}

export interface UsageSummary {
  today: { tokens: number; limit: number }
  period: PeriodRange
  turns: number
  errors: number
  avgLatencyMs: number
  daily: Array<{ date: string; turns: number; tokens: number; errors: number }>
  topTools: Array<{ name: string; calls: number }>
}
