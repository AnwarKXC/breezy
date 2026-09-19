import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { zodErrorMessage } from '@/shared/validation'
import { isUniqueViolation } from '@/services/db/errors'
import { addReservationGuest, ReservationGuestSchema } from '@/modules/reservations/services/guestServer'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_UPDATE_DRAFT, async () => {
    const parsed = ReservationGuestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: zodErrorMessage(parsed.error) } }, { status: 400 })
    }
    try {
      const result = await addReservationGuest((await params).id, parsed.data)
      if (!result.ok) return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status })
      return NextResponse.json({ ok: true, data: result.data }, { status: 201 })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ ok: false, error: { code: 'RESERVATION_CONFLICT', message: 'This reservation already has a primary guest' } }, { status: 409 })
      }
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Failed to add guest' } }, { status: 400 })
    }
  })
}
