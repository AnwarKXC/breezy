import 'server-only'

import type { occupancy_code } from '@/generated/prisma/enums'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import type { CompanyPriceOverride, CreatePriceOverrideInput, OccupancyCode } from '../types'
import { requireContactsRead, requirePriceOverridesUpdate } from './serviceSecurity'

function mapOverrideRow(raw: unknown): CompanyPriceOverride {
  const row = toRow('company_price_overrides', raw)
  return {
    id: row.id,
    contactId: row.contact_id,
    roomCategory: row.room_category,
    occupancyCode: row.occupancy_code as OccupancyCode,
    price: row.price,
    currency: row.currency,
  }
}

export async function getPriceOverrides(contactId: string): Promise<CompanyPriceOverride[]> {
  await requireContactsRead()
  const rows = await prisma.company_price_overrides.findMany({
    where: { contact_id: contactId, deleted_at: null },
    orderBy: [{ room_category: 'asc' }, { occupancy_code: 'asc' }],
  })
  return rows.map(mapOverrideRow)
}

/** Insert or revive one override per (contact, room category, occupancy). */
export async function upsertPriceOverrides(
  contactId: string,
  overrides: CreatePriceOverrideInput[],
): Promise<CompanyPriceOverride[]> {
  await requirePriceOverridesUpdate()
  const rows = await prisma.$transaction(
    overrides.map((o) => {
      const key = { contact_id: contactId, room_category: o.roomCategory, occupancy_code: o.occupancyCode as occupancy_code }
      const values = { price: o.price, currency: o.currency ?? 'USD', deleted_at: null }
      return prisma.company_price_overrides.upsert({
        where: { contact_id_room_category_occupancy_code: key },
        create: { ...key, ...values },
        update: values,
      })
    }),
  )
  return rows.map(mapOverrideRow)
}

export async function deletePriceOverride(id: string): Promise<void> {
  await requirePriceOverridesUpdate()
  await prisma.company_price_overrides.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: new Date() } })
}
