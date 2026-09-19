import { formatDateTime } from '@/shared/utils/date'
import type { LogAction, LogEntry, LogModule, LogTimestampJson } from '../types'

type Translate = (key: string) => string

// Labels live in the locale files (logs.actions / logs.modules / logs.<module>.<event>).
// t() returns the key itself when a label is missing; fall back to readable text.
function translateOr(t: Translate, key: string, fallback: string) {
  const label = t(key)
  return label === key ? fallback : label
}

function timestampToDate(value: LogTimestampJson | Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const seconds = Number(value.seconds)
  const nanoseconds = Number(value.nanoseconds)
  if (!Number.isFinite(seconds)) return null
  return new Date(seconds * 1000 + (Number.isFinite(nanoseconds) ? Math.floor(nanoseconds / 1_000_000) : 0))
}

export function getActorLabel(log: LogEntry) {
  return log.actor?.displayName || log.actor?.name || log.actor?.id || '-'
}

export function getTargetLabel(log: LogEntry) {
  return log.target?.id || '-'
}

export function getActionLabel(action: LogAction, t: Translate) {
  return translateOr(t, `logs.actions.${action}`, action.replaceAll('_', ' '))
}

export function getModuleLabel(module: LogModule, t: Translate) {
  return translateOr(t, `logs.modules.${module}`, module)
}

/** Descriptions are stored as translation-key paths (e.g. logs.users.created). */
export function getLogDescription(log: LogEntry, t: Translate) {
  if (log.description) return translateOr(t, log.description, log.description)
  return `${getActorLabel(log)} ${getActionLabel(log.action, t)} ${getTargetLabel(log)}`
}

export function formatLogDate(createdAt: LogEntry['createdAt'] | Date | string | null | undefined, locale: string = 'en') {
  const date = timestampToDate(createdAt)
  if (!date) return '-'
  return formatDateTime(date.toISOString(), locale)
}
