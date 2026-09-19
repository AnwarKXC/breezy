import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPriceOverrides, upsertPriceOverrides } from '@/modules/contacts/services/priceOverrideService'
import { ACTIONS } from '@/config/rbac'
import { authorizeRequest } from '@/shared/routeAuth'
import { validateCsrf } from '@/shared/csrf'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { PriceOverrideSchema } from '@/shared/validation'

interface PriceOverrideRouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: PriceOverrideRouteContext) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.READ)
    if (rateLimited.error) return rateLimited.error
    const auth = await authorizeRequest(request, ACTIONS.CONTACTS_READ)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const overrides = await getPriceOverrides(id)
    return NextResponse.json({ data: overrides })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'contacts/request_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request, context: PriceOverrideRouteContext) {
  try {
    const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
    if (rateLimited.error) return rateLimited.error
    const csrf = validateCsrf(request)
    if (csrf.error) return csrf.error

    const auth = await authorizeRequest(request, ACTIONS.CONTACTS_PRICE_OVERRIDES_UPDATE)
    if ('response' in auth) return auth.response

    const { id } = await context.params
    const body = await request.json()
    const mapped = (body.overrides ?? []).map((o: Record<string, unknown>) => ({
      room_category: o.roomCategory,
      occupancy_code: o.occupancyCode,
      price: o.price,
      currency: o.currency,
    }))
    const validated = z.array(PriceOverrideSchema).parse(mapped)
    const overrides = validated.map((o) => ({
      contactId: id,
      roomCategory: o.room_category,
      occupancyCode: o.occupancy_code,
      price: o.price,
      currency: o.currency,
    }))
    const result = await upsertPriceOverrides(id, overrides)
    return NextResponse.json({ data: result, message: 'Price overrides updated' })
  } catch (error) {
    console.error('price-overrides PUT error:', error)
    let message: string
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      message = String((error as { message: unknown }).message)
    } else {
      message = 'contacts/request_failed'
    }
    return NextResponse.json({
      error: message,
      detail: error instanceof Error ? error.stack : typeof error === 'object' && error !== null ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error),
    }, { status: 500 })
  }
}
