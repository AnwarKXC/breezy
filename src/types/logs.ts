import type { PaginatedResponse } from '@/shared/pagination/types'

export const LOG_ACTIONS = {
  ACCOUNTING_CREATED: 'accounting_created',
  ACCOUNTING_DELETED: 'accounting_deleted',
  ACCOUNTING_UPDATED: 'accounting_updated',
  CONTACT_CREATED: 'contact_created',
  CONTACT_DELETED: 'contact_deleted',
  CONTACT_UPDATED: 'contact_updated',
  LOGIN: 'login',
  LOGOUT: 'logout',
  RESERVATION_CANCELLED: 'reservation_cancelled',
  RESERVATION_CHECKED_IN: 'reservation_checked_in',
  RESERVATION_CHECKED_OUT: 'reservation_checked_out',
  RESERVATION_CONFIRMED: 'reservation_confirmed',
  RESERVATION_CREATED: 'reservation_created',
  RESERVATION_DELETED: 'reservation_deleted',
  RESERVATION_EXTENDED: 'reservation_extended',
  RESERVATION_HELD: 'reservation_held',
  RESERVATION_NO_SHOW: 'reservation_no_show',
  RESERVATION_NOTE_ADDED: 'reservation_note_added',
  RESERVATION_PAYMENT_RECORDED: 'reservation_payment_recorded',
  RESERVATION_PRICE_OVERRIDE: 'reservation_price_override',
  RESERVATION_REFUND_RECORDED: 'reservation_refund_recorded',
  RESERVATION_ROOM_CHANGED: 'reservation_room_changed',
  RESERVATION_UPDATED: 'reservation_updated',
  USER_CREATED: 'user_created',
  USER_DELETED: 'user_deleted',
  USER_UPDATED: 'user_updated',
  USER_VIEWED: 'user_viewed',
} as const

export const LOG_MODULES = {
  ACCOUNTING: 'accounting',
  AUTH: 'auth',
  CONTACTS: 'contacts',
  RESERVATIONS: 'reservations',
  USERS: 'users',
} as const
export type LogAction = (typeof LOG_ACTIONS)[keyof typeof LOG_ACTIONS]
export type LogModule = (typeof LOG_MODULES)[keyof typeof LOG_MODULES]
export interface LogActor {
  displayName?: string
  email?: string
  id: string
  name?: string
  role?: string
}

export interface LogTarget {
  email?: string
  id?: string
  name?: string
  role?: string
  type?: string
}

export interface LogMetadata {
  after?: Record<string, unknown>
  before?: Record<string, unknown>
  changedFields?: string[]
}

export interface LogTimestamp {
  nanoseconds: number
  seconds: number
}

export interface LogDocument {
  id: string
  action: LogAction
  actor: LogActor
  description: string
  metadata?: LogMetadata
  module: LogModule
  target?: LogTarget
  createdAt: LogTimestamp
}

export type CreateLogDocumentInput = Omit<LogDocument, 'id' | 'createdAt'> & { createdAt?: Date | LogTimestamp }
export interface LogFilters {
  action?: LogAction
  cursor?: string | null
  fromDate?: Date
  limit?: number
  module?: LogModule
  toDate?: Date
  userId?: string
}

export type LogsPage = PaginatedResponse<LogDocument>
export interface LogsAnalytics { mostActiveUser: string; mostUsedModule: LogModule | null; totalActionsToday: number }
