import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import { mapRoomTypeRow, toRoomTypeRow, type RoomType, type CreateRoomTypeInput, type UpdateRoomTypeInput } from '../types'
import { requireCatalogRead, requireSettingsWrite } from '@/modules/settings/services/serviceSecurity'

export async function listRoomTypes(): Promise<RoomType[]> {
  await requireCatalogRead()
  const rows = await prisma.room_types.findMany({ where: { deleted_at: null }, orderBy: { name: 'asc' } })
  return rows.map((row) => mapRoomTypeRow(toRow('room_types', row)))
}

export async function getRoomType(id: string): Promise<RoomType | null> {
  await requireCatalogRead()
  const row = await prisma.room_types.findFirst({ where: { id, deleted_at: null } })
  return row ? mapRoomTypeRow(toRow('room_types', row)) : null
}

export async function createRoomType(input: CreateRoomTypeInput): Promise<RoomType> {
  await requireSettingsWrite()
  const row = await prisma.room_types.create({ data: toRoomTypeRow(input) as Prisma.room_typesCreateInput })
  return mapRoomTypeRow(toRow('room_types', row))
}

export async function updateRoomType(id: string, input: UpdateRoomTypeInput): Promise<RoomType> {
  await requireSettingsWrite()
  const row = await prisma.room_types.update({ where: { id }, data: toRoomTypeRow(input) as Prisma.room_typesUpdateInput })
  return mapRoomTypeRow(toRow('room_types', row))
}

/** Soft-deletes the room type together with its pricing and rooms. */
export async function deleteRoomType(id: string): Promise<void> {
  await requireSettingsWrite()
  const deletedAt = new Date()
  await prisma.$transaction([
    prisma.room_types.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: deletedAt } }),
    prisma.room_type_pricing.updateMany({ where: { room_type_id: id, deleted_at: null }, data: { deleted_at: deletedAt } }),
    prisma.rooms.updateMany({ where: { room_type_id: id, deleted_at: null }, data: { deleted_at: deletedAt } }),
  ])
}
