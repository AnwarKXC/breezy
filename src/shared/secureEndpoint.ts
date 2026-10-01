import 'server-only'
import { NextResponse } from 'next/server'
import { authorizeRequest } from '@/shared/routeAuth'
import { validateCsrf } from '@/shared/csrf'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import type { ActionPermission } from '@/config/rbac'
import type { VerifiedSession } from '@/services/auth/serverSession'

type SecureHandler = (session: VerifiedSession) => Promise<NextResponse>

export async function secureReadEndpoint(request: Request, action: ActionPermission, handler: SecureHandler) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  const auth = await authorizeRequest(request, action)
  if ('response' in auth) return auth.response
  return handler(auth.session)
}

export async function secureMutationEndpoint(
  request: Request,
  action: ActionPermission,
  handler: SecureHandler,
  tier: (typeof RateLimitTier)[keyof typeof RateLimitTier] = RateLimitTier.MUTATION,
) {
  const rateLimited = rateLimit(request, tier)
  if (rateLimited.error) return rateLimited.error

  const draftResponse = NextResponse.next()
  const csrf = validateCsrf(request, draftResponse)
  if (csrf.error) return csrf.error

  const auth = await authorizeRequest(request, action)
  if ('response' in auth) return auth.response

  const handlerResponse = await handler(auth.session)

  if (csrf.response) {
    for (const { name, value } of csrf.response.cookies.getAll()) {
      handlerResponse.cookies.set(name, value)
    }
  }

  return handlerResponse
}
