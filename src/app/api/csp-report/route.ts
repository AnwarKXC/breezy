import { NextResponse } from 'next/server'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'

export async function POST(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error

  try {
    const report = await request.json()
    console.warn('[CSP Violation]', JSON.stringify(report))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
