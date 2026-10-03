import 'server-only'
import { logReservationActivity } from '@/modules/reservations/services/activityLogService'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate, toRow } from '@/services/db/rows'
import { recordReservationStatus, releaseRooms } from '@/modules/reservations/services/stayServer'
import { CancelReservationSchema, zodErrorMessage } from '@/shared/validation'

function cancellationItem(invoiceId: string, fee: number): Prisma.invoice_itemsCreateManyInput {
  return {
    invoice_id: invoiceId,
    type: 'cancellation_fee',
    description: 'Cancellation fee',
    quantity: 1,
    unit_price: fee,
    discount_amount: 0,
    tax_amount: 0,
    total_price: fee,
    sort_order: 0,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_CANCEL, async (session) => {
    const { id } = await params
    const parsed = CancelReservationSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { reason, feeAmount } = parsed.data

    const reservation = await prisma.reservations.findFirst({ where: { id, deleted_at: null }, select: { status: true, currency: true } })
    if (!reservation) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }
    if (!['draft', 'held', 'confirmed'].includes(reservation.status)) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot cancel reservation with status ${reservation.status}` } }, { status: 409 })
    }

    try {
      const now = new Date()
      const today = dbDate(now.toISOString())

      const result = await prisma.$transaction(async (tx) => {
        let createdInvoice: Record<string, unknown> | null = null

        // Draft invoice created with the reservation (linked by reservation_id;
        // older rows only mention the id in notes).
        const existingDraft = await tx.invoices.findFirst({
          where: {
            status: 'draft',
            deleted_at: null,
            OR: [{ reservation_id: id }, { notes: { contains: id } }],
          },
          select: { id: true },
        })

        if (feeAmount && Number(feeAmount) > 0) {
          const totalFee = Math.round(Number(feeAmount) * 100) / 100
          const paidFee = {
            amount: totalFee,
            subtotal: totalFee,
            discount: 0,
            tax_amount: 0,
            service_charge: 0,
            paid_amount: totalFee,
            remaining_balance: 0,
            status: 'paid' as const,
            issue_date: today,
            due_date: today,
            paid_at: now,
            notes: `Cancellation fee for reservation ${id}`,
          }

          let invoiceId: string | null = null
          if (existingDraft) {
            await tx.invoices.update({
              where: { id: existingDraft.id },
              data: { ...paidFee, issued_at: now, issued_by: session.id, updated_by: session.id },
            })
            await tx.invoice_items.deleteMany({ where: { invoice_id: existingDraft.id } })
            invoiceId = existingDraft.id
          } else {
            const guest = await tx.reservation_guests.findFirst({
              where: { reservation_id: id, is_primary: true },
              select: { full_name: true, contact_id: true },
            })
            const guestName = guest?.full_name ?? 'Guest'
            // phone stays NULL: an empty string would collide on the unique phone index.
            const contactId = guest?.contact_id
              ?? (await tx.contacts.create({ data: { type: 'individual', name: guestName }, select: { id: true } })).id

            const invoice = await tx.invoices.create({
              data: {
                ...paidFee,
                contact_id: contactId,
                reservation_id: id,
                invoice_number: `INV-CXL-${id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`,
                currency: reservation.currency,
                guest_name: guestName,
                created_by: session.id,
              },
              select: { id: true },
            })
            invoiceId = invoice.id
          }

          await tx.invoice_items.create({ data: cancellationItem(invoiceId, totalFee) })
          await tx.payments.create({
            data: { invoice_id: invoiceId, method: 'other', amount: totalFee, currency: reservation.currency, description: 'Cancellation fee', created_by: session.id },
          })
          const invoice = await tx.invoices.findUnique({ where: { id: invoiceId } })
          createdInvoice = invoice ? toRow('invoices', invoice) : null
        } else if (existingDraft) {
          await tx.invoices.update({
            where: { id: existingDraft.id },
            data: {
              status: 'void',
              remaining_balance: 0,
              void_reason: 'Reservation cancelled',
              voided_at: now,
              voided_by: session.id,
              notes: `Cancelled reservation ${id}`,
              updated_by: session.id,
            },
          })
        }

        const row = await tx.reservations.update({ where: { id }, data: { status: 'cancelled', cancelled_at: now } })

        await tx.reservation_holds.updateMany({
          where: { reservation_id: id, status: 'active' },
          data: { status: 'released', updated_at: now },
        })

        // Only physically occupied rooms need to be freed; history is written for all.
        await releaseRooms(tx, {
          reservationId: id,
          actorId: session.id,
          reason: 'Reservation cancelled',
          roomStatus: 'cancelled',
          onlyIfOccupied: true,
          at: now,
        })

        await recordReservationStatus(tx, { reservationId: id, from: reservation.status, to: 'cancelled', reason, actorId: session.id, at: now })

        return { reservation: toRow('reservations', row), invoice: createdInvoice }
      })

      await logReservationActivity(session, 'cancelled', id)
      return NextResponse.json({ ok: true, data: result.reservation, invoice: result.invoice ?? undefined })
    } catch (error) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Cancel failed' } }, { status: 400 })
    }
  })
}
