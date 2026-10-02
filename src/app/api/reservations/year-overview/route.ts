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
  adults: number
  children: number
  rate_per_night: number
  total_amount: number
  reservations: {
    reservation_number: string
    status: string
    source: string
    currency: string
    nights: number
    total_amount: number
    paid_amount: number
    balance_amount: number
    special_requests: string | null
    contacts: { name: string } | null
  } | null
}

interface GuestRow {
  reservation_id: string
  full_name: string
  phone: string | null
  is_vip: boolean
}

const NOTE_MAX = 160

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
            adults: true,
            children: true,
            rate_per_night: true,
            total_amount: true,
            reservations: {
              select: {
                reservation_number: true,
                status: true,
                source: true,
                currency: true,
                nights: true,
                total_amount: true,
                paid_amount: true,
                balance_amount: true,
                special_requests: true,
                contacts: { select: { name: true } },
              },
            },
          },
        }),
      ])
      roomRows = rooms
      stayRows = stays.map((s) => ({
        room_id: s.room_id,
        reservation_id: s.reservation_id,
        check_in_date: day(s.check_in_date),
        check_out_date: day(s.check_out_date),
        adults: s.adults,
        children: s.children,
        rate_per_night: Number(s.rate_per_night),
        total_amount: Number(s.total_amount),
        reservations: s.reservations && {
          ...s.reservations,
          total_amount: Number(s.reservations.total_amount),
          paid_amount: Number(s.reservations.paid_amount),
          balance_amount: Number(s.reservations.balance_amount),
        },
      }))
      // Only the primary guests of this year's stays (used to be every guest in the DB).
      guestRows = await prisma.reservation_guests.findMany({
        where: { is_primary: true, deleted_at: null, reservation_id: { in: [...new Set(stays.map((s) => s.reservation_id))] } },
        select: { reservation_id: true, full_name: true, phone: true, is_vip: true },
      })
    } catch (error) {
      console.error('[year-overview]', error)
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Failed to load year overview' } },
        { status: 500 },
      )
    }

    const guestByReservation = new Map(guestRows.map((g) => [g.reservation_id, g]))

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

    const stays = stayRows.map((row) => {
      const reservation = row.reservations
      const guest = guestByReservation.get(row.reservation_id)
      const note = reservation?.special_requests?.trim() || null
      return {
        roomId: row.room_id,
        reservationId: row.reservation_id,
        code: reservation?.reservation_number ?? '',
        status: reservation?.status ?? '',
        from: row.check_in_date,
        to: row.check_out_date,
        guestName: guest?.full_name ?? null,
        source: reservation?.source ?? '',
        companyName: reservation?.contacts?.name ?? null,
        details: {
          currency: reservation?.currency ?? '',
          ratePerNight: row.rate_per_night,
          roomTotal: row.total_amount,
          reservationTotal: reservation?.total_amount ?? 0,
          paid: reservation?.paid_amount ?? 0,
          balance: reservation?.balance_amount ?? 0,
          reservationNights: reservation?.nights ?? 0,
          adults: row.adults,
          children: row.children,
          phone: guest?.phone ?? null,
          isVip: guest?.is_vip ?? false,
          note: note && note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX - 1)}…` : note,
        },
      }
    })

    return NextResponse.json({ ok: true, data: { year, roomTypes, rooms, stays } })
  })
}
