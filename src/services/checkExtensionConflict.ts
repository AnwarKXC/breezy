import { reservationService } from '@/services/reservationService'
import type { AvailableRoom } from '@/modules/reservations/types'

export interface ExtensionConflict {
  source: 'reservation'
  id: string
  checkIn: string
  checkOut: string
}

export interface CheckExtensionConflictResult {
  ok: boolean
  conflicts?: ExtensionConflict[]
}

/**
 * Checks whether a room is free for an extension. The server mirrors the
 * reservation_rooms_no_overlap exclusion constraint (see the extension-check route).
 */
export async function checkExtensionConflict(
  roomId: string,
  checkIn: string,
  newCheckOut: string,
  exclude: { reservationId?: string } = {},
): Promise<CheckExtensionConflictResult> {
  const params = new URLSearchParams({ roomId, checkIn: checkIn.slice(0, 10), checkOut: newCheckOut.slice(0, 10) })
  const res = await fetch('/api/reservations/' + encodeURIComponent(exclude.reservationId ?? '') + '/extension-check?' + params.toString())
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: CheckExtensionConflictResult } | null
  if (!res.ok || !json?.ok || !json.data) throw new Error('Extension check failed')
  return json.data
}

export async function getAlternativeRooms(
  checkIn: string,
  newCheckOut: string,
  excludeRoomId?: string,
): Promise<AvailableRoom[]> {
  // get_room_availability already excludes rooms with overlapping stays.
  const result = await reservationService.getAvailability({
    checkIn,
    checkOut: newCheckOut,
  })
  if (!result.ok || !result.data) return []

  return result.data.filter((r) => {
    if (r.status !== 'available') return false
    if (excludeRoomId && r.roomId === excludeRoomId) return false
    return true
  })
}
