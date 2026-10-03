import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import type { ReservationActivityEvent } from '@/modules/reservations/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const actorSelect = { select: { name: true, role: true } } as const

// Admin-only "who did what" trail for one reservation, merged from the tables
// that already record an actor. Kept out of the main detail payload so other
// roles never receive actor data.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_VIEW_AUDIT, async () => {
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid reservation id' } }, { status: 400 })
    }

    const [history, overrides, extras] = await Promise.all([
      prisma.reservation_status_history.findMany({ where: { reservation_id: id }, include: { profiles: actorSelect } }),
      prisma.price_override_audit_log.findMany({
        where: { reservation_id: id },
        include: { users: { select: { profiles: actorSelect } }, rooms: { select: { number: true } } },
      }),
      prisma.reservation_pricing_items.findMany({
        where: { reservation_id: id, pricing_level: 'extra' },
        include: { profiles: actorSelect },
      }),
    ])

    const events: ReservationActivityEvent[] = [
      ...history.map((h): ReservationActivityEvent => ({
        id: h.id,
        at: h.changed_at.toISOString(),
        kind: h.from_status == null ? 'created' : h.from_status === h.to_status ? 'stay_change' : 'status',
        status: h.to_status,
        detail: h.reason,
        actor: h.profiles,
      })),
      ...overrides.map((o): ReservationActivityEvent => ({
        id: o.id,
        at: o.created_at.toISOString(),
        kind: 'price_change',
        detail: `${o.rooms.number}: ${Number(o.old_rate)} → ${Number(o.new_rate)} · ${o.reason}`,
        actor: o.users.profiles,
      })),
      ...extras.map((e): ReservationActivityEvent => ({
        id: e.id,
        at: e.created_at.toISOString(),
        kind: 'extra_charge',
        detail: `${e.manual_override_reason ?? ''} · ${Number(e.total_amount)} ${e.currency}`,
        actor: e.profiles,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at))

    return NextResponse.json({ ok: true, data: events })
  })
}
