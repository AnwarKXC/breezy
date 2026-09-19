import 'server-only'

import type { reservation_room_status, reservation_status, room_status } from '@/generated/prisma/enums'
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
    select: { room_id: true, status: true },
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
  for (const rr of rooms) {
    if (!rr.room_id) continue
    await tx.rooms.update({ where: { id: rr.room_id }, data: { status: 'occupied' } })
    await tx.room_status_history.create({
      data: {
        room_id: rr.room_id,
        from_status: rr.status ?? 'available',
        to_status: 'occupied',
        reservation_id: reservationId,
        changed_by: actorId,
        changed_at: at,
      },
    })
  }
}

/**
 * Sets every reservation_room of the reservation to `roomStatus` and frees the
 * physical rooms (rooms.status -> nextRoomStatus), logging room history.
 */
export async function releaseRooms(
  tx: DbTransaction,
  input: {
    reservationId: string
    actorId: string
    reason: string
    roomStatus: reservation_room_status
    nextRoomStatus?: room_status
    onlyIfOccupied?: boolean
    at?: Date
  },
) {
  const at = input.at ?? new Date()
  const nextRoomStatus = input.nextRoomStatus ?? 'available'
  const rooms = await assignedRooms(tx, input.reservationId)

  await tx.reservation_rooms.updateMany({
    where: { reservation_id: input.reservationId, deleted_at: null },
    data: { status: input.roomStatus },
  })

  for (const rr of rooms) {
    if (!rr.room_id) continue
    const from = rr.status ?? 'held'
    if (!input.onlyIfOccupied || from === 'occupied') {
      await tx.rooms.update({ where: { id: rr.room_id }, data: { status: nextRoomStatus } })
    }
    await tx.room_status_history.create({
      data: {
        room_id: rr.room_id,
        from_status: from,
        to_status: nextRoomStatus,
        reservation_id: input.reservationId,
        reason: input.reason,
        changed_by: input.actorId,
        changed_at: at,
      },
    })
  }
}

export function asReservationStatus(value: string): reservation_status {
  return value as reservation_status
}
