import { NextResponse } from 'next/server'

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>
}

const legacyStore = new Map<string, { count: number; resetAt: number }>()

export const RateLimitTier = {
  AUTH: { maxRequests: 5, windowMs: 60_000 },
  MUTATION: { maxRequests: 30, windowMs: 60_000 },
  READ: { maxRequests: 100, windowMs: 60_000 },
  ANALYTICS: { maxRequests: 20, windowMs: 60_000 },
} as const

export function rateLimit(request: Request, tier: { maxRequests: number; windowMs: number }): { error?: NextResponse } {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const key = `rl:${ip}`
  const now = Date.now()
  const entry = legacyStore.get(key)

  if (!entry || now >= entry.resetAt) {
    legacyStore.set(key, { count: 1, resetAt: now + tier.windowMs })
    return {}
  }

  if (entry.count >= tier.maxRequests) {
    return {
      error: NextResponse.json(
        { error: 'auth/rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } },
      ),
    }
  }

  entry.count++
  return {}
}

export async function rateLimitWithStore(
  request: Request,
  tier: { maxRequests: number; windowMs: number },
  store: RateLimitStore,
): Promise<{ error?: NextResponse }> {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'

  const { count, resetAt } = await store.increment(`rl:${ip}`, tier.windowMs)

  if (count > tier.maxRequests) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return {
      error: NextResponse.json(
        { error: 'auth/rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } },
      ),
    }
  }

  return {}
}
