import type { RateLimitStore } from './rateLimit'

export function createKVRateLimitStore(redis: {
  eval: (script: string, keys: string[], args: (string | number)[]) => Promise<unknown>
}): RateLimitStore {
  return {
    async increment(key: string, windowMs: number) {
      const now = Date.now()
      const result = (await redis.eval(SCRIPT, [`rl:${key}`], [windowMs, now])) as [number, number]
      return { count: result[0], resetAt: result[1] }
    },
  }
}

const SCRIPT = `
  local key = KEYS[1]
  local window = tonumber(ARGV[1])
  local now = tonumber(ARGV[2])
  local reset_at = now + window
  local current = redis.call("get", key)
  if not current or tonumber(current) == 0 then
    redis.call("set", key, 1, "EX", math.ceil(window / 1000))
    return {1, reset_at}
  else
    local count = redis.call("incr", key)
    redis.call("expire", key, math.ceil(window / 1000))
    return {count, reset_at}
  end
`

export async function createRateLimitStoreFromEnv(): Promise<RateLimitStore | null> {
  const kvUrl = process.env.KV_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

  if (!kvUrl || !kvToken) return null

  try {
    const { Redis } = await import(/* @vite-ignore */ '@upstash/redis' as string)
    const redis = new (Redis as unknown as new (opts: { url: string; token: string }) => { eval: (script: string, keys: string[], args: (string | number)[]) => Promise<unknown> })({ url: kvUrl, token: kvToken })
    return createKVRateLimitStore(redis)
  } catch {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[rateLimitStore] @upstash/redis not available, KV rate limiting disabled')
    }
    return null
  }
}
