import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { dbDate } from '@/services/db/rows'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const day = (d: Date) => d.toISOString().slice(0, 10)

// Mirrors the reservation_rooms_no_overlap exclusion constraint: per-room stay
// dates as a half-open range [check_in, check_out), counting only these statuses.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId') ?? ''
    const checkIn = searchParams.get('checkIn') ?? ''
    const checkOut = searchParams.get('checkOut') ?? ''
    if (!UUID.test(id) || !UUID.test(roomId) || !DATE.test(checkIn) || !DATE.test(checkOut) || checkOut <= checkIn) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid extension query' } }, { status: 400 })
    }

    const overlapping = await prisma.reservation_rooms.findMany({
      where: {
        room_id: roomId,
        reservation_id: { not: id },
        status: { in: ['held', 'reserved', 'occupied'] },
        deleted_at: null,
        check_in_date: { lt: dbDate(checkOut) },
        check_out_date: { gt: dbDate(checkIn) },
      },
      select: { reservation_id: true, check_in_date: true, check_out_date: true },
    })

    const conflicts = overlapping.map((rr) => ({
      source: 'reservation' as const,
      id: rr.reservation_id,
      checkIn: day(rr.check_in_date),
      checkOut: day(rr.check_out_date),
    }))
    return NextResponse.json({ ok: true, data: { ok: conflicts.length === 0, conflicts: conflicts.length ? conflicts : undefined } })
  })
}
