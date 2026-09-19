import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import type { room_status } from '@/generated/prisma/enums'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import { mapRoomRow, type Room, type RoomStatus } from '@/modules/rooms/types'

export interface RoomInput {
  number: string
  floor: number
  room_type_id: string
  status?: RoomStatus
  price?: number
  capacity?: number
  amenities?: unknown
}

export async function listRooms(filter: { status?: RoomStatus } = {}): Promise<Room[]> {
  const rows = await prisma.rooms.findMany({
    where: { deleted_at: null, ...(filter.status ? { status: filter.status as room_status } : {}) },
    orderBy: { number: 'asc' },
  })
  return rows.map((row) => mapRoomRow(toRow('rooms', row)))
}

export async function getRoom(id: string): Promise<Room | null> {
  const row = await prisma.rooms.findFirst({ where: { id, deleted_at: null } })
  return row ? mapRoomRow(toRow('rooms', row)) : null
}

export async function createRoom(input: RoomInput): Promise<Room> {
  let price = input.price
  if (!price) {
    const roomType = await prisma.room_types.findFirst({
      where: { id: input.room_type_id, deleted_at: null },
      select: { base_price: true },
    })
    price = roomType ? Number(roomType.base_price) : 0
  }

  const row = await prisma.rooms.create({
    data: {
      number: input.number,
      floor: input.floor,
      room_type_id: input.room_type_id,
      status: (input.status ?? 'available') as room_status,
      price,
      capacity: input.capacity ?? 2,
      amenities: (input.amenities ?? []) as Prisma.InputJsonValue,
    },
  })
  return mapRoomRow(toRow('rooms', row))
}

export async function updateRoom(id: string, input: Partial<RoomInput>): Promise<Room | null> {
  const data: Prisma.roomsUncheckedUpdateManyInput = {}
  if (input.number !== undefined) data.number = input.number
  if (input.floor !== undefined) data.floor = input.floor
  if (input.room_type_id !== undefined) data.room_type_id = input.room_type_id
  if (input.status !== undefined) data.status = input.status as room_status
  if (input.price !== undefined) data.price = input.price
  if (input.capacity !== undefined) data.capacity = input.capacity
  if (input.amenities !== undefined) data.amenities = input.amenities as Prisma.InputJsonValue

  const { count } = await prisma.rooms.updateMany({ where: { id, deleted_at: null }, data })
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
    return mapRoomRow(toRow('rooms', row))
  })
}
