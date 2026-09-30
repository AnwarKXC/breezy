import { NextResponse } from 'next/server'
import { z } from 'zod'

import { resetPassword } from '@/services/auth/passwordReset'
import { validateCsrf } from '@/shared/csrf'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'

const confirmSchema = z.object({
  token: z.string().min(20).max(128),
  password: z.string().min(8).max(256),
})

export async function POST(request: Request) {
  const csrf = validateCsrf(request)
  if (csrf.error) return csrf.error

  const rateLimited = rateLimit(request, RateLimitTier.AUTH)
  if (rateLimited.error) return rateLimited.error

  const parsed = confirmSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'auth/invalid_form' }, { status: 400 })

  try {
    const ok = await resetPassword(parsed.data.token, parsed.data.password)
    if (!ok) return NextResponse.json({ error: 'auth/invalid_reset_link' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'auth/service_unavailable' }, { status: 503 })
  }
}
