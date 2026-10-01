import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ACTIONS } from '@/config/rbac'
import { getConversation } from '@/services/ai/history'
import { secureReadEndpoint } from '@/shared/secureEndpoint'

export const dynamic = 'force-dynamic'

/** One of the signed-in admin's conversations (404 for other users' ids). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.AI_CHAT, async (session) => {
    const id = z.uuid().safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ai/invalid_request' }, { status: 400 })
    const conversation = await getConversation(session.id, id.data)
    if (!conversation) return NextResponse.json({ error: 'ai/not_found' }, { status: 404 })
    return NextResponse.json({ data: conversation }, { headers: { 'cache-control': 'no-store' } })
  })
}
