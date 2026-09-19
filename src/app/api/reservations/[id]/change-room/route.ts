import 'server-only'
import { NextResponse } from 'next/server'
import type { occupancy_code } from '@/generated/prisma/enums'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { isOverlapViolation } from '@/services/db/errors'
import { snapshotPricing, syncOpenInvoicesForReservation, type PriceBreakdown } from '@/modules/reservations/services/pricingService'
import { recordReservationStatus } from '@/modules/reservations/services/stayServer'
import { ChangeRoomSchema, zodErrorMessage } from '@/shared/validation'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_EXTEND, async (session) => {
    const { id } = await params
    const parsed = ChangeRoomSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { reservationRoomId, newRoomId, newRoomNumber, occupancyCode } = parsed.data

    const reservation = await prisma.reservations.findFirst({ where: { id, deleted_at: null }, select: { status: true } })
    if (!reservation) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    if (!['held', 'confirmed', 'checked_in'].includes(reservation.status)) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cannot change room in current status' } }, { status: 409 })
    }

    const roomRow = await prisma.reservation_rooms.findFirst({
      where: { id: reservationRoomId, reservation_id: id, deleted_at: null },
      select: { id: true, room_id: true },
    })
    if (!roomRow) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Room not found in reservation' } }, { status: 404 })
    }

    const oldRoomId = roomRow.room_id
    try {
      await prisma.$transaction(async (tx) => {
        await tx.reservation_rooms.update({
          where: { id: reservationRoomId },
          data: { room_id: newRoomId, ...(occupancyCode ? { occupancy_code: occupancyCode as occupancy_code } : {}) },
        })

        if (oldRoomId !== newRoomId) {
          const isOccupied = reservation.status === 'checked_in'
          await tx.rooms.update({ where: { id: oldRoomId }, data: { status: 'available' } })
          await tx.rooms.update({ where: { id: newRoomId }, data: { status: isOccupied ? 'occupied' : 'available' } })
          await tx.room_status_history.createMany({
            data: [
              {
                room_id: oldRoomId,
                to_status: 'available',
                from_status: isOccupied ? 'occupied' : 'available',
                reason: `Room changed to ${newRoomNumber ?? newRoomId}`,
                reservation_id: id,
                changed_by: session.id,
              },
              {
                room_id: newRoomId,
                to_status: isOccupied ? 'occupied' : 'available',
                from_status: 'available',
                reason: `Assigned from room ${oldRoomId.slice(0, 8)}`,
                reservation_id: id,
                changed_by: session.id,
              },
            ],
          })
        }

        await recordReservationStatus(tx, {
          reservationId: id,
          from: reservation.status,
          to: reservation.status,
          reason: `Changed room to ${newRoomNumber ?? newRoomId}`,
          actorId: session.id,
        })
      })
    } catch (error) {
      if (isOverlapViolation(error)) {
        return NextResponse.json({ ok: false, error: { code: 'ROOM_UNAVAILABLE', message: 'Room is already booked for those dates' } }, { status: 409 })
      }
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Room change failed' } }, { status: 400 })
    }

    // Recompute the nightly rate from the new room and refresh the pricing
    // snapshot; best-effort because the room change itself already succeeded.
    let breakdown: PriceBreakdown | null = null
    try {
      const companyInfo = await prisma.reservation_company_info.findFirst({ where: { reservation_id: id }, select: { company_id: true } })
      breakdown = await snapshotPricing(id, companyInfo?.company_id ?? null)
    } catch {
      breakdown = null
    }

    // Keep open reservation-linked invoices in sync with the new room rate.
    if (breakdown) {
      try {
        await syncOpenInvoicesForReservation(id)
      } catch (err) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Failed to sync invoice' } }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  })
}
