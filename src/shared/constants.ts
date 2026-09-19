export const MS_PER_DAY = 86_400_000

export const SYSTEM_USER_ID = 'e73d7512-15fb-45fc-a0a8-cf1d13e76974'

export const DEFAULT_TAX_RATE = 14
export const DEFAULT_PAGE_SIZE = 10
export const DEBOUNCE_MS = 500
export const CLEAN_TIME_MS = 2 * 60 * 60 * 1000

export const RoomStatus = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  CLEANING: 'cleaning',
  DIRTY: 'dirty',
} as const

export const ReservationStatus = {
  BOOKED: 'booked',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const

export const InvoiceStatus = {
  PENDING: 'pending',
  ISSUED: 'issued',
  PARTIALLY_PAID: 'partially_paid',
  PARTIALLY_REFUNDED: 'partially_refunded',
  PAID: 'paid',
  VOID: 'void',
  REFUNDED: 'refunded',
  OVERDUE: 'overdue',
} as const

export const PaymentStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const

export const PostgresErrorCode = {
  INSUFFICIENT_PRIVILEGE: '42501',
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
} as const
