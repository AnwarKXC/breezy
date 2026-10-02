import { NextResponse } from 'next/server'
import { rateLimit, RateLimitTier } from '@/shared/rateLimit'
import { prisma } from '@/services/db/prisma'
import { isControlPlaneRequest } from '@/services/fleet/config'
import { getInstanceReport } from '@/services/fleet/health'

const NO_STORE = { 'Cache-Control': 'no-store' }

// Public: liveness for uptime monitors ({ status } only).
// With `Authorization: Bearer <FLEET_INSTANCE_SECRET>`: the full instance report
// the control plane pulls (version, migrations, usage counts, license).
export async function GET(request: Request) {
  const rateLimited = rateLimit(request, RateLimitTier.READ)
  if (rateLimited.error) return rateLimited.error

  try {
    if (isControlPlaneRequest(request)) {
      return NextResponse.json({ status: 'ok', data: await getInstanceReport() }, { headers: NO_STORE })
    }
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503, headers: NO_STORE })
  }
}
