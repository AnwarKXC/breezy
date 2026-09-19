import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/actionPermissions'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'

const CLEAN_AFTER_MS = 2 * 60 * 60 * 1000

// Rooms left dirty/cleaning for 2 hours are marked clean. rooms.status is derived
// by the rooms_sync_status trigger, so history logs the before/after summary.
export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.SETTINGS_WRITE, async (session) => {
    try {
      const cleaned = await prisma.$transaction(async (tx) => {
        const stale = {
          deleted_at: null,
          housekeeping_status: { in: ['dirty' as const, 'cleaning' as const] },
          updated_at: { lte: new Date(Date.now() - CLEAN_AFTER_MS) },
        }
        const before = await tx.rooms.findMany({ where: stale, select: { id: true, status: true } })
        if (before.length === 0) return []

        const ids = before.map((room) => room.id)
        await tx.rooms.updateMany({ where: { ...stale, id: { in: ids } }, data: { housekeeping_status: 'clean' } })
        const after = await tx.rooms.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } })
        const newStatus = new Map(after.map((room) => [room.id, room.status]))

        await tx.room_status_history.createMany({
          data: before.filter((room) => newStatus.get(room.id) !== room.status).map((room) => ({
            room_id: room.id,
            from_status: room.status,
            to_status: newStatus.get(room.id) ?? room.status,
            reason: 'Auto-cleaned after 2-hour timer',
            changed_by: session.id,
          })),
        })

        return before.map((room) => ({ room_id: room.id, old_status: room.status, new_status: newStatus.get(room.id) ?? room.status }))
      })
      return NextResponse.json({ ok: true, data: { cleaned, count: cleaned.length } })
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'AUTO_CLEAN_FAILED', message: 'Auto-clean failed' } }, { status: 500 })
    }
  })
}
