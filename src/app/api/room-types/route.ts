import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { listRoomTypes, createRoomType } from '@/modules/room-types/services'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { RoomTypeCreateSchema } from '@/shared/validation'
import type { TablesInsert } from '@/services/db/rowTypes'

export async function GET(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.ROOMS_READ)
  if ('response' in auth) return auth.response

  try {
    const data = await listRoomTypes()
    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
  if ('response' in auth) return auth.response

  try {
    await validateCsrf(request)
    const body = await request.json()
    const input = RoomTypeCreateSchema.parse(body) as TablesInsert<'room_types'>
    const data = await createRoomType(input)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('permission') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
