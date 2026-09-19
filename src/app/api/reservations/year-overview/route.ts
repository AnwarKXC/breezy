import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate } from '@/services/db/rows'
import { compareRoomNumber } from '@/modules/reservations/utils/roomColumns'

interface RoomRow {
  id: string
  number: string
  room_type_id: string
  room_types: { id: string; name: string } | null
}

interface StayRow {
  room_id: string
  reservation_id: string
  check_in_date: string
  check_out_date: string
  reservations: { reservation_number: string; status: string; source: string; contacts: { name: string } | null } | null
}

interface GuestRow {
  reservation_id: string
  full_name: string
}

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const { searchParams } = new URL(request.url)
    const yearRaw = searchParams.get('year') ?? ''
    const year = Number(yearRaw)

    if (!/^\d{4}$/.test(yearRaw) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'year must be a 4-digit year between 2000 and 2100' } },
        { status: 400 },
      )
    }

    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    const day = (d: Date) => d.toISOString().slice(0, 10)
    let roomRows: RoomRow[]
    let stayRows: StayRow[]
    let guestRows: GuestRow[]
    try {
      const [rooms, stays] = await Promise.all([
        prisma.rooms.findMany({
          where: { deleted_at: null },
          select: { id: true, number: true, room_type_id: true, room_types: { select: { id: true, name: true } } },
        }),
        prisma.reservation_rooms.findMany({
          where: {
            deleted_at: null,
            check_in_date: { lte: dbDate(yearEnd) },
            check_out_date: { gte: dbDate(yearStart) },
            reservations: { deleted_at: null },
          },
          select: {
            room_id: true,
            reservation_id: true,
            check_in_date: true,
            check_out_date: true,
            reservations: { select: { reservation_number: true, status: true, source: true, contacts: { select: { name: true } } } },
          },
        }),
      ])
      roomRows = rooms
      stayRows = stays.map((s) => ({
        room_id: s.room_id,
        reservation_id: s.reservation_id,
        check_in_date: day(s.check_in_date),
        check_out_date: day(s.check_out_date),
        reservations: s.reservations,
      }))
      // Only the primary guests of this year's stays (used to be every guest in the DB).
      guestRows = await prisma.reservation_guests.findMany({
        where: { is_primary: true, deleted_at: null, reservation_id: { in: [...new Set(stays.map((s) => s.reservation_id))] } },
        select: { reservation_id: true, full_name: true },
      })
    } catch (error) {
      console.error('[year-overview]', error)
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Failed to load year overview' } },
        { status: 500 },
      )
    }

    const guestByReservation = new Map(guestRows.map((g) => [g.reservation_id, g.full_name]))

    const typeNameByTypeId = new Map<string, string>()
    for (const room of roomRows) {
      if (room.room_types) typeNameByTypeId.set(room.room_type_id, room.room_types.name)
    }

    // Strict numeric room-number order; consumers span the type header over runs of
    // consecutive same-type rooms.
    const rooms = roomRows
      .map((room) => ({ id: room.id, number: room.number, typeId: room.room_type_id }))
      .sort((a, b) => compareRoomNumber(a.number, b.number))

    const roomTypes = [...typeNameByTypeId.entries()]
      .map(([id, name]) => ({ id, name }))
      .filter((rt) => rooms.some((r) => r.typeId === rt.id))
      .sort((a, b) => a.name.localeCompare(b.name))

    const stays = stayRows.map((row) => ({
      roomId: row.room_id,
      reservationId: row.reservation_id,
      code: row.reservations?.reservation_number ?? '',
      status: row.reservations?.status ?? '',
      from: row.check_in_date,
      to: row.check_out_date,
      guestName: guestByReservation.get(row.reservation_id) ?? null,
      source: row.reservations?.source ?? '',
      companyName: row.reservations?.contacts?.name ?? null,
    }))

    return NextResponse.json({ ok: true, data: { year, roomTypes, rooms, stays } })
  })
}
