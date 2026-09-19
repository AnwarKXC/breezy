import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { serializeRow } from '@/services/db/rows'

const MAX_ROWS = 1000

// Reservations list for the Reservations page, in the embedded-row shape the
// board mapper (src/services/bookingService.ts) reads.
export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit')) || 500, 1), MAX_ROWS)

    const rows = await prisma.reservations.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
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
      },
    })

    const data = rows.map((row) => {
      const { contacts, reservation_rooms, ...rest } = serializeRow('reservations', row) as Record<string, unknown> & {
        contacts: unknown
        reservation_rooms: Array<Record<string, unknown> & { rooms: unknown }>
      }
      return {
        ...rest,
        company: contacts,
        reservation_rooms: reservation_rooms.map(({ rooms, ...rr }) => ({ ...rr, room: rooms })),
      }
    })

    return NextResponse.json({ ok: true, data })
  })
}
