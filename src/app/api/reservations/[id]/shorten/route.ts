import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate, todayDate, toRow } from '@/services/db/rows'
import { ShortenReservationSchema, zodErrorMessage } from '@/shared/validation'
import { snapshotPricing, syncOpenInvoicesForReservation } from '@/modules/reservations/services/pricingService'
import { recordReservationStatus } from '@/modules/reservations/services/stayServer'

const day = (d: Date) => d.toISOString().slice(0, 10)

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_EXTEND, async (session) => {
    const { id } = await params
    const parsed = ShortenReservationSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { newCheckOut, reservationRoomId } = parsed.data

    const reservation = await prisma.reservations.findFirst({
      where: { id, deleted_at: null },
      select: { check_in_date: true, check_out_date: true, status: true },
    })
    if (!reservation) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    if (!['held', 'confirmed', 'checked_in'].includes(reservation.status)) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cannot shorten reservation in current status' } }, { status: 409 })
    }

    // Removing nights can never conflict with another booking (it only frees
    // up room-nights), so — unlike extend — there is no availability check.
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

    const today = todayDate()
    const isCheckedIn = reservation.status === 'checked_in'
    for (const rr of rooms) {
      if (newCheckOut <= day(rr.check_in_date)) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'New checkout must be after check-in' } }, { status: 400 })
      }
      if (newCheckOut >= day(rr.check_out_date)) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'New checkout must be before current room checkout' } }, { status: 400 })
      }
      // A guest already checked in has already stayed the nights up to today —
      // those can't be un-billed retroactively.
      if (isCheckedIn && newCheckOut < today) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'New checkout cannot be before today' } }, { status: 400 })
      }
    }

    let updated
    let activeRoomCount = 0
    try {
      updated = await prisma.$transaction(async (tx) => {
        const newCheckOutDate = dbDate(newCheckOut)
        for (const rr of rooms) {
          const nights = Math.max(1, Math.round((newCheckOutDate.getTime() - rr.check_in_date.getTime()) / 86400000))
          const subtotal = Number(rr.rate_per_night ?? 0) * nights
          const total = Math.max(0, subtotal - Number(rr.discount_amount ?? 0) + Number(rr.tax_amount ?? 0))
          await tx.reservation_rooms.update({
            where: { id: rr.id },
            data: { check_out_date: newCheckOutDate, nights, subtotal_amount: subtotal, total_amount: total },
          })
        }

        const activeRooms = await tx.reservation_rooms.findMany({
          where: { reservation_id: id, deleted_at: null, status: { not: 'cancelled' } },
          select: { check_out_date: true, subtotal_amount: true, discount_amount: true, tax_amount: true, total_amount: true },
        })
        activeRoomCount = activeRooms.length

        const latestCheckOut = activeRooms
          .map((rr) => rr.check_out_date)
          .reduce((max, d) => (d > max ? d : max), newCheckOutDate)
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
          reason: `Shortened from ${day(reservation.check_out_date)} to ${newCheckOut}`,
          actorId: session.id,
        })
        return row
      })
    } catch (error) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Shorten failed' } }, { status: 400 })
    }

    // Keep pricing snapshot and any open invoice in sync with the shortened stay.
    try {
      if (!reservationRoomId || activeRoomCount === 1) {
        const companyInfo = await prisma.reservation_company_info.findFirst({ where: { reservation_id: id }, select: { company_id: true } })
        await snapshotPricing(id, companyInfo?.company_id ?? null)
      }
      await syncOpenInvoicesForReservation(id)
    } catch (err) {
      console.error('post-shorten invoice sync failed:', err)
    }

    return NextResponse.json({ ok: true, data: toRow('reservations', updated) })
  })
}
