import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { toRows } from '@/services/db/rows'
import { ReservationExtrasSchema, zodErrorMessage } from '@/shared/validation'
import { syncOpenInvoicesForReservation } from '@/modules/reservations/services/pricingService'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_CHECK_OUT, async (session) => {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = ReservationExtrasSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { reservationRoomId, charges } = parsed.data

    const chargesTotal = charges.reduce((sum, c) => sum + Number(c.amount ?? 0), 0)

    // Insert the charges and fold them into the reservation totals atomically.
    let created
    try {
      created = await prisma.$transaction(async (tx) => {
        const reservation = await tx.reservations.findUnique({ where: { id }, select: { currency: true } })
        if (!reservation) throw new Error('Reservation not found')
        const currency = reservation.currency
        const rows = await tx.reservation_pricing_items.createManyAndReturn({
          data: charges.map((charge) => ({
            reservation_id: id,
            reservation_room_id: reservationRoomId ?? null,
            pricing_level: 'extra' as const,
            base_rate: charge.amount,
            applied_rate: charge.amount,
            nights: 1,
            quantity: 1,
            discount_amount: 0,
            tax_amount: 0,
            service_amount: 0,
            total_amount: charge.amount,
            currency,
            price_source: 'manual_override' as const,
            source_type: 'manual_override',
            manual_override_reason: charge.label,
            manual_override_by: session.id,
          })),
        })

        if (chargesTotal !== 0) {
          const current = await tx.reservations.findUnique({
            where: { id },
            select: { subtotal_amount: true, total_amount: true, paid_amount: true },
          })
          if (current) {
            const newTotal = Number(current.total_amount ?? 0) + chargesTotal
            await tx.reservations.update({
              where: { id },
              data: {
                subtotal_amount: Number(current.subtotal_amount ?? 0) + chargesTotal,
                total_amount: newTotal,
                balance_amount: Math.max(0, newTotal - Number(current.paid_amount ?? 0)),
              },
            })
          }
        }
        return rows
      })
    } catch (err) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Failed to add charges' } }, { status: 400 })
    }

    if (chargesTotal !== 0) {
      try {
        await syncOpenInvoicesForReservation(id)
      } catch (err) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Failed to sync invoice' } }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, data: toRows('reservation_pricing_items', created) })
  })
}
