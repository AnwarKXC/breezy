import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { isUniqueViolation } from '@/services/db/errors'
import { PlanLimitError } from '@/services/fleet/limits'
import { createRoom, listRooms } from '@/modules/rooms/services/roomServer'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { RoomCreateSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.ROOMS_READ)
  if ('response' in auth) return auth.response

  try {
    const status = new URL(request.url).searchParams.get('status')
    const data = await listRooms(status === 'available' ? { status } : {})
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } })
  } catch {
    return NextResponse.json({ error: 'rooms/fetch_failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  const csrf = validateCsrf(request)
  if (csrf.error) return csrf.error
  const auth = await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
  if ('response' in auth) return auth.response

  const parsed = RoomCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })

  try {
    return NextResponse.json({ data: await createRoom(parsed.data, auth.session.id) }, { status: 201 })
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: `Room number "${parsed.data.number}" already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: 'rooms/create_failed' }, { status: 500 })
  }
}
