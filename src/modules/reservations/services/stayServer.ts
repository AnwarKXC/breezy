import 'server-only'

import type { housekeeping_status, reservation_room_status, reservation_status } from '@/generated/prisma/enums'
import type { room_status } from '@/generated/prisma/enums'
import type { DbTransaction } from '@/services/db/prisma'

/** Reservation-level status history row. */
export async function recordReservationStatus(
  tx: DbTransaction,
  input: { reservationId: string; from: string | null; to: string; actorId: string; reason?: string | null; at?: Date },
) {
  await tx.reservation_status_history.create({
    data: {
      reservation_id: input.reservationId,
      from_status: input.from,
      to_status: input.to,
      reason: input.reason ?? null,
      changed_by: input.actorId,
      changed_at: input.at ?? new Date(),
    },
  })
}

/** Assigned rooms of a reservation (rows that have a physical room). */
export function assignedRooms(tx: DbTransaction, reservationId: string) {
  return tx.reservation_rooms.findMany({
    where: { reservation_id: reservationId, deleted_at: null },
    select: { room_id: true, status: true, rooms: { select: { status: true } } },
  })
}

/** Marks every assigned room occupied (reservation_rooms + rooms) and logs room history. */
export async function occupyRooms(tx: DbTransaction, reservationId: string, actorId: string, at = new Date()) {
  const rooms = await assignedRooms(tx, reservationId)
  const roomIds = rooms.map((r) => r.room_id).filter((id): id is string => Boolean(id))
  if (roomIds.length === 0) return

  await tx.reservation_rooms.updateMany({
    where: { reservation_id: reservationId, room_id: { in: roomIds }, deleted_at: null },
    data: { status: 'occupied' },
  })
  await tx.rooms.updateMany({ where: { id: { in: roomIds } }, data: { occupancy_status: 'occupied' } })
  await logRoomStatusChanges(tx, rooms, { reservationId, actorId, at })
}

/** Logs the derived rooms.status before/after a state change (skips unchanged rooms). */
async function logRoomStatusChanges(
  tx: DbTransaction,
  before: Array<{ room_id: string | null; rooms: { status: room_status } | null }>,
  input: { reservationId: string; actorId: string; at: Date; reason?: string },
) {
  const ids = before.map((rr) => rr.room_id).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return
  const after = new Map(
    (await tx.rooms.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } })).map((r) => [r.id, r.status]),
  )
  await tx.room_status_history.createMany({
    data: before.flatMap((rr) => {
      const to = rr.room_id ? after.get(rr.room_id) : undefined
      if (!rr.room_id || !to || to === rr.rooms?.status) return []
      return [{
        room_id: rr.room_id,
        from_status: rr.rooms?.status ?? null,
        to_status: to,
        reservation_id: input.reservationId,
        reason: input.reason ?? null,
        changed_by: input.actorId,
        changed_at: input.at,
      }]
    }),
  })
}

/**
 * Sets every reservation_room of the reservation to `roomStatus` and vacates the
 * physical rooms (optionally setting their housekeeping state), logging room history.
 */
export async function releaseRooms(
  tx: DbTransaction,
  input: {
    reservationId: string
    actorId: string
    reason: string
    roomStatus: reservation_room_status
    housekeeping?: housekeeping_status
    onlyIfOccupied?: boolean
    at?: Date
  },
) {
  const at = input.at ?? new Date()
  const rooms = await assignedRooms(tx, input.reservationId)

  await tx.reservation_rooms.updateMany({
    where: { reservation_id: input.reservationId, deleted_at: null },
    data: { status: input.roomStatus },
  })

  // onlyIfOccupied: only free rooms whose stay was checked in (reservation_rooms.status).
  const released = rooms.filter(
    (rr): rr is typeof rr & { room_id: string } =>
      Boolean(rr.room_id) && (!input.onlyIfOccupied || rr.status === 'occupied'),
  )
  await tx.rooms.updateMany({
    where: { id: { in: released.map((rr) => rr.room_id) } },
    data: { occupancy_status: 'vacant', ...(input.housekeeping ? { housekeeping_status: input.housekeeping } : {}) },
  })
  await logRoomStatusChanges(tx, released, { reservationId: input.reservationId, actorId: input.actorId, at, reason: input.reason })
}

export function asReservationStatus(value: string): reservation_status {
  return value as reservation_status
}
