import 'server-only'
import { logReservationActivity } from '@/modules/reservations/services/activityLogService'

import { NextResponse } from 'next/server'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import { occupyRooms, recordReservationStatus } from './stayServer'

/**
 * Checks a reservation in: reservation -> checked_in, assigned rooms occupied,
 * room + reservation history recorded, all in one transaction.
 */
export async function checkInReservation(input: {
  reservationId: string
  actorId: string
  allowedFrom: string[]
  invalidStatusResponse: { code: string; message: string }
  requireArrivalDate?: boolean
}) {
  const reservation = await prisma.reservations.findFirst({
    where: { id: input.reservationId, deleted_at: null },
    select: { status: true, check_in_date: true },
  })
  if (!reservation) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
  }

  const currentStatus = reservation.status
  if (!input.allowedFrom.includes(currentStatus)) {
    return NextResponse.json({ ok: false, error: input.invalidStatusResponse }, { status: 409 })
  }
  if (input.requireArrivalDate && reservation.check_in_date > new Date()) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Check-in date has not arrived yet' } }, { status: 409 })
  }

  try {
    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.reservations.update({
        where: { id: input.reservationId },
        data: { status: 'checked_in', checked_in_at: now },
      })
      await occupyRooms(tx, input.reservationId, input.actorId, now)
      await recordReservationStatus(tx, {
        reservationId: input.reservationId,
        from: currentStatus,
        to: 'checked_in',
        actorId: input.actorId,
        at: now,
      })
      return row
    })
    await logReservationActivity({ id: input.actorId }, 'checkedIn', input.reservationId)
    return NextResponse.json({ ok: true, data: toRow('reservations', updated) })
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Check-in failed' } }, { status: 400 })
  }
}
