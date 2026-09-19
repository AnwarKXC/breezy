// 📁 src/services/index.ts - Service layer exports
// Data Access Layer: All Firestore/API services

export { bookingService, default as bookingServiceDefault } from './bookingService'
export { roomService, default as roomServiceDefault } from './roomService'
export { guestService, default as guestServiceDefault } from './guestService'
export { authService, getCurrentUser, login, logout } from './auth'
export { createLog, getLogs, getLogsAnalytics, getLogsByUser, logAction, LogServiceError } from './logs'

// Types re-export for convenience (so hooks can import from @/services)
export type { Booking } from '@/modules/bookings/types'
export type { Room } from '@/modules/rooms/types'
export type { Guest } from '@/modules/guests/types'
export type { AuthenticatedUser, AuthServiceErrorCode, AuthSession, LoginCredentials } from './auth'
export type { LogActionInput } from './logs'
export type { CreateLogDocumentInput, LogDocument, LogFilters, LogsAnalytics, LogsPage } from '@/types/logs'
