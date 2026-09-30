import { after, NextResponse } from 'next/server'
import { z } from 'zod'

import { requestPasswordReset } from '@/services/auth/passwordReset'
import { validateCsrf } from '@/shared/csrf'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(['en', 'ar']).default('en'),
})

// Links must point at our own host, never at a spoofable Host header.
function getAppUrl(request: Request) {
  const configured = process.env.APP_URL?.replace(/\/+$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') return null
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  const csrf = validateCsrf(request)
  if (csrf.error) return csrf.error

  const rateLimited = rateLimit(request, RateLimitTier.AUTH)
  if (rateLimited.error) return rateLimited.error

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'auth/invalid_form' }, { status: 400 })

  const appUrl = getAppUrl(request)
  if (!appUrl) return NextResponse.json({ error: 'auth/service_unavailable' }, { status: 503 })

  // Sent in the background with the same reply for every address, so neither the
  // body nor the response time reveals which accounts exist.
  const { email, locale } = parsed.data
  after(() =>
    requestPasswordReset(email, appUrl, locale).catch((error) => {
      console.error('[password-reset] request failed', error)
    }),
  )

  return NextResponse.json({ ok: true })
}
