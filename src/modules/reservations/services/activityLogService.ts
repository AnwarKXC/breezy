import 'server-only'

import { logAction } from '@/services/logs'
import { LOG_ACTIONS, LOG_MODULES, type LogAction } from '@/types/logs'

export type ReservationLogEvent =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'checkedIn'
  | 'checkedOut'
  | 'cancelled'
  | 'noShow'
  | 'extended'
  | 'shortened'
  | 'roomChanged'
  | 'extraCharge'
  | 'noteAdded'
  | 'guestAdded'
  | 'guestUpdated'
  | 'guestRemoved'

const ACTION_MAP: Record<ReservationLogEvent, LogAction> = {
  created: LOG_ACTIONS.RESERVATION_CREATED,
  updated: LOG_ACTIONS.RESERVATION_UPDATED,
  deleted: LOG_ACTIONS.RESERVATION_DELETED,
  checkedIn: LOG_ACTIONS.RESERVATION_CHECKED_IN,
  checkedOut: LOG_ACTIONS.RESERVATION_CHECKED_OUT,
  cancelled: LOG_ACTIONS.RESERVATION_CANCELLED,
  noShow: LOG_ACTIONS.RESERVATION_NO_SHOW,
  extended: LOG_ACTIONS.RESERVATION_EXTENDED,
  shortened: LOG_ACTIONS.RESERVATION_UPDATED,
  roomChanged: LOG_ACTIONS.RESERVATION_ROOM_CHANGED,
  extraCharge: LOG_ACTIONS.RESERVATION_UPDATED,
  noteAdded: LOG_ACTIONS.RESERVATION_NOTE_ADDED,
  guestAdded: LOG_ACTIONS.RESERVATION_UPDATED,
  guestUpdated: LOG_ACTIONS.RESERVATION_UPDATED,
  guestRemoved: LOG_ACTIONS.RESERVATION_UPDATED,
}

/** Description keys that only the hotel-wide log records (no other table keeps their actor). */
export const AUDIT_ONLY_DESCRIPTIONS = ['updated', 'guestAdded', 'guestUpdated', 'guestRemoved'].map((e) => `logs.reservations.${e}`)

/**
 * Writes a reservation action to the hotel-wide audit log. Called after the
 * action has committed; a logging failure never fails the user's action.
 */
export async function logReservationActivity(
  session: { id: string; role?: string },
  event: ReservationLogEvent,
  reservationId: string,
  detail?: Record<string, unknown>,
) {
  try {
    await logAction({
      action: ACTION_MAP[event],
      description: `logs.reservations.${event}`,
      module: LOG_MODULES.RESERVATIONS,
      target: { id: reservationId, type: 'reservation' },
      metadata: detail ? { after: detail } : undefined,
      userId: session.id,
      userRole: session.role,
    })
  } catch (error) {
    console.error('[reservations] activity log failed', event, reservationId, error)
  }
}
