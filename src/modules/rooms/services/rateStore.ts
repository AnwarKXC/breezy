import 'server-only'

import { prisma, type DbTransaction } from '@/services/db/prisma'
import type { CurrencyCode } from '@/shared/static/currencies'

// Rates live only in rate tables (see public.resolve_room_rate):
// - a room type's normal price is its open-ended room_type_pricing row;
// - a room's own price is a "standing" open-ended room_specific_rates row.
// Room.price / RoomType.basePrice in the app are views of these rows in the
// system currency; prices in other currencies are separate rows of each table.

const STANDING_START = new Date('2000-01-01T00:00:00.000Z')
const STANDING_END = new Date('9999-12-31T00:00:00.000Z')

type Db = DbTransaction | typeof prisma

/** Standing per-room prices (rooms without one inherit their type's price). */
export async function standingRoomRates(currency: CurrencyCode, roomIds?: string[], db: Db = prisma): Promise<Map<string, number>> {
  const rows = await db.room_specific_rates.findMany({
    where: { end_date: STANDING_END, currency, ...(roomIds ? { room_id: { in: roomIds } } : {}) },
    select: { room_id: true, override_rate: true },
  })
  return new Map(rows.map((row) => [row.room_id, Number(row.override_rate)]))
}

/** Sets (price > 0) or clears (price 0) a room's standing price. */
export async function setStandingRoomRate(db: Db, roomId: string, price: number, currency: CurrencyCode, actorId: string) {
  await db.room_specific_rates.deleteMany({ where: { room_id: roomId, end_date: STANDING_END, currency } })
  if (price > 0) {
    await db.room_specific_rates.create({
      data: {
        room_id: roomId,
        start_date: STANDING_START,
        end_date: STANDING_END,
        override_rate: price,
        currency,
        reason: 'Room price',
        created_by: actorId,
      },
    })
  }
}

/** Current (open-ended) normal price per room type. */
export async function currentTypePrices(currency: CurrencyCode, roomTypeIds?: string[], db: Db = prisma): Promise<Map<string, number>> {
  const rows = await db.room_type_pricing.findMany({
    where: { deleted_at: null, effective_until: null, currency, ...(roomTypeIds ? { room_type_id: { in: roomTypeIds } } : {}) },
    select: { room_type_id: true, price: true },
  })
  return new Map(rows.map((row) => [row.room_type_id, Number(row.price)]))
}

/** Updates the open-ended pricing version, or opens one after the latest closed version. */
export async function setCurrentTypePrice(db: Db, roomTypeId: string, price: number, currency: CurrencyCode) {
  const { count } = await db.room_type_pricing.updateMany({
    where: { room_type_id: roomTypeId, currency, deleted_at: null, effective_until: null },
    data: { price, updated_at: new Date() },
  })
  if (count > 0) return

  const latest = await db.room_type_pricing.findFirst({
    where: { room_type_id: roomTypeId, currency, deleted_at: null },
    orderBy: { effective_until: 'desc' },
    select: { effective_until: true },
  })
  await db.room_type_pricing.create({
    data: { room_type_id: roomTypeId, price, currency, effective_from: latest?.effective_until ?? null },
  })
}
