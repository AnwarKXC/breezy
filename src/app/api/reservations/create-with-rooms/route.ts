import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { dbDate } from '@/services/db/rows'
import { createReservationWithRooms } from '@/services/db/rpc'
import { auditPermissionLevel, snapshotPricing } from '@/modules/reservations/services/pricingService'
import { ReservationCreateWithRoomsSchema, zodErrorMessage } from '@/shared/validation'
import type { CreateReservationWithRoomsInput } from '@/modules/reservations/types'
import { getSystemCurrency } from '@/shared/currency/server'

async function createReservationInvoice(
  reservationId: string,
  input: CreateReservationWithRoomsInput,
  userId: string,
) {
  if (!input.contactId) return

  const reservation = await prisma.reservations.findUnique({
    where: { id: reservationId },
    select: { reservation_number: true, total_amount: true },
  })
  if (!reservation) return

  const pricingItems = await prisma.reservation_pricing_items.findMany({
    where: { reservation_id: reservationId },
    select: { pricing_level: true, total_amount: true, quantity: true },
  })

  // Idempotent — if a non-void invoice already exists for this reservation
  // (e.g. a retried create-with-rooms call), realign it instead of inserting
  // a second one.
  const existing = await prisma.invoices.findFirst({
    where: { reservation_id: reservationId, deleted_at: null, status: { not: 'void' } },
    select: { id: true, status: true },
    orderBy: { created_at: 'asc' },
  })

  const sumLevel = (level: string) =>
    pricingItems.filter((i) => i.pricing_level === level).reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0)
  const roomCharges = sumLevel('nightly_rate')
  const serviceCharge = sumLevel('service_charge')
  const taxAmount = sumLevel('tax')
  const totalAmount = Number(reservation.total_amount ?? 0)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
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
    quantity: item.quantity ?? 1,
    unit_price: Number(item.total_amount ?? 0),
    discount_amount: 0,
    tax_amount: item.pricing_level === 'tax' ? Number(item.total_amount ?? 0) : 0,
    total_price: Number(item.total_amount ?? 0),
    sort_order: idx,
  }))

  if (existing) {
    // Recompute the existing draft invoice from the trusted pricing snapshot.
    await prisma.$transaction([
      prisma.invoices.update({
        where: { id: existing.id },
        data: {
          subtotal: roomCharges || totalAmount,
          tax_amount: taxAmount,
          service_charge: serviceCharge,
          amount: totalAmount,
          remaining_balance: totalAmount,
          currency: systemCurrency,
          stay_check_in: dbDate(input.checkIn),
          stay_check_out: dbDate(input.checkOut),
          updated_by: userId,
        },
      }),
      prisma.invoice_items.deleteMany({ where: { invoice_id: existing.id } }),
      prisma.invoice_items.createMany({ data: items.map((i) => ({ ...i, invoice_id: existing.id })) }),
    ])
    return
  }

  const invNumber = `INV-${String(reservation.reservation_number ?? reservationId).slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoices.create({
      data: {
        guest_name: input.guestName,
        contact_id: input.contactId as string,
        reservation_id: reservationId,
        subtotal: roomCharges || totalAmount,
        discount: 0,
        tax_amount: taxAmount,
        service_charge: serviceCharge,
        amount: totalAmount,
        paid_amount: 0,
        remaining_balance: totalAmount,
        status: 'draft',
        invoice_number: invNumber,
        issue_date: dbDate(new Date().toISOString()),
        due_date: dbDate(dueDate.toISOString()),
        stay_check_in: dbDate(input.checkIn),
        stay_check_out: dbDate(input.checkOut),
        currency: systemCurrency,
        notes: `Auto-created for reservation ${reservationId}`,
        created_by: userId,
      },
      select: { id: true },
    })
    if (items.length > 0) {
      await tx.invoice_items.createMany({ data: items.map((i) => ({ ...i, invoice_id: invoice.id })) })
    }
  })
}

export async function POST(request: Request) {
  try {
    return await secureMutationEndpoint(request, ACTIONS.RESERVATIONS_CREATE, async (session) => {
      const body = await request.json().catch(() => null)
      const parsed = ReservationCreateWithRoomsSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
      }
      const normalizedRoomTypeCounts = parsed.data.roomTypeCounts.filter((r) => r.count > 0)
      const input = { ...parsed.data, roomTypeCounts: normalizedRoomTypeCounts } as unknown as CreateReservationWithRoomsInput

      let data: unknown
      try {
        data = await createReservationWithRooms(session.id, {
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          roomTypeCounts: normalizedRoomTypeCounts,
          contactId: input.contactId ?? null,
          guestName: input.guestName,
          guestId: input.guestId ?? null,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const message = /exclusion constraint|no_overlap|23P01/i.test(errorMessage)
          ? 'One of the selected rooms was just booked by someone else for these dates. Please go back and pick another room.'
          : /duplicate key value violates unique constraint|23505/i.test(errorMessage)
            ? 'This reservation could not be created due to a data conflict. Please try again.'
            : 'Reservation creation failed'
        return NextResponse.json({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message },
        }, { status: 400 })
      }

      const raw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
      if (!raw || raw.ok !== true) {
        const errCode = (raw?.error as Record<string, unknown>)?.code
        const httpStatus = errCode === 'ROOM_UNAVAILABLE' ? 409 : 400
        return NextResponse.json({
          ok: false,
          error: (raw?.error as Record<string, unknown>) ?? { code: 'UNKNOWN', message: 'Reservation creation failed' },
        }, { status: httpStatus })
      }

      const resultData = raw.data as { reservationId: string; rooms: Array<unknown> } | undefined

      // Stamp per-line manual price overrides onto the assigned rooms BEFORE
      // snapshotPricing runs, so service charge/VAT/totals use the overridden
      // rates. Failures are non-blocking: the reservation exists; staff can
      // correct any missed room via the per-room price edit endpoint.
      const overrideByKey = new Map<string, number>()
      for (const r of normalizedRoomTypeCounts) {
        const entry = r as typeof r & { overrideRatePerNight?: number | null }
        if (entry.overrideRatePerNight != null) {
          overrideByKey.set(`${r.roomTypeId}:${r.occupancyCode ?? ''}`, entry.overrideRatePerNight)
        }
      }

      if (overrideByKey.size > 0 && resultData && resultData.rooms.length > 0) {
        try {
          const stayNights = Math.max(
            1,
            Math.round(
              (new Date(`${input.checkOut}T12:00:00`).getTime() - new Date(`${input.checkIn}T12:00:00`).getTime()) / 86400000,
            ),
          )
          for (const room of resultData.rooms as Array<{ roomId: string; roomNumber: string; roomTypeId: string; occupancyCode?: string | null; nightlyRate: number }>) {
            const override = overrideByKey.get(`${room.roomTypeId}:${room.occupancyCode ?? ''}`)
            if (override == null) continue

            await prisma.$transaction([
              prisma.reservation_rooms.updateMany({
                where: { reservation_id: resultData.reservationId, room_id: room.roomId },
                data: { rate_per_night: override, price_source: 'manual_override', total_amount: override * stayNights },
              }),
              prisma.price_override_audit_log.create({
                data: {
                  reservation_id: resultData.reservationId,
                  room_id: room.roomId,
                  night_date: dbDate(input.checkIn),
                  old_rate: room.nightlyRate,
                  new_rate: override,
                  reason: 'Manual rate set at booking creation',
                  actor_id: session.id,
                  // CHECK constraint allows only 'admin' | 'front_desk' ('manual' used to fail silently).
                  permission_level: auditPermissionLevel(session.role),
                  threshold_checked: true,
                },
              }),
            ])
          }
        } catch (err) {
          console.error('manual override stamping failed:', err)
          // Intentionally non-blocking — matches invoice-failure warning convention.
        }
      }

      // Snapshot pricing items so invoice breakdown shows room, service, tax.
      // Invoice creation is now BLOCKING: a failure here means the reservation
      // should not be reported as fully successful to the client, since the
      // accounting record would be missing. The reservation itself has
      // already been created by the RPC — we return its ID plus a clear
      // error so the UI can retry just the invoice step or surface the issue.
      if (resultData?.reservationId) {
        // Defensive: relabel reservation.currency to the system currency before
        // snapshotPricing runs. The create_reservation_with_rooms RPC hardcodes
        // 'EGP' but the pricing snapshot now writes amounts in the system
        // currency; relabelling the row avoids the header double-converting.
        try {
          const patch: Prisma.reservationsUpdateInput = { currency: await getSystemCurrency() }

          // The RPC only snapshots booker_name; copy phone/email off the contact.
          if (input.contactId) {
            const contact = await prisma.contacts.findFirst({
              where: { id: input.contactId, deleted_at: null },
              select: { phone: true, email: true },
            })
            if (contact?.phone) patch.booker_phone = contact.phone
            if (contact?.email) patch.booker_email = contact.email
          }

          await prisma.reservations.update({ where: { id: resultData.reservationId }, data: patch })
        } catch (err) {
          console.error('reservation.currency relabel failed:', err)
        }

        // Company bookings: record the company on the reservation and drop the
        // placeholder guest the RPC inserts with the company name (the company
        // is shown in the reservation header, not as a guest). This used to run
        // from the browser after the response, so a closed tab left it undone.
        if (input.contactId) {
          try {
            const company = await prisma.contacts.findFirst({
              where: { id: input.contactId, type: 'company', deleted_at: null },
              select: { id: true, name: true },
            })
            if (company) {
              await prisma.$transaction([
                prisma.reservation_company_info.upsert({
                  where: { reservation_id: resultData.reservationId },
                  create: {
                    reservation_id: resultData.reservationId,
                    company_id: company.id,
                    company_name: company.name,
                    credit_approved: false,
                    payment_terms: 'upon_checkout',
                  },
                  update: { company_id: company.id, company_name: company.name },
                }),
                prisma.reservation_guests.deleteMany({ where: { reservation_id: resultData.reservationId } }),
              ])
            }
          } catch (err) {
            console.error('company info setup failed (non-blocking):', err)
          }
        }

        try {
          await snapshotPricing(resultData.reservationId, input.contactId ?? null)
          await createReservationInvoice(resultData.reservationId, input, session.id)
        } catch (err) {
          console.error('snapshotPricing or invoice creation failed:', err)
          return NextResponse.json({
            ok: true,
            data: resultData,
            warning: {
              code: 'INVOICE_CREATION_FAILED',
              message: err instanceof Error ? err.message : 'Invoice creation failed',
            },
          }, { status: 201 })
        }
      }

      return NextResponse.json({ ok: true, data: resultData }, { status: 201 })
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Internal server error' },
    }, { status: 500 })
  }
}
