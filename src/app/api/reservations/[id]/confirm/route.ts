import 'server-only'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { checkInReservation } from '@/modules/reservations/services/checkInServer'

// "Confirm stay" in the UI: a draft/held reservation whose arrival date has
// come is checked in directly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.RESERVATIONS_CONFIRM, async (session) =>
    checkInReservation({
      reservationId: (await params).id,
      actorId: session.id,
      allowedFrom: ['draft', 'held'],
      invalidStatusResponse: { code: 'INVALID_STATUS', message: 'Reservation must be in draft or held status' },
      requireArrivalDate: true,
    }),
  )
}
