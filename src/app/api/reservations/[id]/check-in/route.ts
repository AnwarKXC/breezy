import 'server-only'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { checkInReservation } from '@/modules/reservations/services/checkInServer'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_CHECK_IN, async (session) =>
    checkInReservation({
      reservationId: (await params).id,
      actorId: session.id,
      allowedFrom: ['draft', 'held', 'confirmed'],
      invalidStatusResponse: { code: 'INVALID_STATUS_TRANSITION', message: 'Only draft, held, or confirmed reservations can be checked in' },
    }),
  )
}
