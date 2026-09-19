import 'server-only'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate, fromRow, serializeRow, toRow, toRows } from '@/services/db/rows'
import { buildCheckoutInvoiceDraft, mapCheckoutInvoiceForPdf } from './checkoutInvoice'
import { CheckoutSchema, zodErrorMessage } from '@/shared/validation'
import { getSystemCurrency, getServiceChargeTaxRates } from '@/shared/currency/server'
import { recordReservationStatus, releaseRooms } from '@/modules/reservations/services/stayServer'

class CheckoutError extends Error {
  constructor(readonly code: string, message: string, readonly status = 500) {
    super(message)
  }
}

/** Loads the reservation in the row shape checkoutInvoice.ts works with. */
async function loadReservation(id: string) {
  const row = await prisma.reservations.findFirst({
    where: { id, deleted_at: null },
    include: {
      contacts: { select: { id: true, name: true, phone: true, email: true } },
      reservation_rooms: {
        where: { deleted_at: null },
        select: {
          room_id: true,
          adults: true,
          children: true,
          rate_per_night: true,
          nights: true,
          total_amount: true,
          check_in_date: true,
          check_out_date: true,
          deleted_at: true,
          room_types: { select: { name: true } },
          rooms: { select: { number: true } },
        },
      },
      reservation_pricing_items: { select: { pricing_level: true, service_amount: true, tax_amount: true, total_amount: true } },
    },
  })
  if (!row) return null

  const { contacts, reservation_rooms, reservation_pricing_items, ...rest } = serializeRow('reservations', row) as Record<string, unknown> & {
    contacts: { id: string; name: string | null; phone: string | null; email: string | null } | null
    reservation_rooms: Array<Record<string, unknown> & { room_types: { name: string } | null; rooms: { number: string } | null }>
    reservation_pricing_items: Array<Record<string, unknown>>
  }
  return {
    ...(rest as { id: string; status: string; company_id: string | null; booker_name: string | null; booker_phone: string | null; booker_email: string | null }),
    company: contacts,
    reservation_rooms: reservation_rooms.map(({ room_types, rooms, ...room }) => ({
      ...(room as { room_id: string }),
      room_type: room_types,
      room: rooms,
    })),
    pricing_items: reservation_pricing_items,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_CHECK_OUT, async (session) => {
    const { id } = await params
    const parsed = CheckoutSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { extraCharges, paymentMethod, paidAmount } = parsed.data

    const reservation = await loadReservation(id)
    if (!reservation) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Reservation not found' } }, { status: 404 })
    }

    const activeInvoiceWhere: Prisma.invoicesWhereInput = { reservation_id: id, deleted_at: null, status: { not: 'void' } }

    // Idempotency guard: a reservation already checked out (a previous request
    // succeeded) returns success without creating another invoice or payment.
    if (reservation.status === 'checked_out') {
      const existingInvoice = await prisma.invoices.findFirst({ where: activeInvoiceWhere, select: { id: true }, orderBy: { created_at: 'asc' } })
      return NextResponse.json({ ok: true, data: reservation, invoice: existingInvoice ? { id: existingInvoice.id } : null, idempotent: true })
    }

    if (reservation.status !== 'checked_in') {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Only checked-in reservations can be checked out' } }, { status: 409 })
    }

    const now = new Date().toISOString()
    const primaryGuest = await prisma.reservation_guests.findFirst({
      where: { reservation_id: id, is_primary: true },
      select: { full_name: true, contact_id: true },
    })
    const company = reservation.company
    const guestName = primaryGuest?.full_name ?? reservation.booker_name ?? company?.name ?? 'Guest'
    const rates = await getServiceChargeTaxRates()

    // Reuse the reservation's existing (auto-created) invoice instead of
    // inserting a duplicate one.
    const existingInvoice = await prisma.invoices.findFirst({ where: activeInvoiceWhere, orderBy: { created_at: 'asc' } })

    try {
      const result = await prisma.$transaction(async (tx) => {
        let invoiceContactId = reservation.company_id ?? primaryGuest?.contact_id ?? null
        if (!invoiceContactId) {
          // phone stays NULL when unknown: '' would collide on the unique phone index.
          const contact = await tx.contacts.create({
            data: {
              type: 'individual',
              name: guestName,
              phone: reservation.booker_phone || company?.phone || null,
              email: reservation.booker_email ?? company?.email ?? null,
            },
            select: { id: true },
          })
          invoiceContactId = contact.id
        }

        const invoiceDraft = buildCheckoutInvoiceDraft({
          reservation: reservation as Parameters<typeof buildCheckoutInvoiceDraft>[0]['reservation'],
          contactId: invoiceContactId,
          guestName,
          companyName: company?.name ?? null,
          paymentMethod,
          paidAmount,
          extraCharges,
          now,
          currency: await getSystemCurrency(),
          serviceChargeRate: rates.serviceChargeRate,
          vatRate: rates.vatRate,
        })

        // Cash already on the invoice (e.g. paid from the accounting module):
        // checkout collects only the outstanding balance + new extras, so prior
        // payments are merged, not overwritten.
        let priorPaidNet = 0
        if (existingInvoice) {
          const prior = await tx.payments.aggregate({ where: { invoice_id: existingInvoice.id, deleted_at: null }, _sum: { amount: true } })
          priorPaidNet = Math.max(0, Number(prior._sum.amount ?? 0))
          // A discount applied from the accounting module lives on the invoice;
          // carry it over instead of silently wiping it.
          const priorDiscount = Math.max(0, Number(existingInvoice.discount ?? 0))
          if (priorDiscount > 0) {
            invoiceDraft.invoice.discount = priorDiscount
            invoiceDraft.invoice.amount = Math.max(0, Number(invoiceDraft.invoice.amount ?? 0) - priorDiscount)
          }
          const draftTotal = Number(invoiceDraft.invoice.amount ?? 0)
          const mergedPaid = Math.min(draftTotal, priorPaidNet + paidAmount)
          const mergedRemaining = Math.max(0, draftTotal - mergedPaid)
          invoiceDraft.invoice.paid_amount = mergedPaid
          invoiceDraft.invoice.remaining_balance = mergedRemaining
          invoiceDraft.invoice.status = mergedRemaining <= 0 && draftTotal > 0 ? 'paid' : mergedPaid > 0 ? 'partially_paid' : 'issued'
          invoiceDraft.invoice.paid_at = existingInvoice.paid_at?.toISOString() ?? (mergedRemaining <= 0 ? now : null)
          invoiceDraft.reservationUpdate.paid_amount = mergedPaid
          invoiceDraft.reservationUpdate.balance_amount = mergedRemaining
        }

        // Checkout may only collect what is still outstanding (after any
        // discount and prior payments).
        const outstanding = Math.round(Math.max(0, Number(invoiceDraft.invoice.amount ?? 0) - priorPaidNet) * 100) / 100
        if (Math.round(paidAmount * 100) / 100 > outstanding) {
          throw new CheckoutError('VALIDATION_ERROR', `Paid amount cannot exceed the outstanding balance (${outstanding}).`, 400)
        }

        const invoiceData = fromRow('invoices', { ...invoiceDraft.invoice, reservation_id: id })
        const invoice = existingInvoice
          ? await tx.invoices.update({
              where: { id: existingInvoice.id },
              data: { ...(invoiceData as Prisma.invoicesUncheckedUpdateInput), updated_by: session.id },
            })
          : await tx.invoices.create({
              data: { ...(invoiceData as Prisma.invoicesUncheckedCreateInput), created_by: session.id },
            })

        // Replace the items so a retry cannot double the line items.
        await tx.invoice_items.deleteMany({ where: { invoice_id: invoice.id } })
        if (invoiceDraft.items.length > 0) {
          await tx.invoice_items.createMany({
            data: invoiceDraft.items.map((item) => fromRow('invoice_items', { ...item, invoice_id: invoice.id }) as Prisma.invoice_itemsCreateManyInput),
          })
        }
        const items = await tx.invoice_items.findMany({ where: { invoice_id: invoice.id } })

        // Only the amount collected at checkout becomes a new payment row; the
        // deterministic idempotency key stops a retried POST from duplicating it.
        const payments = []
        if (paidAmount > 0) {
          const idempotencyKey = `checkout:${id}:${paidAmount}:${paymentMethod}`
          const existingPayment = await tx.payments.findFirst({
            where: { invoice_id: invoice.id, idempotency_key: idempotencyKey, deleted_at: null },
            select: { id: true },
          })
          if (!existingPayment) {
            payments.push(
              await tx.payments.create({
                data: {
                  invoice_id: invoice.id,
                  method: paymentMethod,
                  amount: paidAmount,
                  description: `Checkout payment for reservation ${id}`,
                  created_by: session.id,
                  received_by: session.id,
                  transaction_date: dbDate(now),
                  idempotency_key: idempotencyKey,
                },
              }),
            )
          }
        }

        const updatedReservation = await tx.reservations.update({
          where: { id },
          data: {
            ...(fromRow('reservations', invoiceDraft.reservationUpdate) as Prisma.reservationsUncheckedUpdateInput),
            total_amount: Number(invoiceDraft.invoice.amount ?? 0),
            updated_by: session.id,
          },
        })

        // Guests leave: rooms become dirty, stays checked_out.
        await releaseRooms(tx, {
          reservationId: id,
          actorId: session.id,
          reason: 'Check-out',
          roomStatus: 'checked_out',
          housekeeping: 'dirty',
          at: new Date(now),
        })
        await recordReservationStatus(tx, { reservationId: id, from: 'checked_in', to: 'checked_out', actorId: session.id, at: new Date(now) })

        return {
          reservation: toRow('reservations', updatedReservation),
          invoice: toRow('invoices', invoice),
          items: toRows('invoice_items', items),
          payments: toRows('payments', payments),
        }
      })

      return NextResponse.json({
        ok: true,
        data: result.reservation,
        invoice: mapCheckoutInvoiceForPdf(result.invoice, result.items, result.payments, reservation.reservation_rooms),
      })
    } catch (error) {
      if (error instanceof CheckoutError) {
        return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status })
      }
      return NextResponse.json({ ok: false, error: { code: 'CHECKOUT_FAILED', message: error instanceof Error ? error.message : 'Checkout failed' } }, { status: 500 })
    }
  })
}
