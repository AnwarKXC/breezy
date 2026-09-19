import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { applyRoomPriceOverride, snapshotPricing, syncOpenInvoicesForReservation } from '@/modules/reservations/services/pricingService'
import { ReservationRoomPriceOverrideSchema, zodErrorMessage } from '@/shared/validation'

const EDITABLE_STATUSES = ['held', 'confirmed', 'checked_in']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_EXTEND, async (session) => {
    const { id } = await params
    const body = await request.json()
    const parsed = ReservationRoomPriceOverrideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { reservationRoomId, ratePerNight, reason } = parsed.data

    const reservation = await prisma.reservations.findFirst({ where: { id, deleted_at: null }, select: { status: true } })

    if (!reservation) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    if (!EDITABLE_STATUSES.includes(String(reservation.status))) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cannot change price in current status' } }, { status: 409 })
    }

    const result = await applyRoomPriceOverride({
      reservationId: id,
      reservationRoomId,
      ratePerNight: ratePerNight ?? null,
      reason,
      actorId: session.id,
      actorRole: session.role,
    })

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'DB_ERROR' ? 400 : 409
      return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status })
    }

    try {
      // Re-snapshot with the reservation's company so non-manual sibling
      // rooms keep resolving their company rate instead of falling back to
      // seasonal/default rates.
      await snapshotPricing(id, result.companyId ?? undefined)
      // Keep any open (draft/issued) invoice for this reservation in sync
      // with the new rate — without this the invoice keeps the pre-override
      // amount until checkout regenerates it.
      await syncOpenInvoicesForReservation(id)
    } catch (err) {
      console.error('post-override snapshotPricing failed:', err)
      return NextResponse.json({
        ok: true,
        data: { oldRate: result.oldRate, newRate: result.newRate, priceSource: result.priceSource },
        warning: {
          code: 'PRICING_SNAPSHOT_FAILED',
          message: err instanceof Error ? err.message : 'Pricing snapshot failed',
        },
      })
    }

    return NextResponse.json({
      ok: true,
      data: { oldRate: result.oldRate, newRate: result.newRate, priceSource: result.priceSource },
    })
  })
}
