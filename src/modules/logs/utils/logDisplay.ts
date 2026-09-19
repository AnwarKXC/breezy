import { formatDateTime } from '@/shared/utils/date'
import type { LogAction, LogEntry, LogModule, LogTimestampJson } from '../types'

const ACTION_LABELS: Record<LogAction, string> = {
  accounting_created: 'Created Accounting Record',
  accounting_deleted: 'Deleted Accounting Record',
  accounting_updated: 'Updated Accounting Record',
  contact_created: 'Created Contact',
  contact_deleted: 'Deleted Contact',
  contact_updated: 'Updated Contact',
  login: 'Login',
  logout: 'Logout',
  reservation_cancelled: 'Cancelled Reservation',
  reservation_checked_in: 'Checked In Reservation',
  reservation_checked_out: 'Checked Out Reservation',
  reservation_confirmed: 'Confirmed Reservation',
  reservation_created: 'Created Reservation',
  reservation_deleted: 'Deleted Reservation',
  reservation_extended: 'Extended Reservation',
  reservation_held: 'Created Hold on Reservation',
  reservation_no_show: 'Marked No-Show',
  reservation_note_added: 'Added Note to Reservation',
  reservation_payment_recorded: 'Recorded Payment',
  reservation_price_override: 'Overrode Reservation Price',
  reservation_refund_recorded: 'Recorded Refund',
  reservation_room_changed: 'Changed Room Assignment',
  reservation_updated: 'Updated Reservation',
  user_created: 'Created User',
  user_deleted: 'Deleted User',
  user_updated: 'Updated User',
  user_viewed: 'Viewed User',
}

const MODULE_LABELS: Record<LogModule, string> = {
  accounting: 'Accounting',
  auth: 'Auth',
  contacts: 'Contacts',
  reservations: 'Reservations',
  users: 'Users',
}

const DESCRIPTION_LABELS: Record<string, string> = {
  'logs.auth.login': 'User signed in',
  'logs.auth.logout': 'User signed out',
  'logs.users.created': 'User created',
  'logs.users.deleted': 'User deleted',
  'logs.users.updated': 'User updated',
  'logs.users.viewed': 'User viewed',
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

export function getActionLabel(action: LogAction) {
  return ACTION_LABELS[action] ?? action.replaceAll('_', ' ')
}

export function getModuleLabel(module: LogModule) {
  return MODULE_LABELS[module] ?? module
}

export function getLogDescription(log: LogEntry) {
  if (log.description) return DESCRIPTION_LABELS[log.description] ?? log.description
  return `${getActorLabel(log)} ${getActionLabel(log.action).toLowerCase()} ${getTargetLabel(log)}`
}

export function formatLogDate(createdAt: LogEntry['createdAt'] | Date | string | null | undefined, locale: string = 'en') {
  const date = timestampToDate(createdAt)
  if (!date) return '-'
  return formatDateTime(date.toISOString(), locale)
}
