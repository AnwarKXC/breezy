import { NextResponse } from 'next/server'

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>
}

const legacyStore = new Map<string, { count: number; resetAt: number }>()

const MAX_TRACKED_KEYS = 10_000

export const RateLimitTier = {
  AUTH: { name: 'auth', maxRequests: 5, windowMs: 60_000 },
  MUTATION: { name: 'mutation', maxRequests: 30, windowMs: 60_000 },
  READ: { name: 'read', maxRequests: 100, windowMs: 60_000 },
  ANALYTICS: { name: 'analytics', maxRequests: 20, windowMs: 60_000 },
  AI: { name: 'ai', maxRequests: 10, windowMs: 60_000 },
} as const

type Tier = { name: string; maxRequests: number; windowMs: number }

/**
 * x-real-ip is set by the hosting proxy. Otherwise the LAST x-forwarded-for hop is
 * the one appended by our nearest proxy; earlier entries are client-supplied and
 * would let callers pick a fresh bucket per request.
 */
function clientIp(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const hops = request.headers.get('x-forwarded-for')?.split(',').map((hop) => hop.trim()).filter(Boolean)
  return hops?.at(-1) ?? 'unknown'
}

function pruneExpired(now: number) {
  for (const [key, entry] of legacyStore) {
    if (now >= entry.resetAt) legacyStore.delete(key)
  }
}

export function rateLimit(request: Request, tier: Tier): { error?: NextResponse } {
  // Separate bucket per tier: dashboard reads must not use up the login allowance.
  const key = `rl:${tier.name}:${clientIp(request)}`
  const now = Date.now()
  const entry = legacyStore.get(key)

  if (!entry || now >= entry.resetAt) {
    if (legacyStore.size >= MAX_TRACKED_KEYS) pruneExpired(now)
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
  tier: Tier,
  store: RateLimitStore,
): Promise<{ error?: NextResponse }> {
  const { count, resetAt } = await store.increment(`rl:${tier.name}:${clientIp(request)}`, tier.windowMs)

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
