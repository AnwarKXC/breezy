import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { fromRow, toRow } from '@/services/db/rows'
import { mapPricingRow, type RoomTypePricing, type CreatePricingInput, type UpdatePricingInput } from '../types'
import { requireCatalogRead, requireSettingsWrite } from '@/modules/settings/services/serviceSecurity'

const toPricing = (row: unknown) => mapPricingRow(toRow('room_type_pricing', row))

export async function listPricing(): Promise<RoomTypePricing[]> {
  await requireCatalogRead()
  const rows = await prisma.room_type_pricing.findMany({ where: { deleted_at: null }, orderBy: [{ room_type_id: 'asc' }, { created_at: 'asc' }] })
  return rows.map(toPricing)
}

export async function getPricingByType(roomTypeId: string): Promise<RoomTypePricing[]> {
  await requireCatalogRead()
  const rows = await prisma.room_type_pricing.findMany({ where: { room_type_id: roomTypeId, deleted_at: null } })
  return rows.map(toPricing)
}

export async function createPricing(input: CreatePricingInput): Promise<RoomTypePricing> {
  await requireSettingsWrite()
  const row = await prisma.room_type_pricing.create({
    data: fromRow('room_type_pricing', input) as Prisma.room_type_pricingUncheckedCreateInput,
  })
  return toPricing(row)
}

export async function updatePricing(id: string, input: UpdatePricingInput): Promise<RoomTypePricing> {
  await requireSettingsWrite()
  const row = await prisma.room_type_pricing.update({
    where: { id },
    data: fromRow('room_type_pricing', input) as Prisma.room_type_pricingUncheckedUpdateInput,
  })
  return toPricing(row)
}

export async function deletePricing(id: string): Promise<void> {
  await requireSettingsWrite()
  await prisma.room_type_pricing.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: new Date() } })
}
