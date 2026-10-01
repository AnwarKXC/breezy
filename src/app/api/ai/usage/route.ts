import { NextResponse } from 'next/server'

import { ACTIONS } from '@/config/rbac'
import { getUsageSummary } from '@/services/ai/history'
import { secureReadEndpoint } from '@/shared/secureEndpoint'

export const dynamic = 'force-dynamic'

/** Token budget and 30-day assistant usage of the signed-in admin. */
export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.AI_CHAT, async (session) => {
    return NextResponse.json({ data: await getUsageSummary(session.id) }, { headers: { 'cache-control': 'no-store' } })
  })
}
