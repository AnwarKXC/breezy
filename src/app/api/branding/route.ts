import { NextResponse } from 'next/server'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { getBranding } from '@/shared/branding/server'

// Public: organization name, logo and contact details are shown on the login
// page and printed on invoices, so no session is required.
export async function GET(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  return NextResponse.json({ data: await getBranding() })
}
