import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { isControlPlaneRequest } from '@/services/fleet/config'
import { getLicenseStatus, installLicense } from '@/services/fleet/license'

// Control-plane only (Bearer FLEET_INSTANCE_SECRET); not used by the hotel UI.
// No CSRF check: there is no cookie session here, the bearer secret is the credential.

const LicenseBodySchema = z.object({ token: z.string().min(1).max(4096) })

export async function GET(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error
  if (!isControlPlaneRequest(request)) return NextResponse.json(null, { status: 401 })

  return NextResponse.json({ data: await getLicenseStatus() })
}

export async function PUT(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.MUTATION)
  if (rateLimited.error) return rateLimited.error
  if (!isControlPlaneRequest(request)) return NextResponse.json(null, { status: 401 })

  const parsed = LicenseBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'license/invalid_body' }, { status: 400 })

  try {
    const status = await installLicense(parsed.data.token)
    if (!status) return NextResponse.json({ error: 'license/invalid_token' }, { status: 422 })
    return NextResponse.json({ data: status })
  } catch {
    return NextResponse.json({ error: 'license/store_failed' }, { status: 500 })
  }
}
