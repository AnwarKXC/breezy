import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { zodErrorMessage } from '@/shared/validation'
import { isUniqueViolation } from '@/services/db/errors'
import {
  removeReservationGuest,
  ReservationGuestUpdateSchema,
  updateReservationGuest,
} from '@/modules/reservations/services/guestServer'

type Context = { params: Promise<{ id: string; guestId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_UPDATE_DRAFT, async () => {
    const parsed = ReservationGuestUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    try {
      const { id, guestId } = await params
      const result = await updateReservationGuest(id, guestId, parsed.data)
      if (!result.ok) return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status })
      return NextResponse.json({ ok: true, data: result.data })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ ok: false, error: { code: 'RESERVATION_CONFLICT', message: 'This reservation already has a primary guest' } }, { status: 409 })
      }
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Failed to update guest' } }, { status: 400 })
    }
  })
}

export async function DELETE(request: Request, { params }: Context) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_UPDATE_DRAFT, async () => {
    const { id, guestId } = await params
    const removed = await removeReservationGuest(id, guestId)
    if (!removed) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } }, { status: 404 })
    return NextResponse.json({ ok: true })
  })
}
