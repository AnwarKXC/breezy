import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import type { price_source } from '@/generated/prisma/enums'
import { resolveRoomRate } from '@/generated/prisma/sql'
import { prisma } from '@/services/db/prisma'
import { dbDate } from '@/services/db/rows'
import { logAction } from '@/services/logs'
import { LOG_ACTIONS, LOG_MODULES } from '@/types/logs'
import { ROLES, type UserRole } from '@/config/roles'

// price_override_audit_log.permission_level has a DB check constraint allowing
// only 'admin' | 'front_desk' (see specs/009-pricing-company-billing/data-model.md).
// Accountants carry admin-equivalent reservation permissions (see AGENTS.md), so
// they map to 'admin'; every other role maps to the more restrictive 'front_desk'.
export function auditPermissionLevel(role: UserRole): 'admin' | 'front_desk' {
  return role === ROLES.ADMIN || role === ROLES.ACCOUNTANT ? 'admin' : 'front_desk'
}

export interface PriceBreakdown {
  nightlyRate: number
  nights: number
  roomCharges: number
  taxes: number
  serviceCharges: number
  discounts: number
  fees: number
  total: number
  currency: string
  items: Array<{
    itemType: string
    description: string
    quantity: number
    unitAmount: number
    totalAmount: number
    payer: string
    priceSource: string
    reservationRoomId?: string | null
    roomId?: string | null
  }>
  roomRates?: Array<{ reservationRoomId: string; ratePerNight: number; totalAmount: number }>
}

function reservationPriceSource(value: string): price_source {
  if (value === 'company_override') return 'company_override'
  if (value === 'seasonal' || value === 'seasonal_rate') return 'seasonal_rate'
  if (value === 'room_specific_rate') return 'room_specific_rate'
  if (value === 'manual_override') return 'manual_override'
  return 'default_room_type_rate'
}

// reservation_pricing_items.source_type has its own CHECK constraint whose
// allowed values differ from the price_source enum: it spells the default case
// 'default_rate', not 'default_room_type_rate'. Writing anything else (the old
// code wrote the payer, 'guest') makes every insert fail, which silently left
// the pricing snapshot empty and the invoice stuck on stale amounts.
type PricingSourceType = 'default_rate' | 'seasonal_rate' | 'room_specific_rate' | 'company_override' | 'manual_override'
function pricingSourceType(value: string): PricingSourceType {
  if (value === 'company_override') return 'company_override'
  if (value === 'seasonal' || value === 'seasonal_rate') return 'seasonal_rate'
  if (value === 'room_specific_rate') return 'room_specific_rate'
  if (value === 'manual_override') return 'manual_override'
  return 'default_rate'
}

export async function getEffectiveRate(
  roomId: string,
  checkIn: string,
  checkOut: string,
  contactId: string | null | undefined,
  occupancyCode: 'S' | 'D' | 'T' | null | undefined,
  currency: string,
): Promise<{ rate: number; currency: string; source: string }> {
  // Same hierarchy as reservation creation and availability: public.resolve_room_rate,
  // limited to rate rows in the reservation's currency (amounts are never converted).
  const [row] = await prisma.$queryRawTyped(
    resolveRoomRate(roomId, checkIn.slice(0, 10), checkOut.slice(0, 10), contactId ?? null, occupancyCode ?? null, currency),
  )
  return {
    rate: row?.rate == null ? 0 : Number(row.rate),
    currency,
    source: row?.source ?? 'default_room_type_rate',
  }
}

export function buildPricingItems(params: {
  nightlyRate: number
  nights: number
  checkIn: string
  checkOut: string
  roomNumber: string
  roomTypeName: string
  serviceChargePercent: number
  taxPercent: number
  currency: string
}): PriceBreakdown['items'] {
  const { nightlyRate, nights, checkIn, roomNumber, roomTypeName, serviceChargePercent, taxPercent } = params

  if (nightlyRate <= 0) throw new Error('Nightly rate must be positive')
  if (nights <= 0) throw new Error('Nights must be positive')

  const items: PriceBreakdown['items'] = []
  const checkInDate = new Date(checkIn)
  let roomCharges = 0

  for (let i = 0; i < nights; i++) {
    const date = new Date(checkInDate)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().slice(0, 10)
    items.push({
      itemType: 'nightly_rate',
      description: `${roomTypeName} - ${dateStr}${roomNumber ? ` (Room ${roomNumber})` : ''}`,
      quantity: 1,
      unitAmount: nightlyRate,
      totalAmount: nightlyRate,
      payer: 'guest',
      priceSource: 'default_room_type_rate',
    })
    roomCharges += nightlyRate
  }

  const serviceCharges = Math.round(roomCharges * (serviceChargePercent / 100) * 100) / 100
  const taxes = Math.round((roomCharges + serviceCharges) * (taxPercent / 100) * 100) / 100

  if (serviceCharges > 0) {
    items.push({
      itemType: 'service_charge',
      description: `Service charge (${serviceChargePercent}%)`,
      quantity: 1,
      unitAmount: serviceCharges,
      totalAmount: serviceCharges,
      payer: 'guest',
      priceSource: 'default_room_type_rate',
    })
  }

  if (taxes > 0) {
    items.push({
      itemType: 'tax',
      description: `VAT (${taxPercent}%)`,
      quantity: 1,
      unitAmount: taxes,
      totalAmount: taxes,
      payer: 'guest',
      priceSource: 'default_room_type_rate',
    })
  }

  return items
}

export function calculateTotals(breakdown: PriceBreakdown): {
  roomCharges: number
  serviceCharges: number
  taxes: number
  discounts: number
  fees: number
  total: number
} {
  const roomCharges = breakdown.items
    .filter((i) => i.itemType === 'nightly_rate')
    .reduce((sum, i) => sum + i.totalAmount, 0)
  const discounts = breakdown.items
    .filter((i) => i.itemType === 'discount')
    .reduce((sum, i) => sum + Math.abs(i.totalAmount), 0)
  const fees = breakdown.items
    .filter((i) => i.itemType === 'extra_service' || i.itemType === 'cancellation_fee' || i.itemType === 'damage_fee')
    .reduce((sum, i) => sum + i.totalAmount, 0)
  const serviceCharges = breakdown.items
    .filter((i) => i.itemType === 'service_charge')
    .reduce((sum, i) => sum + i.totalAmount, 0)
  const taxes = breakdown.items
    .filter((i) => i.itemType === 'tax')
    .reduce((sum, i) => sum + i.totalAmount, 0)

  const itemTotal = breakdown.items.reduce((sum, i) => sum + i.totalAmount, 0)
  // If the breakdown has explicit totals, trust them; otherwise compute from items
  const total = breakdown.total !== 0 ? breakdown.total : itemTotal

  return { roomCharges, serviceCharges, taxes, discounts, fees, total }
}

export async function calculatePricing(
  reservationId: string,
  contactId?: string | null,
): Promise<PriceBreakdown> {
  // Every input is independent: fetch in one parallel round trip.
  const [reservationRow, rooms, settings] = await Promise.all([
    prisma.reservations.findUnique({
      where: { id: reservationId },
      select: { check_in_date: true, check_out_date: true, currency: true },
    }),
    prisma.reservation_rooms.findMany({
      where: { reservation_id: reservationId, deleted_at: null, status: { not: 'cancelled' } },
      select: { id: true, room_id: true, rate_per_night: true, occupancy_code: true, price_source: true },
    }),
    prisma.accounting_settings.findMany({
      where: { key: { in: ['service_charge_rate', 'vat_rate'] } },
      select: { key: true, value: true },
    }),
  ])

  if (!reservationRow) throw new Error('Reservation not found')
  const reservation = {
    check_in_date: reservationRow.check_in_date.toISOString().slice(0, 10),
    check_out_date: reservationRow.check_out_date.toISOString().slice(0, 10),
  }

  const checkIn = new Date(reservation.check_in_date)
  const checkOut = new Date(reservation.check_out_date)
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)))

  const currency = reservationRow.currency
  const items: PriceBreakdown['items'] = []
  const roomRates: NonNullable<PriceBreakdown['roomRates']> = []
  let roomCharges = 0

  // Resolve every room's rate concurrently instead of one room at a time.
  const effectiveRates = await Promise.all(
    rooms.map((room) =>
      room.price_source !== 'manual_override' && room.room_id
        ? getEffectiveRate(room.room_id, reservation.check_in_date, reservation.check_out_date, contactId, room.occupancy_code as 'S' | 'D' | 'T' | null, currency)
        : null,
    ),
  )
  const rateUpdates: Promise<unknown>[] = []

  rooms.forEach((room, index) => {
    let rate = Number(room.rate_per_night)
    let priceSource = 'default_room_type_rate'
    const effective = effectiveRates[index]
    if (room.price_source === 'manual_override') {
      // Staff pinned this room's rate for this booking; never auto-re-price it.
      priceSource = 'manual_override'
    } else if (effective) {
      // Never replace an existing rate with 0: when no price resolves (room
      // has no pricing row at all), keep the stored rate instead of zeroing
      // the reservation on every edit.
      rate = effective.rate > 0 ? effective.rate : rate
      priceSource = effective.rate > 0 ? effective.source : rate > 0 ? 'default_room_type_rate' : 'missing'

      if (rate !== Number(room.rate_per_night)) {
        rateUpdates.push(prisma.reservation_rooms.update({ where: { id: room.id }, data: { rate_per_night: rate } }))
      }
    }

    const roomTotal = rate * nights
    roomCharges += roomTotal
    roomRates.push({ reservationRoomId: room.id, ratePerNight: rate, totalAmount: roomTotal })

    items.push({
      itemType: 'nightly_rate',
      description: `Room charge: ${rate} x ${nights} nights`,
      quantity: nights,
      unitAmount: rate,
      totalAmount: roomTotal,
      payer: 'guest',
      priceSource,
      reservationRoomId: room.id,
      roomId: room.room_id,
    })
  })
  await Promise.all(rateUpdates)

  const settingsMap = new Map(settings.map((s) => [s.key, s.value as { rate?: number }]))
  const serviceChargePercent = (settingsMap.get('service_charge_rate')?.rate ?? 10)
  const taxPercent = (settingsMap.get('vat_rate')?.rate ?? 14)
  const serviceChargeRate = serviceChargePercent / 100
  const taxRate = taxPercent / 100
  const serviceCharges = Math.round(roomCharges * serviceChargeRate * 100) / 100
  const taxes = Math.round((roomCharges + serviceCharges) * taxRate * 100) / 100
  const total = roomCharges + serviceCharges + taxes

  if (serviceCharges > 0) {
    items.push({
      itemType: 'service_charge',
      description: `Service charge (${serviceChargePercent}%)`,
      quantity: 1,
      unitAmount: serviceCharges,
      totalAmount: serviceCharges,
      payer: 'guest',
      priceSource: 'default_room_type_rate',
    })
  }

  if (taxes > 0) {
    items.push({
      itemType: 'tax',
      description: `VAT (${taxPercent}%)`,
      quantity: 1,
      unitAmount: taxes,
      totalAmount: taxes,
      payer: 'guest',
      priceSource: 'default_room_type_rate',
    })
  }

  return { nightlyRate: roomCharges / Math.max(nights, 1), nights, roomCharges, taxes, serviceCharges, discounts: 0, fees: 0, total, currency, items, roomRates }
}

export async function applyManualPriceOverride(
  reservationId: string,
  oldTotal: number,
  newTotal: number,
  reason: string,
  actorId: string,
  actorRole: UserRole,
  approvalId?: string,
) {
  const delta = newTotal - oldTotal

  const roomForAudit = await prisma.reservation_rooms.findFirst({
    where: { reservation_id: reservationId, deleted_at: null },
    select: { room_id: true, check_in_date: true },
  })

  if (roomForAudit?.room_id) {
    await prisma.price_override_audit_log.create({
      data: {
        reservation_id: reservationId,
        room_id: roomForAudit.room_id,
        night_date: roomForAudit.check_in_date,
        old_rate: oldTotal,
        new_rate: newTotal,
        reason,
        actor_id: actorId,
        permission_level: approvalId ? 'admin' : auditPermissionLevel(actorRole),
        threshold_checked: true,
      },
    })
  }

  if (delta !== 0) {
    const current = await prisma.reservations.findUnique({ where: { id: reservationId }, select: { paid_amount: true } })
    const paidAmount = Number(current?.paid_amount ?? 0)
    await prisma.reservations.update({
      where: { id: reservationId },
      data: { total_amount: newTotal, balance_amount: newTotal - paidAmount },
    })
  }

  await logAction({
    action: LOG_ACTIONS.RESERVATION_PRICE_OVERRIDE as never,
    description: `Price override on reservation ${reservationId}: ${oldTotal} -> ${newTotal}`,
    entityId: reservationId,
    entityType: 'reservation',
    metadata: { oldTotal, newTotal, delta, reason, approvalId } as never,
    module: LOG_MODULES.RESERVATIONS,
    target: { id: reservationId },
  })

  return { delta, oldTotal, newTotal }
}

export async function snapshotPricing(reservationId: string, contactId?: string | null) {
  const breakdown = await calculatePricing(reservationId, contactId)

  // Rebuild the snapshot, reservation totals and per-room totals atomically:
  // these rows are the source of truth every invoice is rebuilt from.
  await prisma.$transaction(async (tx) => {
    // Keep manually-added extra charges ('extra' rows come from the Extra
    // Charge modal, calculatePricing never produces them).
    await tx.reservation_pricing_items.deleteMany({
      where: { reservation_id: reservationId, pricing_level: { not: 'extra' } },
    })

    const rows: Prisma.reservation_pricing_itemsCreateManyInput[] = breakdown.items.map((item) => ({
      reservation_id: reservationId,
      reservation_room_id: item.reservationRoomId ?? null,
      room_id: item.roomId ?? null,
      pricing_level: item.itemType,
      quantity: item.quantity,
      nights: item.itemType === 'nightly_rate' ? Math.max(1, item.quantity) : 1,
      base_rate: item.unitAmount,
      applied_rate: item.unitAmount,
      total_amount: item.totalAmount,
      service_amount: item.itemType === 'service_charge' ? item.totalAmount : 0,
      tax_amount: item.itemType === 'tax' ? item.totalAmount : 0,
      discount_amount: item.itemType === 'discount' ? Math.abs(item.totalAmount) : 0,
      source_type: pricingSourceType(item.priceSource),
      price_source: reservationPriceSource(item.priceSource),
      currency: breakdown.currency,
    }))
    if (rows.length > 0) await tx.reservation_pricing_items.createMany({ data: rows })

    const current = await tx.reservations.findUnique({ where: { id: reservationId }, select: { paid_amount: true } })
    const paidAmount = Number(current?.paid_amount ?? 0)

    // calculatePricing does not know about preserved extra charges; fold them
    // back into the totals so overrides/room changes never drop them.
    const extras = await tx.reservation_pricing_items.aggregate({
      where: { reservation_id: reservationId, pricing_level: 'extra' },
      _sum: { total_amount: true },
    })
    const extraTotal = Number(extras._sum.total_amount ?? 0)
    const grandTotal = breakdown.total + extraTotal

    await tx.reservations.update({
      where: { id: reservationId },
      data: {
        subtotal_amount: breakdown.roomCharges + extraTotal,
        service_amount: breakdown.serviceCharges,
        tax_amount: breakdown.taxes,
        discount_amount: breakdown.discounts,
        total_amount: grandTotal,
        balance_amount: grandTotal - paidAmount,
        currency: breakdown.currency,
      },
    })

    // Per-room totals from each room's own rate.
    for (const rr of breakdown.roomRates ?? []) {
      await tx.reservation_rooms.update({
        where: { id: rr.reservationRoomId },
        data: { subtotal_amount: rr.totalAmount, total_amount: rr.totalAmount },
      })
    }
  })

  return breakdown
}

// Keeps any open invoice linked to a reservation in sync with its current
// room rates, stay dates, and extra charges. Room/extend/price-override/extra
// charge actions all mutate reservation state directly; without this, an
// invoice generated before the mutation (e.g. the draft created at booking
// time) keeps stale amounts and stay dates until checkout regenerates it.
// 'paid' is included: a fully-paid invoice can still predate a later
// extension, and must drop back to 'partially_paid' once its balance is no
// longer fully covered. Void/cancelled invoices are left untouched.
export async function syncOpenInvoicesForReservation(reservationId: string): Promise<void> {
  const linked = await prisma.invoices.findMany({
    where: {
      reservation_id: reservationId,
      status: { in: ['draft', 'issued', 'partially_paid', 'overdue', 'paid'] },
      deleted_at: null,
    },
    select: { id: true, paid_amount: true, status: true },
    take: 20,
  })

  if (!linked.length) return

  const invoiceIds = linked.map((inv) => inv.id)

  const [rooms, pricingItems] = await Promise.all([
    prisma.reservation_rooms.findMany({
      where: { reservation_id: reservationId, deleted_at: null, status: { not: 'cancelled' } },
      select: { rate_per_night: true, nights: true, check_in_date: true, check_out_date: true, rooms: { select: { number: true } } },
    }),
    prisma.reservation_pricing_items.findMany({
      where: { reservation_id: reservationId },
      select: { pricing_level: true, total_amount: true, service_amount: true, tax_amount: true, manual_override_reason: true },
    }),
  ])

  const extraCharges = pricingItems.filter((p) => p.pricing_level === 'extra')
  const extraTotal = extraCharges.reduce((sum, p) => sum + Number(p.total_amount ?? 0), 0)
  const serviceCharge = pricingItems
    .filter((p) => p.pricing_level === 'service_charge')
    .reduce((sum, p) => sum + Number(p.service_amount ?? p.total_amount ?? 0), 0)
  const taxAmount = pricingItems
    .filter((p) => p.pricing_level === 'tax')
    .reduce((sum, p) => sum + Number(p.tax_amount ?? p.total_amount ?? 0), 0)

  const roomCharges = rooms.reduce(
    (sum, r) => sum + Number(r.rate_per_night ?? 0) * Math.max(1, Number(r.nights ?? 1)),
    0,
  )
  const subtotal = roomCharges + extraTotal
  const amount = subtotal + serviceCharge + taxAmount

  const day = (d: Date) => d.toISOString().slice(0, 10)
  const checkInDates = rooms.map((r) => day(r.check_in_date))
  const checkOutDates = rooms.map((r) => day(r.check_out_date))
  const stayCheckIn = checkInDates.length > 0 ? checkInDates.reduce((min, d) => (d < min ? d : min)) : undefined
  const stayCheckOut = checkOutDates.length > 0 ? checkOutDates.reduce((max, d) => (d > max ? d : max)) : undefined

  const items: Prisma.invoice_itemsCreateManyInput[] = []
  for (const r of rooms) {
    const roomNumber = r.rooms?.number ?? ''
    const nights = Math.max(1, Number(r.nights ?? 1))
    const rate = Number(r.rate_per_night ?? 0)
    const description = roomNumber
      ? `Room ${roomNumber} - ${day(r.check_in_date)} to ${day(r.check_out_date)}`
      : 'Room charge'
    for (const invoiceId of invoiceIds) {
      items.push({
        invoice_id: invoiceId,
        type: 'room_charge',
        description,
        quantity: nights,
        unit_price: rate,
        discount_amount: 0,
        tax_amount: 0,
        total_price: Math.round(rate * nights * 100) / 100,
        sort_order: 0,
      })
    }
  }
  extraCharges.forEach((charge, index) => {
    const chargeAmount = Number(charge.total_amount ?? 0)
    for (const invoiceId of invoiceIds) {
      items.push({
        invoice_id: invoiceId,
        type: 'extra_service',
        description: charge.manual_override_reason ?? 'Extra charge',
        quantity: 1,
        unit_price: chargeAmount,
        discount_amount: 0,
        tax_amount: 0,
        total_price: chargeAmount,
        sort_order: 1 + index,
      })
    }
  })

  await prisma.$transaction(async (tx) => {
    await tx.invoice_items.deleteMany({ where: { invoice_id: { in: invoiceIds }, type: { in: ['room_charge', 'extra_service'] } } })
    if (items.length > 0) await tx.invoice_items.createMany({ data: items })

    for (const inv of linked) {
      const paid = Number(inv.paid_amount ?? 0)
      const remaining = Math.max(0, amount - paid)
      const patch: Prisma.invoicesUpdateInput = { subtotal, service_charge: serviceCharge, tax_amount: taxAmount, amount, remaining_balance: remaining }
      if (stayCheckIn) patch.stay_check_in = dbDate(stayCheckIn)
      if (stayCheckOut) patch.stay_check_out = dbDate(stayCheckOut)
      // A previously fully-paid invoice whose total grew (e.g. a post-checkout
      // extend) is no longer fully covered — reflect that in status.
      if (inv.status === 'paid' && remaining > 0) patch.status = 'partially_paid'
      await tx.invoices.update({ where: { id: inv.id }, data: patch })
    }
  })
}

export async function applyRoomPriceOverride(params: {
  reservationId: string
  reservationRoomId: string
  ratePerNight: number | null
  reason?: string
  actorId: string
  actorRole: UserRole
}): Promise<
  | { ok: true; oldRate: number; newRate: number; priceSource: string; companyId: string | null }
  | { ok: false; code: 'NOT_FOUND' | 'RESET_NO_RATE' | 'DB_ERROR'; message: string }
> {
  const roomRow = await prisma.reservation_rooms.findFirst({
    where: { id: params.reservationRoomId, reservation_id: params.reservationId, deleted_at: null },
    select: { id: true, room_id: true, rate_per_night: true, nights: true, occupancy_code: true, check_in_date: true },
  })

  if (!roomRow || !roomRow.room_id) {
    return { ok: false, code: 'NOT_FOUND', message: 'Room not found in reservation' }
  }

  const reservation = await prisma.reservations.findUnique({
    where: { id: params.reservationId },
    select: { check_in_date: true, check_out_date: true, company_id: true, currency: true },
  })

  if (!reservation) {
    return { ok: false, code: 'NOT_FOUND', message: 'Reservation not found' }
  }

  const oldRate = Number(roomRow.rate_per_night)
  let newRate: number
  let priceSource: price_source

  if (params.ratePerNight != null) {
    newRate = params.ratePerNight
    priceSource = 'manual_override'
  } else {
    const effective = await getEffectiveRate(
      roomRow.room_id,
      reservation.check_in_date.toISOString().slice(0, 10),
      reservation.check_out_date.toISOString().slice(0, 10),
      reservation.company_id,
      roomRow.occupancy_code as 'S' | 'D' | 'T' | null,
      reservation.currency,
    )
    if (!(effective.rate > 0)) {
      return { ok: false, code: 'RESET_NO_RATE', message: 'No standard rate found for this room and dates' }
    }
    newRate = effective.rate
    priceSource = reservationPriceSource(effective.source)
  }

  try {
    await prisma.$transaction([
      prisma.reservation_rooms.update({
        where: { id: params.reservationRoomId },
        data: { rate_per_night: newRate, price_source: priceSource, total_amount: newRate * Number(roomRow.nights) },
      }),
      prisma.price_override_audit_log.create({
        data: {
          reservation_id: params.reservationId,
          room_id: roomRow.room_id,
          night_date: roomRow.check_in_date,
          old_rate: oldRate,
          new_rate: newRate,
          reason: params.reason?.trim() || (params.ratePerNight == null ? 'Reset to standard rate' : 'Manual price override'),
          actor_id: params.actorId,
          permission_level: auditPermissionLevel(params.actorRole),
          threshold_checked: true,
        },
      }),
    ])
  } catch (error) {
    return { ok: false, code: 'DB_ERROR', message: error instanceof Error ? error.message : 'Price update failed' }
  }

  return { ok: true, oldRate, newRate, priceSource, companyId: reservation.company_id }
}
