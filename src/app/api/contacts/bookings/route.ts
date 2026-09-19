import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { authorizeRequest } from '@/shared/routeAuth'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { getBookingsByContact } from '@/modules/bookings/services/bookingService'

function optionalInt(value: string | null, min: number, max: number) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}

export async function GET(request: Request) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.READ)
    if (rateLimited.error) return rateLimited.error
    const auth = await authorizeRequest(request, ACTIONS.CONTACTS_READ)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    if (!contactId) {
      return NextResponse.json({ error: 'contacts/missing_contact_id' }, { status: 400 })
    }

    const data = await getBookingsByContact(contactId, searchParams.get('contactType') ?? undefined, {
      year: optionalInt(searchParams.get('year'), 2000, 2100),
      month: optionalInt(searchParams.get('month'), 1, 12),
    })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'contacts/bookings_failed' }, { status: 500 })
  }
}
