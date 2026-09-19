import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/actionPermissions'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { withActor } from '@/services/db/prisma'

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async (session) => {
    try {
      const cleaned = await withActor(session.id, (tx) =>
        tx.$queryRaw<Array<{ room_id: string; old_status: string; new_status: string }>>`select * from public.auto_clean_dirty_rooms()`,
      )
      return NextResponse.json({ ok: true, data: { cleaned, count: cleaned.length } })
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'RPC_ERROR', message: 'Auto-clean failed' } }, { status: 500 })
    }
  })
}
