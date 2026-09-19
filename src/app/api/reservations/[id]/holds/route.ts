import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint, secureReadEndpoint } from '@/shared/secureEndpoint'
import { prisma } from '@/services/db/prisma'
import { toRows } from '@/services/db/rows'
import { createReservationHold } from '@/services/db/rpc'
import { ReservationHoldSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const { id } = await params
    const rows = await prisma.reservation_holds.findMany({ where: { reservation_id: id }, orderBy: { created_at: 'desc' } })
    return NextResponse.json({ ok: true, data: toRows('reservation_holds', rows) })
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_UPDATE_DRAFT, async (session) => {
    const { id } = await params
    const parsed = ReservationHoldSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    const { roomId, checkIn, checkOut } = parsed.data

    let data: unknown
    try {
      data = await createReservationHold(session.id, { roomId, checkIn, checkOut, reservationId: id, holdDurationMinutes: 15 })
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'HOLD_CONFLICT', message: 'Hold creation failed' } }, { status: 409 })
    }

    // create_reservation_hold returns { success, hold_id, room_id, expires_at } or { success: false, error, code }
    const result = data as
      | { success: true; hold_id: string; room_id: string; expires_at: string }
      | { success: false; error?: string; code?: string }
    if (!result?.success) {
      return NextResponse.json({ ok: false, error: { code: result?.code ?? 'HOLD_CONFLICT', message: result?.error ?? 'Hold creation failed' } }, { status: 409 })
    }

    return NextResponse.json(
      { ok: true, data: { holdId: result.hold_id, roomId: result.room_id, expiresAt: result.expires_at } },
      { status: 201 },
    )
  })
}
