import 'server-only'
import { logReservationActivity } from '@/modules/reservations/services/activityLogService'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'
import { recordReservationStatus, releaseRooms } from '@/modules/reservations/services/stayServer'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_NO_SHOW, async (session) => {
    const { id } = await params

    const reservation = await prisma.reservations.findFirst({ where: { id, deleted_at: null }, select: { status: true } })
    if (!reservation) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    if (reservation.status !== 'confirmed') {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Only confirmed reservations can be marked no-show' } }, { status: 409 })
    }

    try {
      const now = new Date()
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.reservations.update({ where: { id }, data: { status: 'no_show' } })
        await releaseRooms(tx, { reservationId: id, actorId: session.id, reason: 'No-show', roomStatus: 'cancelled', at: now })
        await recordReservationStatus(tx, { reservationId: id, from: 'confirmed', to: 'no_show', actorId: session.id, at: now })
        return row
      })
      await logReservationActivity(session, 'noShow', id)
      return NextResponse.json({ ok: true, data: toRow('reservations', updated) })
    } catch (error) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'No-show failed' } }, { status: 400 })
    }
  })
}
