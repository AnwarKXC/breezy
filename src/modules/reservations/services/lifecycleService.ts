import type { ReservationStatus } from '@/modules/reservations/types'

const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  draft: ['held', 'confirmed', 'cancelled'],
  held: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  no_show: [],
  expired: [],
}

const TERMINAL_STATUSES: ReservationStatus[] = ['checked_out', 'cancelled', 'no_show', 'expired']

export function isTerminalStatus(status: ReservationStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
