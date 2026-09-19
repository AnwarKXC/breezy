import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ACTIONS } from '@/config/actionPermissions'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { changeRoomStatus } from '@/modules/rooms/services/roomServer'
import { zodErrorMessage } from '@/shared/validation'

const RoomStatusSchema = z.object({
  status: z.enum(['available', 'occupied', 'maintenance', 'cleaning', 'dirty']),
  reason: z.string().trim().max(500).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.ROOMS_STATUS_UPDATE, async (session) => {
    const parsed = RoomStatusSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })

    try {
      const room = await changeRoomStatus({
        roomId: (await params).id,
        status: parsed.data.status,
        reason: parsed.data.reason,
        actorId: session.id,
      })
      if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data: room })
    } catch {
      return NextResponse.json({ error: 'rooms/status_update_failed' }, { status: 500 })
    }
  })
}
