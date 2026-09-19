import { NextResponse } from 'next/server'
import { validateCsrf } from '@/shared/csrf'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS } from '@/config/actionPermissions'
import { updatePricing, deletePricing } from '@/modules/pricing/services'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { PricingUpdateSchema, zodErrorMessage } from '@/shared/validation'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, ACTIONS.SETTINGS_WRITE)
  if ('response' in auth) return auth.response

  try {
    await validateCsrf(request)
    const { id } = await params
    const body = await request.json()
    const parsed = PricingUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await updatePricing(id, parsed.data)
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
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
    await deletePricing(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
