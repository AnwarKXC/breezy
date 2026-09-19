import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { listPricing, createPricing } from '@/modules/pricing/services'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { PricingCreateSchema } from '@/shared/validation'
import type { TablesInsert } from '@/services/db/rowTypes'

export async function GET(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.ROOMS_READ)
  if ('response' in auth) return auth.response

  try {
    const data = await listPricing()
    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
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
    const input = PricingCreateSchema.parse(body) as TablesInsert<'room_type_pricing'>
    const data = await createPricing(input)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
