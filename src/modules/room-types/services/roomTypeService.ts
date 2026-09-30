import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import { mapRoomTypeRow, toRoomTypeRow, type RoomType, type CreateRoomTypeInput, type UpdateRoomTypeInput } from '../types'
import { currentTypePrices, setCurrentTypePrice } from '@/modules/rooms/services/rateStore'
import { requireCatalogRead, requireSettingsWrite } from '@/modules/settings/services/serviceSecurity'
import { getSystemCurrency } from '@/shared/currency/server'

export async function listRoomTypes(): Promise<RoomType[]> {
  await requireCatalogRead()
  const [rows, prices] = await Promise.all([
    prisma.room_types.findMany({ where: { deleted_at: null }, orderBy: { name: 'asc' } }),
    getSystemCurrency().then((currency) => currentTypePrices(currency)),
  ])
  return rows.map((row) => mapRoomTypeRow(toRow('room_types', row), prices.get(row.id) ?? 0))
}

export async function getRoomType(id: string): Promise<RoomType | null> {
  await requireCatalogRead()
  const [row, prices] = await Promise.all([
    prisma.room_types.findFirst({ where: { id, deleted_at: null } }),
    getSystemCurrency().then((currency) => currentTypePrices(currency, [id])),
  ])
  return row ? mapRoomTypeRow(toRow('room_types', row), prices.get(id) ?? 0) : null
}

export async function createRoomType(input: CreateRoomTypeInput): Promise<RoomType> {
  await requireSettingsWrite()
  const basePrice = input.base_price ?? 0
  const currency = await getSystemCurrency()
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.room_types.create({ data: toRoomTypeRow(input) as Prisma.room_typesCreateInput })
    await setCurrentTypePrice(tx, created.id, basePrice, currency)
    return created
  })
  return mapRoomTypeRow(toRow('room_types', row), basePrice)
}

export async function updateRoomType(id: string, input: UpdateRoomTypeInput): Promise<RoomType> {
  await requireSettingsWrite()
  const currency = await getSystemCurrency()
  await prisma.$transaction(async (tx) => {
    await tx.room_types.update({ where: { id }, data: toRoomTypeRow(input) as Prisma.room_typesUpdateInput })
    if (input.base_price !== undefined) await setCurrentTypePrice(tx, id, input.base_price, currency)
  })
  const updated = await getRoomType(id)
  if (!updated) throw new Error('Room type not found')
  return updated
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
