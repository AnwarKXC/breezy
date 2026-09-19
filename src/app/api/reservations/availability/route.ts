import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { getRoomAvailability } from '@/services/db/rpc'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const { searchParams } = new URL(request.url)
    const checkIn = searchParams.get('checkIn')
    const checkOut = searchParams.get('checkOut')

    if (!checkIn || !checkOut || !DATE.test(checkIn) || !DATE.test(checkOut)) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'checkIn and checkOut are required (YYYY-MM-DD)' } }, { status: 400 })
    }
    if (checkOut <= checkIn) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'checkOut must be after checkIn' } }, { status: 400 })
    }

    const roomTypeId = searchParams.get('roomTypeId')
    const contactId = searchParams.get('contactId')
    const capacity = searchParams.get('capacity') ? Number(searchParams.get('capacity')) : null
    if ((roomTypeId && !UUID.test(roomTypeId)) || (contactId && !UUID.test(contactId)) || (capacity !== null && !Number.isInteger(capacity))) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid filter' } }, { status: 400 })
    }

    try {
      const data = await getRoomAvailability({ checkIn, checkOut, roomTypeId, capacity, contactId })
      return NextResponse.json(
        { ok: true, data },
        { headers: { 'Cache-Control': 'private, max-age=10' } },
      )
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Availability check failed' } }, { status: 400 })
    }
  })
}
