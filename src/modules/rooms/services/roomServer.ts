import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import type { room_status } from '@/generated/prisma/enums'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import { setStandingRoomRate, standingRoomRates } from '@/modules/rooms/services/rateStore'
import {
  mapRoomRow,
  type HousekeepingStatus,
  type Room,
  type RoomOccupancyStatus,
  type RoomOperationalStatus,
  type RoomStatus,
} from '@/modules/rooms/types'

export interface RoomInput {
  number: string
  floor: number
  room_type_id: string
  /** Legacy single status; translated into the three state columns by the DB. */
  status?: RoomStatus
  occupancy_status?: RoomOccupancyStatus
  housekeeping_status?: HousekeepingStatus
  operational_status?: RoomOperationalStatus
  price?: number
  capacity?: number
  amenities?: unknown
}

export async function listRooms(filter: { status?: RoomStatus } = {}): Promise<Room[]> {
  const [rows, rates] = await Promise.all([
    prisma.rooms.findMany({
      where: { deleted_at: null, ...(filter.status ? { status: filter.status as room_status } : {}) },
      orderBy: { number: 'asc' },
    }),
    standingRoomRates(),
  ])
  return rows.map((row) => mapRoomRow(toRow('rooms', row), rates.get(row.id) ?? 0))
}

export async function getRoom(id: string): Promise<Room | null> {
  const [row, rates] = await Promise.all([
    prisma.rooms.findFirst({ where: { id, deleted_at: null } }),
    standingRoomRates([id]),
  ])
  return row ? mapRoomRow(toRow('rooms', row), rates.get(id) ?? 0) : null
}

/** A room priced like its type needs no rate row; only a different price is stored. */
export async function createRoom(input: RoomInput, actorId: string): Promise<Room> {
  const price = input.price ?? 0
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.rooms.create({
      data: {
        number: input.number,
        floor: input.floor,
        room_type_id: input.room_type_id,
        status: (input.status ?? 'available') as room_status,
        capacity: input.capacity ?? 2,
        amenities: (input.amenities ?? []) as Prisma.InputJsonValue,
      },
    })
    await setStandingRoomRate(tx, created.id, price, actorId)
    return created
  })
  return mapRoomRow(toRow('rooms', row), price)
}

export async function updateRoom(id: string, input: Partial<RoomInput>, actorId: string): Promise<Room | null> {
  const data: Prisma.roomsUncheckedUpdateManyInput = {}
  if (input.number !== undefined) data.number = input.number
  if (input.floor !== undefined) data.floor = input.floor
  if (input.room_type_id !== undefined) data.room_type_id = input.room_type_id
  if (input.status !== undefined) data.status = input.status as room_status
  if (input.occupancy_status !== undefined) data.occupancy_status = input.occupancy_status
  if (input.housekeeping_status !== undefined) data.housekeeping_status = input.housekeeping_status
  if (input.operational_status !== undefined) data.operational_status = input.operational_status
  if (input.capacity !== undefined) data.capacity = input.capacity
  if (input.amenities !== undefined) data.amenities = input.amenities as Prisma.InputJsonValue

  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.rooms.updateMany({ where: { id, deleted_at: null }, data })
    if (count && input.price !== undefined) await setStandingRoomRate(tx, id, input.price, actorId)
    return count
  })
  return count ? getRoom(id) : null
}

export async function deleteRoom(id: string): Promise<boolean> {
  const { count } = await prisma.rooms.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: new Date() } })
  return count > 0
}

/** Changes a room's status and records it in room_status_history as the acting user. */
export async function changeRoomStatus(input: {
  roomId: string
  status: RoomStatus
  reason?: string | null
  actorId: string
}): Promise<Room | null> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.rooms.findFirst({ where: { id: input.roomId, deleted_at: null }, select: { status: true } })
    if (!current) return null

    const row = await tx.rooms.update({
      where: { id: input.roomId },
      data: { status: input.status as room_status },
    })
    if (current.status !== input.status) {
      await tx.room_status_history.create({
        data: {
          room_id: input.roomId,
          from_status: current.status,
          to_status: input.status,
          reason: input.reason ?? null,
          changed_by: input.actorId,
        },
      })
    }
    const rates = await standingRoomRates([input.roomId], tx)
    return mapRoomRow(toRow('rooms', row), rates.get(input.roomId) ?? 0)
  })
}
