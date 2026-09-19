import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { isUniqueViolation } from '@/services/db/errors'
import { deleteRoom, getRoom, updateRoom } from '@/modules/rooms/services/roomServer'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { RoomUpdateSchema, zodErrorMessage } from '@/shared/validation'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.ROOMS_READ)
  if ('response' in auth) return auth.response

  try {
    const room = await getRoom((await params).id)
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: room })
  } catch {
    return NextResponse.json({ error: 'rooms/fetch_failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  const csrf = validateCsrf(request)
  if (csrf.error) return csrf.error
  const auth = await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
  if ('response' in auth) return auth.response

  const parsed = RoomUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })

  try {
    const room = await updateRoom((await params).id, parsed.data)
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: room })
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: 'Room number already exists' }, { status: 409 })
    return NextResponse.json({ error: 'rooms/update_failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  const csrf = validateCsrf(request)
  if (csrf.error) return csrf.error
  const auth = await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
  if ('response' in auth) return auth.response

  try {
    const deleted = await deleteRoom((await params).id)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'rooms/delete_failed' }, { status: 500 })
  }
}
