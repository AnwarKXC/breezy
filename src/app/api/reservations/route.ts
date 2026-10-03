import 'server-only'
import { logReservationActivity } from '@/modules/reservations/services/activityLogService'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import type { reservation_status } from '@/generated/prisma/enums'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate, toRow, toRows } from '@/services/db/rows'
import { ReservationCreateSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    const where: Prisma.reservationsWhereInput = { deleted_at: null }
    if (status) where.status = status as reservation_status
    if (fromDate) where.check_in_date = { gte: dbDate(fromDate) }
    if (toDate) where.check_out_date = { lte: dbDate(toDate) }

    try {
      const rows = await prisma.reservations.findMany({ where, orderBy: { created_at: 'desc' }, skip: offset, take: limit })
      return NextResponse.json({ ok: true, data: toRows('reservations', rows) })
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Failed to load reservations' } }, { status: 400 })
    }
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_CREATE, async (session) => {
    const parsed = ReservationCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error), details: { fieldErrors: parsed.error.flatten().fieldErrors } } }, { status: 400 })
    }

    const input = parsed.data
    const checkIn = dbDate(input.check_in_date)
    const checkOut = dbDate(input.check_out_date)
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)
    if (nights < 1) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'check_out_date must be after check_in_date' } }, { status: 400 })
    }

    try {
      const row = await prisma.reservations.create({
        data: {
          status: 'draft',
          booking_type: input.company_id ? 'company' : 'individual',
          check_in_date: checkIn,
          check_out_date: checkOut,
          nights,
          adults: input.occupancy_adults,
          children: input.occupancy_children,
          room_count: input.room_count ?? 1,
          booker_name: input.booker_name ?? null,
          booker_email: input.booker_email ?? null,
          booker_phone: input.booker_phone ?? null,
          company_id: input.company_id ?? null,
          internal_notes: input.notes ?? null,
          ...(input.source ? { source: input.source as Prisma.reservationsUncheckedCreateInput['source'] } : {}),
          created_by: session.id,
        },
      })
      await logReservationActivity(session, 'created', row.id)
      return NextResponse.json({ ok: true, data: toRow('reservations', row) }, { status: 201 })
    } catch (error) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Create failed' } }, { status: 400 })
    }
  })
}
