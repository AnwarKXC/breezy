import { NextResponse } from 'next/server'

import { ACTIONS } from '@/config/rbac'
import { listConversations } from '@/services/ai/history'
import { secureReadEndpoint } from '@/shared/secureEndpoint'

export const dynamic = 'force-dynamic'

/** The signed-in admin's own recent assistant conversations. */
export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.AI_CHAT, async (session) => {
    return NextResponse.json({ data: await listConversations(session.id) }, { headers: { 'cache-control': 'no-store' } })
  })
}
