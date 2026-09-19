import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ACTIONS } from '@/config/rbac'
import { reservationBoardPage } from '@/generated/prisma/sql'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { zodErrorMessage } from '@/shared/validation'
import { prisma } from '@/services/db/prisma'
import { dbDate, serializeRow, todayDate } from '@/services/db/rows'

// Reservations in the embedded-row shape the board mapper
// (src/services/bookingService.ts) reads. Two modes:
// - `scope=active`: the operational set behind the room grid and weekly stats
//   (stays not yet over, in-house guests, anything created in the last week).
//   Bounded by room count, not by history size.
// - paged list: server-side search/filters/order for the reservations table.

const RESERVATION_SELECT = {
  id: true,
  status: true,
  check_in_date: true,
  check_out_date: true,
  total_amount: true,
  paid_amount: true,
  company_id: true,
  booker_name: true,
  created_at: true,
  updated_at: true,
  contacts: { select: { name: true } },
  reservation_rooms: { select: { room_id: true, status: true, deleted_at: true, rooms: { select: { number: true } } } },
  reservation_guests: { select: { guest_id: true, full_name: true } },
  reservation_company_info: { select: { company_name: true } },
} as const

// UI booking status -> reservation_status values (see mapReservationStatus).
const STATUS_FILTER = {
  booked: 'draft,held,no_show,expired',
  confirmed: 'confirmed',
  'checked-in': 'checked_in',
  'checked-out': 'checked_out',
  cancelled: 'cancelled',
} as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(Object.keys(STATUS_FILTER) as [keyof typeof STATUS_FILTER]).optional(),
  guestType: z.enum(['company', 'individual']).optional(),
})

const ACTIVE_WINDOW_DAYS = 7

type ReservationRow = Awaited<ReturnType<typeof findReservations>>[number]

function findReservations(where: NonNullable<Parameters<typeof prisma.reservations.findMany>[0]>['where']) {
  return prisma.reservations.findMany({ where, select: RESERVATION_SELECT })
}

function toBoardRow(row: ReservationRow) {
  const { contacts, reservation_rooms, ...rest } = serializeRow('reservations', row) as Record<string, unknown> & {
    contacts: unknown
    reservation_rooms: Array<Record<string, unknown> & { rooms: unknown }>
  }
  return {
    ...rest,
    company: contacts,
    reservation_rooms: reservation_rooms.map(({ rooms, ...rr }) => ({ ...rr, room: rooms })),
  }
}

/** Escapes LIKE wildcards so the search term is matched literally. */
function containsPattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const params = new URL(request.url).searchParams

    if (params.get('scope') === 'active') {
      const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000)
      const rows = await findReservations({
        deleted_at: null,
        OR: [
          { check_out_date: { gte: dbDate(todayDate()) } },
          { status: 'checked_in' },
          { created_at: { gte: since } },
        ],
      })
      return NextResponse.json({ ok: true, data: rows.map(toBoardRow) })
    }

    const parsed = ListQuery.safeParse(Object.fromEntries(params))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { page, pageSize, q, from, to, status, guestType } = parsed.data

    const pageRows = await prisma.$queryRawTyped(
      reservationBoardPage(
        q ? containsPattern(q) : null,
        from ?? null,
        to ?? null,
        status ? STATUS_FILTER[status] : null,
        guestType ?? null,
        pageSize,
        (page - 1) * pageSize,
      ),
    )
    const total = pageRows[0]?.total ?? 0
    const ids = pageRows.flatMap((r) => (r.id ? [r.id] : []))

    // Keep the SQL order: findMany by id does not preserve it.
    const byId = new Map((await findReservations({ id: { in: ids } })).map((row) => [row.id, row]))
    const data = ids.flatMap((id) => {
      const row = byId.get(id)
      return row ? [toBoardRow(row)] : []
    })

    return NextResponse.json({ ok: true, data, total, page, pageSize })
  })
}
