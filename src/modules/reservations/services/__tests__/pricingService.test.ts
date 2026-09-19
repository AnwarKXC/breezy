import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyRoomPriceOverride, buildPricingItems, calculatePricing, calculateTotals, getEffectiveRate } from '../pricingService'
import type { PriceBreakdown } from '../pricingService'
import { createPrismaMock, resetPrismaMock } from '@/test/prismaMock'

describe('buildPricingItems', () => {
  it('builds correct pricing items for standard booking', () => {
    const items = buildPricingItems({
      nightlyRate: 1000,
      nights: 3,
      checkIn: '2026-07-01',
      checkOut: '2026-07-04',
      roomNumber: '101',
      roomTypeName: 'Deluxe',
      serviceChargePercent: 10,
      taxPercent: 14,
      currency: 'EGP',
    })

    const nightlyItems = items.filter((i) => i.itemType === 'nightly_rate')
    expect(nightlyItems).toHaveLength(3)
    expect(nightlyItems[0].description).toContain('2026-07-01')
    expect(nightlyItems[0].totalAmount).toBe(1000)
    expect(nightlyItems[0].unitAmount).toBe(1000)

    const serviceCharge = items.find((i) => i.itemType === 'service_charge')
    expect(serviceCharge).toBeDefined()
    const expectedService = Math.round(3000 * 0.1 * 100) / 100
    expect(serviceCharge!.totalAmount).toBe(expectedService)

    const tax = items.find((i) => i.itemType === 'tax')
    expect(tax).toBeDefined()
    const expectedTax = Math.round((3000 + expectedService) * 0.14 * 100) / 100
    expect(tax!.totalAmount).toBe(expectedTax)
  })

  it('handles single night stays', () => {
    const items = buildPricingItems({
      nightlyRate: 500,
      nights: 1,
      checkIn: '2026-08-01',
      checkOut: '2026-08-02',
      roomNumber: '201',
      roomTypeName: 'Standard',
      serviceChargePercent: 10,
      taxPercent: 14,
      currency: 'EGP',
    })

    const nightlyItems = items.filter((i) => i.itemType === 'nightly_rate')
    expect(nightlyItems).toHaveLength(1)
    expect(nightlyItems[0].totalAmount).toBe(500)

    const serviceCharge = items.find((i) => i.itemType === 'service_charge')
    expect(serviceCharge!.totalAmount).toBe(50)

    const tax = items.find((i) => i.itemType === 'tax')
    const expectedTax = Math.round((500 + 50) * 0.14 * 100) / 100
    expect(tax!.totalAmount).toBe(expectedTax)
  })

  it('includes payer and priceSource on each item', () => {
    const items = buildPricingItems({
      nightlyRate: 800,
      nights: 2,
      checkIn: '2026-09-01',
      checkOut: '2026-09-03',
      roomNumber: '301',
      roomTypeName: 'Suite',
      serviceChargePercent: 10,
      taxPercent: 14,
      currency: 'EGP',
    })

    for (const item of items) {
      expect(item.payer).toBe('guest')
      expect(item.priceSource).toBe('default_room_type_rate')
    }
  })

  it('throws on invalid inputs', () => {
    expect(() => buildPricingItems({
      nightlyRate: 0,
      nights: 1,
      checkIn: '2026-07-01',
      checkOut: '2026-07-02',
      roomNumber: '101',
      roomTypeName: 'Deluxe',
      serviceChargePercent: 10,
      taxPercent: 14,
      currency: 'EGP',
    })).toThrow('Nightly rate must be positive')

    expect(() => buildPricingItems({
      nightlyRate: -100,
      nights: 1,
      checkIn: '2026-07-01',
      checkOut: '2026-07-02',
      roomNumber: '101',
      roomTypeName: 'Deluxe',
      serviceChargePercent: 10,
      taxPercent: 14,
      currency: 'EGP',
    })).toThrow('Nightly rate must be positive')
  })
})

describe('calculateTotals', () => {
  it('aggregates pricing items correctly', () => {
    const breakdown: PriceBreakdown = {
      nightlyRate: 500,
      nights: 2,
      roomCharges: 1000,
      taxes: 140,
      serviceCharges: 100,
      discounts: 0,
      fees: 0,
      total: 1240,
      currency: 'EGP',
      items: [
        { itemType: 'nightly_rate', description: 'Night 1', quantity: 1, unitAmount: 500, totalAmount: 500, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'nightly_rate', description: 'Night 2', quantity: 1, unitAmount: 500, totalAmount: 500, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'service_charge', description: 'Service 10%', quantity: 1, unitAmount: 100, totalAmount: 100, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'tax', description: 'VAT 14%', quantity: 1, unitAmount: 140, totalAmount: 140, payer: 'guest', priceSource: 'default_room_type_rate' },
      ],
    }

    const totals = calculateTotals(breakdown)
    expect(totals.total).toBe(1240)
    expect(totals.roomCharges).toBe(1000)
    expect(totals.taxes).toBe(140)
    expect(totals.serviceCharges).toBe(100)
    expect(totals.discounts).toBe(0)
  })

  it('handles discounts correctly', () => {
    const breakdown: PriceBreakdown = {
      nightlyRate: 500,
      nights: 2,
      roomCharges: 1000,
      taxes: 140,
      serviceCharges: 100,
      discounts: 200,
      fees: 0,
      total: 1040,
      currency: 'EGP',
      items: [
        { itemType: 'nightly_rate', description: 'Night 1', quantity: 1, unitAmount: 500, totalAmount: 500, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'nightly_rate', description: 'Night 2', quantity: 1, unitAmount: 500, totalAmount: 500, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'discount', description: 'Promo', quantity: 1, unitAmount: -200, totalAmount: -200, payer: 'guest', priceSource: 'manual' },
        { itemType: 'service_charge', description: 'Service 10%', quantity: 1, unitAmount: 100, totalAmount: 100, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'tax', description: 'VAT 14%', quantity: 1, unitAmount: 140, totalAmount: 140, payer: 'guest', priceSource: 'default_room_type_rate' },
      ],
    }

    const totals = calculateTotals(breakdown)
    expect(totals.discounts).toBe(200)
    expect(totals.total).toBe(1040)
  })

  it('handles fees (extras) correctly', () => {
    const breakdown: PriceBreakdown = {
      nightlyRate: 500,
      nights: 1,
      roomCharges: 500,
      taxes: 70,
      serviceCharges: 50,
      discounts: 0,
      fees: 300,
      total: 920,
      currency: 'EGP',
      items: [
        { itemType: 'nightly_rate', description: 'Night 1', quantity: 1, unitAmount: 500, totalAmount: 500, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'service_charge', description: 'Service', quantity: 1, unitAmount: 50, totalAmount: 50, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'tax', description: 'VAT', quantity: 1, unitAmount: 70, totalAmount: 70, payer: 'guest', priceSource: 'default_room_type_rate' },
        { itemType: 'extra_service', description: 'Extra Bed', quantity: 1, unitAmount: 300, totalAmount: 300, payer: 'guest', priceSource: 'manual' },
      ],
    }

    const totals = calculateTotals(breakdown)
    expect(totals.fees).toBe(300)
    expect(totals.total).toBe(920)
  })

  it('returns zero totals for empty items', () => {
    const breakdown: PriceBreakdown = {
      nightlyRate: 0,
      nights: 0,
      roomCharges: 0,
      taxes: 0,
      serviceCharges: 0,
      discounts: 0,
      fees: 0,
      total: 0,
      currency: 'EGP',
      items: [],
    }

    const totals = calculateTotals(breakdown)
    expect(totals.total).toBe(0)
    expect(totals.roomCharges).toBe(0)
  })
})

// ─── Database-backed pricing (Prisma mocked) ───────────────────────────

vi.mock('@/services/db/prisma', async () => {
  const { createPrismaMock } = await import('@/test/prismaMock')
  const prisma = createPrismaMock()
  return { prisma, withActor: (_id: string, fn: (tx: unknown) => unknown) => fn(prisma) }
})

async function prismaMock() {
  const { prisma } = await import('@/services/db/prisma')
  return prisma as unknown as ReturnType<typeof createPrismaMock>
}

const day = (value: string) => new Date(`${value}T00:00:00.000Z`)
const pricingRow = (row: { price?: number | null; price_single?: number | null; price_double?: number | null; price_triple?: number | null }) => ({
  price: row.price ?? 0,
  price_single: row.price_single ?? null,
  price_double: row.price_double ?? null,
  price_triple: row.price_triple ?? null,
})

beforeEach(() => {
  resetPrismaMock()
})

describe('getEffectiveRate', () => {
  it('uses the occupancy price of the in-window pricing row', async () => {
    const prisma = await prismaMock()
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })
    prisma.room_type_pricing.findFirst.mockResolvedValueOnce(pricingRow({ price_double: 7000, price_triple: 9000 }))

    const result = await getEffectiveRate('room-1', '2026-09-01', '2026-09-03', null, 'D')
    expect(result.rate).toBe(7000)
  })

  it('falls back to the latest pricing row when the stay is outside every window', async () => {
    const prisma = await prismaMock()
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })
    prisma.room_type_pricing.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pricingRow({ price: 6000 }))

    const result = await getEffectiveRate('room-1', '2026-09-23', '2026-10-22', null, 'D')
    expect(result.rate).toBe(6000)
  })

  it('returns 0 only when the room type has no pricing rows at all', async () => {
    const prisma = await prismaMock()
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })

    const result = await getEffectiveRate('room-1', '2026-09-23', '2026-10-22', null, 'D')
    expect(result.rate).toBe(0)
  })

  it('falls back when the in-window row has no price for the occupancy', async () => {
    const prisma = await prismaMock()
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })
    prisma.room_type_pricing.findFirst
      .mockResolvedValueOnce(pricingRow({ price_single: 5000, price_double: 7000 }))
      .mockResolvedValueOnce(pricingRow({ price: 8000 }))

    const result = await getEffectiveRate('room-1', '2026-09-01', '2026-09-03', null, 'T')
    expect(result.rate).toBe(8000)
  })

  it('prefers a company price override', async () => {
    const prisma = await prismaMock()
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })
    prisma.room_types.findUnique.mockResolvedValue({ slug: 'cedra' })
    prisma.company_price_overrides.findFirst.mockResolvedValue({ price: 4000 })

    const result = await getEffectiveRate('room-1', '2026-09-01', '2026-09-03', 'contact-co', 'D')
    expect(result).toMatchObject({ rate: 4000, source: 'company_override' })
    expect(prisma.room_type_pricing.findFirst).not.toHaveBeenCalled()
  })
})

describe('calculatePricing', () => {
  const STAY = { check_in_date: day('2026-09-01'), check_out_date: day('2026-09-03') }

  it('keeps the stored rate for manual_override rooms without re-pricing', async () => {
    const prisma = await prismaMock()
    prisma.reservations.findUnique.mockResolvedValue(STAY)
    prisma.reservation_rooms.findMany.mockResolvedValue([
      { id: 'rr-1', room_id: 'room-1', rate_per_night: 2000, occupancy_code: 'S', price_source: 'manual_override' },
    ])

    const breakdown = await calculatePricing('res-1')

    const nightly = breakdown.items.filter((i) => i.itemType === 'nightly_rate')
    expect(nightly).toHaveLength(1)
    expect(nightly[0]).toMatchObject({ unitAmount: 2000, priceSource: 'manual_override' })
    expect(prisma.rooms.findUnique).not.toHaveBeenCalled()
    expect(breakdown.roomRates).toEqual([{ reservationRoomId: 'rr-1', ratePerNight: 2000, totalAmount: 4000 }])
  })

  it('re-prices standard rows from the seasonal window and stores the new rate', async () => {
    const prisma = await prismaMock()
    prisma.reservations.findUnique.mockResolvedValue(STAY)
    prisma.reservation_rooms.findMany.mockResolvedValue([
      { id: 'rr-2', room_id: 'room-2', rate_per_night: 1000, occupancy_code: 'D', price_source: 'default_room_type_rate' },
    ])
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })
    prisma.room_type_pricing.findFirst.mockResolvedValueOnce(pricingRow({ price_double: 7000 }))

    const breakdown = await calculatePricing('res-1')

    const nightly = breakdown.items.filter((i) => i.itemType === 'nightly_rate')
    expect(nightly[0]).toMatchObject({ unitAmount: 7000, priceSource: 'seasonal_rate' })
    expect(prisma.reservation_rooms.update).toHaveBeenCalledWith({ where: { id: 'rr-2' }, data: { rate_per_night: 7000 } })
  })

  it('reports correct individual totals for mixed-rate rooms and uses company context', async () => {
    const prisma = await prismaMock()
    prisma.reservations.findUnique.mockResolvedValue(STAY)
    prisma.reservation_rooms.findMany.mockResolvedValue([
      { id: 'rr-a', room_id: 'room-a', rate_per_night: 2000, occupancy_code: 'S', price_source: 'manual_override' },
      { id: 'rr-b', room_id: 'room-b', rate_per_night: 5000, occupancy_code: 'D', price_source: 'default_room_type_rate' },
    ])
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })
    prisma.room_types.findUnique.mockResolvedValue({ slug: 'cedra' })
    prisma.company_price_overrides.findFirst.mockResolvedValue({ price: 4000 })

    const breakdown = await calculatePricing('res-1', 'contact-co')

    const nightly = breakdown.items.filter((i) => i.itemType === 'nightly_rate')
    expect(nightly[0]).toMatchObject({ unitAmount: 2000, priceSource: 'manual_override' })
    expect(nightly[1]).toMatchObject({ unitAmount: 4000, priceSource: 'company_override' })
    expect(breakdown.roomRates).toEqual([
      { reservationRoomId: 'rr-a', ratePerNight: 2000, totalAmount: 4000 },
      { reservationRoomId: 'rr-b', ratePerNight: 4000, totalAmount: 8000 },
    ])
  })
})

describe('applyRoomPriceOverride', () => {
  const ROOM_ROW = { id: 'rr-1', room_id: 'room-1', rate_per_night: 1000, nights: 2, occupancy_code: 'S', check_in_date: day('2026-09-01') }
  const RESERVATION_ROW = { check_in_date: day('2026-09-01'), check_out_date: day('2026-09-03'), company_id: null }
  const base = { reservationId: 'res-1', reservationRoomId: 'rr-1', actorId: 'user-1', actorRole: 'front_desk' as const }

  it('sets a manual override, updates totals, and writes an audit row', async () => {
    const prisma = await prismaMock()
    prisma.reservation_rooms.findFirst.mockResolvedValue(ROOM_ROW)
    prisma.reservations.findUnique.mockResolvedValue(RESERVATION_ROW)

    const result = await applyRoomPriceOverride({ ...base, ratePerNight: 2000, reason: 'VIP' })

    expect(result).toMatchObject({ ok: true, oldRate: 1000, newRate: 2000, priceSource: 'manual_override', companyId: null })
    expect(prisma.reservation_rooms.update).toHaveBeenCalledWith({
      where: { id: 'rr-1' },
      data: expect.objectContaining({ rate_per_night: 2000, price_source: 'manual_override', total_amount: 4000 }),
    })
    expect(prisma.price_override_audit_log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ old_rate: 1000, new_rate: 2000, reason: 'VIP', actor_id: 'user-1', permission_level: 'front_desk' }),
    })
  })

  it('reset recomputes the seasonal standard rate and source', async () => {
    const prisma = await prismaMock()
    prisma.reservation_rooms.findFirst.mockResolvedValue(ROOM_ROW)
    prisma.reservations.findUnique.mockResolvedValue(RESERVATION_ROW)
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })
    prisma.room_type_pricing.findFirst.mockResolvedValueOnce(pricingRow({ price_single: 900 }))

    const result = await applyRoomPriceOverride({ ...base, ratePerNight: null })
    expect(result).toMatchObject({ ok: true, oldRate: 1000, newRate: 900, priceSource: 'seasonal_rate' })
  })

  it('returns RESET_NO_RATE when no standard rate resolves', async () => {
    const prisma = await prismaMock()
    prisma.reservation_rooms.findFirst.mockResolvedValue(ROOM_ROW)
    prisma.reservations.findUnique.mockResolvedValue(RESERVATION_ROW)
    prisma.rooms.findUnique.mockResolvedValue({ price: 0, room_type_id: 'rt-1' })

    const result = await applyRoomPriceOverride({ ...base, ratePerNight: null })
    expect(result).toMatchObject({ ok: false, code: 'RESET_NO_RATE' })
    expect(prisma.reservation_rooms.update).not.toHaveBeenCalled()
    expect(prisma.price_override_audit_log.create).not.toHaveBeenCalled()
  })

  it('returns NOT_FOUND when the room line does not exist', async () => {
    const result = await applyRoomPriceOverride({ ...base, reservationRoomId: 'missing', ratePerNight: 100 })
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })
})
