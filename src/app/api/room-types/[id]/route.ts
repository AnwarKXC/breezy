import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { getRoomType, updateRoomType, deleteRoomType } from '@/modules/room-types/services'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { RoomTypeUpdateSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.ROOMS_READ)
  if ('response' in auth) return auth.response

  try {
    const { id } = await params
    const data = await getRoomType(id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('auth/') ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
  if ('response' in auth) return auth.response

  try {
    await validateCsrf(request)
    const { id } = await params
    const body = await request.json()
    const parsed = RoomTypeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await updateRoomType(id, parsed.data)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('auth/') ? error.message : 'Internal server error'
    const status = message.includes('permission') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
  if ('response' in auth) return auth.response

  try {
    await validateCsrf(request)
    const { id } = await params
    await deleteRoomType(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('auth/') ? error.message : 'Internal server error'
    const status = message.includes('permission') ? 403 : message.includes('Soft delete is not ready') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
