import 'server-only'
import { logReservationActivity } from '@/modules/reservations/services/activityLogService'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate, toRow } from '@/services/db/rows'
import { isOverlapViolation } from '@/services/db/errors'
import { getRoomAvailability } from '@/services/db/rpc'
import { ExtendReservationSchema, zodErrorMessage } from '@/shared/validation'
import { snapshotPricing, syncOpenInvoicesForReservation } from '@/modules/reservations/services/pricingService'
import { recordReservationStatus } from '@/modules/reservations/services/stayServer'

const day = (d: Date) => d.toISOString().slice(0, 10)

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_EXTEND, async (session) => {
    const { id } = await params
    const parsed = ExtendReservationSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { newCheckOut, reservationRoomId, newRoomId, newRoomNumber } = parsed.data

    const reservation = await prisma.reservations.findFirst({
      where: { id, deleted_at: null },
      select: { check_in_date: true, check_out_date: true, status: true, currency: true },
    })
    if (!reservation) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    if (!['held', 'confirmed', 'checked_in'].includes(reservation.status)) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cannot extend reservation in current status' } }, { status: 409 })
    }
    if (!reservationRoomId && newCheckOut <= day(reservation.check_out_date)) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'New checkout must be after current checkout' } }, { status: 400 })
    }

    // If reservationRoomId is provided, extend only that assigned room;
    // otherwise extend every active room in the reservation.
    const rooms = await prisma.reservation_rooms.findMany({
      where: {
        reservation_id: id,
        deleted_at: null,
        status: { not: 'cancelled' },
        ...(reservationRoomId ? { id: reservationRoomId } : {}),
      },
      select: { id: true, room_id: true, check_in_date: true, check_out_date: true, rate_per_night: true, discount_amount: true, tax_amount: true },
    })

    if (rooms.length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation room not found' } }, { status: 404 })
    }
    if (reservationRoomId && rooms.length > 1) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Ambiguous room match — expected 1 room' } }, { status: 400 })
    }

    for (const rr of rooms) {
      const targetRoomId = newRoomId ?? rr.room_id
      const currentCheckOut = day(rr.check_out_date)
      if (newCheckOut <= currentCheckOut) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'New checkout must be after current room checkout' } }, { status: 400 })
      }
      const availability = await getRoomAvailability({ checkIn: currentCheckOut, checkOut: newCheckOut, excludeReservationId: id, currency: reservation.currency })
      if (availability.some((c) => c.room_id === targetRoomId && c.status === 'unavailable')) {
        return NextResponse.json({ ok: false, error: { code: 'EXTENSION_CONFLICT', message: 'Room is not available for extension period' } }, { status: 409 })
      }
    }

    let updated
    let activeRoomCount = 0
    try {
      updated = await prisma.$transaction(async (tx) => {
        const newCheckOutDate = dbDate(newCheckOut)
        const isOccupied = reservation.status === 'checked_in'
        for (const rr of rooms) {
          const nights = Math.max(1, Math.round((newCheckOutDate.getTime() - rr.check_in_date.getTime()) / 86400000))
          const subtotal = Number(rr.rate_per_night ?? 0) * nights
          const total = Math.max(0, subtotal - Number(rr.discount_amount ?? 0) + Number(rr.tax_amount ?? 0))

          const patch: Prisma.reservation_roomsUncheckedUpdateInput = {
            check_out_date: newCheckOutDate,
            nights,
            subtotal_amount: subtotal,
            total_amount: total,
          }
          if (newRoomId) patch.room_id = newRoomId
          await tx.reservation_rooms.update({ where: { id: rr.id }, data: patch })

          if (newRoomId && rr.room_id !== newRoomId) {
            await tx.rooms.update({ where: { id: rr.room_id }, data: { status: 'available' } })
            await tx.rooms.update({ where: { id: newRoomId }, data: { status: isOccupied ? 'occupied' : 'available' } })
          }
        }

        const activeRooms = await tx.reservation_rooms.findMany({
          where: { reservation_id: id, deleted_at: null, status: { not: 'cancelled' } },
          select: { check_out_date: true, subtotal_amount: true, discount_amount: true, tax_amount: true, total_amount: true },
        })
        activeRoomCount = activeRooms.length

        const latestCheckOut = activeRooms.map((rr) => rr.check_out_date).reduce((max, d) => (d > max ? d : max), newCheckOutDate)
        const totals = activeRooms.reduce(
          (acc, rr) => ({
            subtotal: acc.subtotal + Number(rr.subtotal_amount ?? 0),
            discount: acc.discount + Number(rr.discount_amount ?? 0),
            tax: acc.tax + Number(rr.tax_amount ?? 0),
            total: acc.total + Number(rr.total_amount ?? 0),
          }),
          { subtotal: 0, discount: 0, tax: 0, total: 0 },
        )
        const nights = Math.max(1, Math.round((latestCheckOut.getTime() - reservation.check_in_date.getTime()) / 86400000))

        const row = await tx.reservations.update({
          where: { id },
          data: {
            check_out_date: latestCheckOut,
            nights,
            subtotal_amount: totals.subtotal,
            discount_amount: totals.discount,
            tax_amount: totals.tax,
            total_amount: totals.total,
          },
        })

        await recordReservationStatus(tx, {
          reservationId: id,
          from: reservation.status,
          to: reservation.status,
          reason: reservationRoomId
            ? `Extended room ${newRoomNumber ? `${newRoomNumber} ` : ''}from ${day(reservation.check_out_date)} to ${newCheckOut}`
            : `Extended from ${day(reservation.check_out_date)} to ${newCheckOut}`,
          actorId: session.id,
        })
        return row
      })
    } catch (error) {
      if (isOverlapViolation(error)) {
        return NextResponse.json({ ok: false, error: { code: 'ROOM_UNAVAILABLE', message: 'Room is not available for the extended dates' } }, { status: 409 })
      }
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Extend failed' } }, { status: 400 })
    }

    // Keep pricing snapshot and any open invoice in sync with the extended stay.
    // The full snapshot is only safe when the whole reservation moved (or it has
    // a single room): calculatePricing prices every room for the same dates.
    try {
      if (!reservationRoomId || activeRoomCount === 1) {
        const companyInfo = await prisma.reservation_company_info.findFirst({ where: { reservation_id: id }, select: { company_id: true } })
        await snapshotPricing(id, companyInfo?.company_id ?? null)
      }
      await syncOpenInvoicesForReservation(id)
    } catch (err) {
      console.error('post-extend invoice sync failed:', err)
    }

    await logReservationActivity(session, 'extended', id, { newCheckOut })
    return NextResponse.json({ ok: true, data: toRow('reservations', updated) })
  })
}
