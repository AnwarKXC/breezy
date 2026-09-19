import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import type { Prisma } from '@/generated/prisma/client'
import type { occupancy_code } from '@/generated/prisma/enums'
import { prisma } from '@/services/db/prisma'
import { dbDate, serializeRow, toRow, toRows } from '@/services/db/rows'
import { isOverlapViolation } from '@/services/db/errors'
import { getRoomAvailability } from '@/services/db/rpc'
import { snapshotPricing, applyRoomPriceOverride } from '@/modules/reservations/services/pricingService'
import { ReservationUpdateSchema, zodErrorMessage } from '@/shared/validation'
import { getSystemCurrency } from '@/shared/currency/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function syncInvoiceAfterPricing(reservationId: string) {
  const invoice = await prisma.invoices.findFirst({
    where: { reservation_id: reservationId, deleted_at: null, status: { notIn: ['void', 'cancelled'] } },
    select: { id: true, status: true, paid_amount: true },
    orderBy: { created_at: 'asc' },
  })
  if (!invoice) return

  const pricingItems = await prisma.reservation_pricing_items.findMany({
    where: { reservation_id: reservationId },
    select: { pricing_level: true, total_amount: true },
  })
  const sumLevel = (level: string) =>
    pricingItems.filter((i) => i.pricing_level === level).reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0)
  const roomCharges = sumLevel('nightly_rate')
  const serviceCharge = sumLevel('service_charge')
  const taxAmount = sumLevel('tax')

  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    select: { total_amount: true, check_in_date: true, check_out_date: true },
  })

  const totalAmount = Number(reservation?.total_amount ?? 0)
  const alreadyPaid = Number(invoice.paid_amount ?? 0)
  const systemCurrency = await getSystemCurrency()

  const items = pricingItems.map((item, idx) => ({
    type: item.pricing_level === 'nightly_rate' ? 'room_charge'
      : item.pricing_level === 'service_charge' ? 'service_charge'
      : item.pricing_level === 'tax' ? 'tax' : 'other',
    description: item.pricing_level === 'nightly_rate'
      ? 'Room charge'
      : item.pricing_level === 'service_charge'
        ? 'Service charge (10%)'
        : item.pricing_level === 'tax'
          ? 'VAT (14%)'
          : item.pricing_level ?? 'Charge',
    quantity: 1,
    unit_price: Number(item.total_amount ?? 0),
    discount_amount: 0,
    tax_amount: item.pricing_level === 'tax' ? Number(item.total_amount ?? 0) : 0,
    total_price: Number(item.total_amount ?? 0),
    sort_order: idx,
  }))

  // Never leave the invoice with no lines: if the pricing snapshot is missing
  // for any reason, fall back to a single room charge for the whole total so the
  // printed invoice still adds up to what the reservation says.
  if (items.length === 0 && totalAmount > 0) {
    items.push({
      type: 'room_charge',
      description: 'Room charge',
      quantity: 1,
      unit_price: totalAmount,
      discount_amount: 0,
      tax_amount: 0,
      total_price: totalAmount,
      sort_order: 0,
    })
  }

  await prisma.$transaction([
    prisma.invoices.update({
      where: { id: invoice.id },
      data: {
        subtotal: roomCharges || totalAmount,
        tax_amount: taxAmount,
        service_charge: serviceCharge,
        amount: totalAmount,
        remaining_balance: Math.max(0, totalAmount - alreadyPaid),
        currency: systemCurrency,
        ...(reservation ? { stay_check_in: reservation.check_in_date, stay_check_out: reservation.check_out_date } : {}),
      },
    }),
    prisma.invoice_items.deleteMany({ where: { invoice_id: invoice.id } }),
    prisma.invoice_items.createMany({ data: items.map((i) => ({ ...i, invoice_id: invoice.id })) }),
  ])
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid reservation id' } }, { status: 400 })
    }

    const reservationRow = await prisma.reservations.findFirst({ where: { id, deleted_at: null } })
    if (!reservationRow) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    const reservation = toRow('reservations', reservationRow)

    const [roomRows, guestRows, companyInfoRow, pricingRows, noteRows, historyRows] = await Promise.all([
      prisma.reservation_rooms.findMany({
        where: { reservation_id: id, deleted_at: null },
        include: { rooms: { select: { number: true, capacity: true } }, room_types: { select: { name: true } } },
      }),
      prisma.reservation_guests.findMany({ where: { reservation_id: id, deleted_at: null } }),
      prisma.reservation_company_info.findFirst({ where: { reservation_id: id } }),
      prisma.reservation_pricing_items.findMany({ where: { reservation_id: id } }),
      prisma.reservation_notes.findMany({ where: { reservation_id: id } }),
      prisma.reservation_status_history.findMany({ where: { reservation_id: id }, orderBy: { changed_at: 'asc' } }),
    ])
    const rooms = roomRows.map((row) => {
      const { rooms: room, room_types: roomType, ...rest } = serializeRow('reservation_rooms', row)
      const roomInfo = room as { number: string; capacity: number } | null
      return { ...rest, room, room_type: roomType, room_number: roomInfo?.number ?? null, room_capacity: roomInfo?.capacity ?? null }
    })
    const guests = toRows('reservation_guests', guestRows)

    // Resolve the contact the reservation was booked under. company_id is only
    // set for company contacts, so individuals have to be found through the
    // primary guest's contact_id. Returned live so the UI can show the current
    // contact details instead of whatever text was snapshotted at booking time.
    const contactId =
      reservation.company_id ??
      guests.find((g) => g.is_primary)?.contact_id ??
      guests[0]?.contact_id ??
      null

    const contact = contactId
      ? await prisma.contacts.findFirst({
          where: { id: contactId, deleted_at: null },
          select: { id: true, name: true, type: true, phone: true, email: true },
        })
      : null

    return NextResponse.json({
      ok: true,
      data: {
        ...reservation,
        rooms,
        guests,
        companyInfo: companyInfoRow ? toRow('reservation_company_info', companyInfoRow) : null,
        contact: contact ?? null,
        pricingItems: toRows('reservation_pricing_items', pricingRows),
        notes: toRows('reservation_notes', noteRows),
        statusHistory: toRows('reservation_status_history', historyRows),
      },
    })
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_UPDATE_DRAFT, async (session) => {
    const { id } = await params
    const parsed = ReservationUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const input = parsed.data

    const existingRow = await prisma.reservations.findFirst({ where: { id, deleted_at: null } })
    if (!existingRow) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    const existing = toRow('reservations', existingRow)

    if (!['draft', 'held'].includes(existing.status)) {
      return NextResponse.json({ ok: false, error: { code: 'TERMINAL_STATUS', message: 'Cannot modify reservation in current status' } }, { status: 409 })
    }

    if (input.check_in_date !== undefined) {
      const today = new Date(new Date().toISOString().slice(0, 10))
      if (new Date(input.check_in_date) < today) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Check-in date cannot be in the past' } }, { status: 400 })
      }
    }

    const updateFields: Prisma.reservationsUpdateInput = {}
    if (input.check_in_date !== undefined) updateFields.check_in_date = dbDate(input.check_in_date)
    if (input.check_out_date !== undefined) updateFields.check_out_date = dbDate(input.check_out_date)
    if (input.booker_name !== undefined) updateFields.booker_name = input.booker_name
    if (input.booker_email !== undefined) updateFields.booker_email = input.booker_email
    if (input.booker_phone !== undefined) updateFields.booker_phone = input.booker_phone

    const roomOccupancies = (input.roomOccupancies ?? {}) as Record<string, 'S' | 'D' | 'T'>
    const roomOverrides = (input.roomOverrides ?? {}) as Record<string, number | null>

    // A failed room insert used to be swallowed, which left room_count saying
    // "2 rooms" while only one reservation_rooms row existed. Collect the
    // failures and report them once the rest of the edit has been applied.
    const addFailures: string[] = []
    // Anything that moves the money — rooms, occupancy, rates, stay length —
    // has to re-snapshot pricing and push the result onto the invoice.
    let needsPricingRecalc =
      (input.check_in_date !== undefined && input.check_in_date !== existing.check_in_date) ||
      (input.check_out_date !== undefined && input.check_out_date !== existing.check_out_date)

    if (Array.isArray(input.roomIds)) {
      const checkIn = input.check_in_date ?? existing.check_in_date
      const checkOut = input.check_out_date ?? existing.check_out_date
      const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))

      const currentReservationRooms = await prisma.reservation_rooms.findMany({
        where: { reservation_id: id, deleted_at: null },
        select: { id: true, room_id: true, rate_per_night: true, price_source: true },
      })

      const currentRoomIds = new Set(currentReservationRooms.map((r) => r.room_id))
      const newRoomIdsSet = new Set(input.roomIds as string[])
      const toRemove = currentReservationRooms.filter((r) => !newRoomIdsSet.has(r.room_id))
      const toAdd = input.roomIds.filter((rid: string) => !currentRoomIds.has(rid)) as string[]

      if (toAdd.length > 0) {
        const availableRooms = await getRoomAvailability({ checkIn, checkOut, excludeReservationId: id })
        // get_room_availability returns every room and marks each one
        // available/unavailable — it does NOT filter. Taking the whole result
        // as "available" let booked rooms through this guard and the insert
        // then died on the reservation_rooms_no_overlap exclusion constraint.
        const availableRoomIds = new Set(
          availableRooms
            .filter((r) => r.status === 'available')
            .map((r) => r.room_id),
        )
        const invalid = toAdd.filter((rid: string) => !availableRoomIds.has(rid))
        if (invalid.length > 0) {
          return NextResponse.json({ ok: false, error: { code: 'ROOM_UNAVAILABLE', message: `Rooms not available: ${invalid.join(', ')}` } }, { status: 409 })
        }
      }

      const primaryGuest = await prisma.reservation_guests.findFirst({ where: { reservation_id: id } })

      for (const rr of toRemove) {
        try {
          await prisma.$transaction([
            prisma.reservation_guests.deleteMany({ where: { reservation_room_id: rr.id } }),
            prisma.reservation_rooms.update({ where: { id: rr.id }, data: { deleted_at: new Date() } }),
            prisma.room_status_history.create({
              data: {
                room_id: rr.room_id,
                from_status: 'reserved',
                to_status: 'available',
                reason: 'Room removed during reservation edit',
                reservation_id: id,
                changed_by: session.id,
              },
            }),
          ])
        } catch (error) {
          return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: `Failed to remove room: ${error instanceof Error ? error.message : 'unknown error'}` } }, { status: 400 })
        }
      }

      let addedCount = 0

      for (const roomId of toAdd) {
        const roomData = await prisma.rooms.findUnique({ where: { id: roomId }, select: { number: true, room_type_id: true, price: true, capacity: true } })
        if (!roomData) {
          addFailures.push(`${roomId}: room not found`)
          continue
        }
        const occ = roomOccupancies[roomId] ?? (roomData.capacity >= 3 ? 'T' : roomData.capacity === 2 ? 'D' : 'S')
        const override = roomOverrides[roomId]
        const rate = override != null ? override : Number(roomData.price)

        try {
          await prisma.$transaction(async (tx) => {
            const newRoom = await tx.reservation_rooms.create({
              data: {
                reservation_id: id,
                room_id: roomId,
                room_type_id: roomData.room_type_id,
                status: 'reserved',
                occupancy_code: occ as occupancy_code,
                rate_per_night: rate,
                ...(override != null ? { price_source: 'manual_override' as const } : {}),
                nights,
                total_amount: rate * nights,
                check_in_date: dbDate(checkIn),
                check_out_date: dbDate(checkOut),
              },
              select: { id: true },
            })

            if (primaryGuest) {
              await tx.reservation_guests.create({
                data: {
                  reservation_id: id,
                  reservation_room_id: newRoom.id,
                  assigned_room_id: roomId,
                  full_name: primaryGuest.full_name,
                  role: primaryGuest.role,
                  is_primary: false,
                  guest_id: primaryGuest.guest_id,
                },
              })
            }

            await tx.room_status_history.create({
              data: {
                room_id: roomId,
                from_status: 'available',
                to_status: 'reserved',
                reason: 'Room added during reservation edit',
                reservation_id: id,
                changed_by: session.id,
              },
            })
          })
          addedCount += 1
        } catch (error) {
          addFailures.push(
            isOverlapViolation(error)
              ? `Room ${roomData.number} is already booked for these dates`
              : `Room ${roomData.number}: ${error instanceof Error ? error.message : 'insert failed'}`,
          )
        }
      }

      // Update occupancy codes for existing rooms
      let occupancyChanged = false
      for (const [roomId, code] of Object.entries(roomOccupancies)) {
        if (!currentRoomIds.has(roomId)) continue
        const { count } = await prisma.reservation_rooms.updateMany({
          where: { reservation_id: id, room_id: roomId, deleted_at: null },
          data: { occupancy_code: code as occupancy_code },
        })
        if (count > 0) occupancyChanged = true
      }

      // Apply price overrides on already-selected rooms (new rooms got theirs at insert time above).
      let overridesChanged = false
      const overrideErrors: string[] = []
      for (const [roomId, rate] of Object.entries(roomOverrides)) {
        const reservationRoom = currentReservationRooms.find((r) => r.room_id === roomId)
        if (!reservationRoom) continue
        // Skip when this is a no-op (same rate/source already stored) so resaving
        // the form doesn't spam price_override_audit_log on every unrelated edit.
        const currentlyManual = reservationRoom.price_source === 'manual_override'
        const unchanged = rate == null
          ? !currentlyManual
          : currentlyManual && Number(reservationRoom.rate_per_night) === rate
        if (unchanged) continue

        const result = await applyRoomPriceOverride({
          reservationId: id,
          reservationRoomId: reservationRoom.id,
          ratePerNight: rate,
          actorId: session.id,
          actorRole: session.role,
        })
        if (result.ok) overridesChanged = true
        else overrideErrors.push(`${roomId}: ${result.message}`)
      }

      if (overrideErrors.length > 0) {
        return NextResponse.json({ ok: false, error: { code: 'PRICE_OVERRIDE_FAILED', message: overrideErrors.join('; ') } }, { status: 409 })
      }

      // Count what actually persisted rather than what was requested, so a
      // rejected room can never inflate room_count.
      const liveRoomCount = await prisma.reservation_rooms.count({ where: { reservation_id: id, deleted_at: null } })
      updateFields.room_count = liveRoomCount

      if (
        addedCount > 0 ||
        toRemove.length > 0 ||
        occupancyChanged ||
        overridesChanged ||
        // Also re-price when the stored room_count had drifted from reality, so
        // a reservation left inconsistent by an earlier failed edit heals on
        // the next save instead of staying wrong forever.
        updateFields.room_count !== existing.room_count
      ) {
        needsPricingRecalc = true
      }
    }

    let updated = existing

    if (Object.keys(updateFields).length > 0) {
      try {
        updated = toRow('reservations', await prisma.reservations.update({ where: { id }, data: updateFields }))
      } catch (error) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Update failed' } }, { status: 400 })
      }

      // Sync booker_name to invoice guest_name when name changes
      if (input.booker_name !== undefined) {
        await prisma.invoices
          .updateMany({ where: { reservation_id: id, deleted_at: null }, data: { guest_name: input.booker_name } })
          .catch((nameErr) => console.error('Invoice name sync failed (non-blocking):', nameErr))
      }
    }

    // Re-price and push onto the invoice AFTER the reservation row is saved, so
    // the snapshot and the invoice stay dates reflect the edit that just landed.
    if (needsPricingRecalc) {
      try {
        const companyInfo = await prisma.reservation_company_info.findFirst({ where: { reservation_id: id }, select: { company_id: true } })
        await snapshotPricing(id, companyInfo?.company_id ?? null)
      } catch (err) {
        console.error('Pricing recalculation failed (non-blocking):', err)
      }

      // Runs even when the snapshot above failed: the invoice still has to
      // follow the reservation total rather than stay on a stale amount.
      try {
        await syncInvoiceAfterPricing(id)
      } catch (invErr) {
        console.error('Invoice sync after pricing failed (non-blocking):', invErr)
      }

      const repriced = await prisma.reservations.findFirst({ where: { id, deleted_at: null } })
      if (repriced) updated = toRow('reservations', repriced)
    }

    if (addFailures.length > 0) {
      return NextResponse.json({
        ok: false,
        error: { code: 'ROOM_UNAVAILABLE', message: `Some rooms could not be added: ${addFailures.join('; ')}` },
      }, { status: 409 })
    }

    return NextResponse.json({ ok: true, data: updated })
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_UPDATE_DRAFT, async () => {
    const { id } = await params

    const existing = await prisma.reservations.findFirst({ where: { id, deleted_at: null }, select: { status: true } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    if (!['draft', 'held'].includes(existing.status)) {
      return NextResponse.json({ ok: false, error: { code: 'TERMINAL_STATUS', message: 'Only draft or held reservations can be deleted' } }, { status: 409 })
    }

    // Soft-delete the reservation and release its rooms/guests so the rooms
    // are bookable again.
    const now = new Date()
    try {
      await prisma.$transaction([
        prisma.reservations.update({ where: { id }, data: { deleted_at: now } }),
        prisma.reservation_rooms.updateMany({ where: { reservation_id: id, deleted_at: null }, data: { deleted_at: now, status: 'released' } }),
        prisma.reservation_guests.updateMany({ where: { reservation_id: id, deleted_at: null }, data: { deleted_at: now } }),
      ])
    } catch (error) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Delete failed' } }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  })
}
