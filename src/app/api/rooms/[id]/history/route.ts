import 'server-only'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import type { reservation_room_status } from '@/generated/prisma/enums'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate, serializeRow, todayDate } from '@/services/db/rows'

const INACTIVE_ROOM_STATUSES: reservation_room_status[] = ['cancelled', 'released']

// Shape kept from the previous API: reservation { ..., guests: [{ full_name }] }
const reservationSelect = {
  select: {
    id: true,
    reservation_number: true,
    status: true,
    check_in_date: true,
    check_out_date: true,
    reservation_guests: { select: { full_name: true } },
  },
} as const

type StayRow = Prisma.reservation_roomsGetPayload<{ include: { reservations: typeof reservationSelect } }>

function mapStay(rr: StayRow): Record<string, unknown> & { reservation: Record<string, unknown> | null } {
  const { reservations, ...rest } = serializeRow('reservation_rooms', rr)
  const stay = reservations as Record<string, unknown> | null
  const reservation = stay ? { ...stay, guests: stay.reservation_guests, reservation_guests: undefined } : null
  return { ...rest, reservation }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.ROOMS_READ, async () => {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 200)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    const room = await prisma.rooms.findFirst({
      where: { id, deleted_at: null },
      include: { room_types: { select: { name: true, slug: true } } },
    })
    if (!room) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Room not found' } }, { status: 404 })
    }

    const historyWhere: Prisma.reservation_roomsWhereInput = {
      room_id: id,
      deleted_at: null,
      status: { notIn: INACTIVE_ROOM_STATUSES },
      ...(fromDate ? { check_in_date: { gte: dbDate(fromDate) } } : {}),
      ...(toDate ? { check_out_date: { lte: dbDate(toDate) } } : {}),
    }

    const [bookingHistory, filteredCount, upcoming, rawStatusTimeline, revenueRooms] = await Promise.all([
      prisma.reservation_rooms.findMany({
        where: historyWhere,
        include: { reservations: reservationSelect },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.reservation_rooms.count({ where: historyWhere }),
      prisma.reservation_rooms.findMany({
        where: {
          room_id: id,
          deleted_at: null,
          status: { not: 'cancelled' },
          reservations: { check_out_date: { gte: dbDate(todayDate()) } },
        },
        include: { reservations: reservationSelect },
        take: 10,
      }),
      prisma.room_status_history.findMany({
        where: { room_id: id },
        orderBy: { changed_at: 'desc' },
        take: 50,
      }),
      prisma.reservation_rooms.findMany({
        where: { room_id: id, deleted_at: null, status: { not: 'cancelled' } },
        select: { rate_per_night: true, check_in_date: true, check_out_date: true },
      }),
    ])

    const statusTimeline = rawStatusTimeline.map((h) => ({
      id: h.id,
      created_at: h.changed_at.toISOString(),
      old_status: h.from_status ?? null,
      new_status: h.to_status,
      notes: h.reason ?? null,
      changed_by: h.changed_by ?? null,
    }))

    const totalRevenue = revenueRooms.reduce((sum, rr) => {
      const nights = Math.max(1, Math.round((rr.check_out_date.getTime() - rr.check_in_date.getTime()) / 86400000))
      return sum + Number(rr.rate_per_night ?? 0) * nights
    }, 0)

    const mappedHistory = bookingHistory.map((rr) => {
      const stay = mapStay(rr)
      return {
        id: stay.id,
        created_at: stay.created_at,
        check_in_date: stay.check_in_date,
        check_out_date: stay.check_out_date,
        status: stay.status,
        notes: 'Reservation stay',
        reservation: stay.reservation,
      }
    })

    return NextResponse.json({
      ok: true,
      data: {
        room: {
          id: room.id,
          number: room.number,
          floor: room.floor,
          status: room.status,
          capacity: room.capacity,
          price: Number(room.price),
          amenities: room.amenities,
          roomType: room.room_types,
        },
        statusHistory: mappedHistory,
        statusTimeline,
        upcomingReservations: upcoming.map(mapStay),
        pagination: { total: filteredCount, limit, offset },
        revenue: {
          total: totalRevenue,
          currency: 'EGP',
          bookingCount: revenueRooms.length,
        },
      },
    })
  })
}
