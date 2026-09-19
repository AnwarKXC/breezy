import 'server-only'

import { z } from 'zod'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { toRow } from '@/services/db/rows'

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

export const ReservationGuestSchema = z.object({
  reservation_room_id: z.string().uuid().nullable().optional(),
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(300).nullable().optional().or(z.literal('').transform(() => null)),
  phone: optionalText(40),
  document_type: optionalText(50),
  document_number: optionalText(100),
  nationality: optionalText(100),
  role: z.enum(['primary_guest', 'additional_guest', 'company_guest', 'child']).optional(),
  is_primary: z.boolean().optional(),
  is_vip: z.boolean().optional(),
})

export const ReservationGuestUpdateSchema = ReservationGuestSchema.omit({ reservation_room_id: true }).partial()

export type GuestResult =
  | { ok: true; data: ReturnType<typeof toRow<'reservation_guests'>> }
  | { ok: false; status: number; code: string; message: string }

function occupancyCapacity(code: string | null) {
  return code === 'T' ? 3 : code === 'D' ? 2 : code === 'S' ? 1 : null
}

export async function addReservationGuest(
  reservationId: string,
  input: z.infer<typeof ReservationGuestSchema>,
): Promise<GuestResult> {
  const reservation = await prisma.reservations.findFirst({ where: { id: reservationId, deleted_at: null }, select: { id: true } })
  if (!reservation) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Reservation not found' }

  if (input.reservation_room_id) {
    const room = await prisma.reservation_rooms.findFirst({
      where: { id: input.reservation_room_id, reservation_id: reservationId, deleted_at: null },
      select: { occupancy_code: true, room_id: true, rooms: { select: { capacity: true } } },
    })
    if (!room) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Room not found in reservation' }

    const capacity = occupancyCapacity(room.occupancy_code) ?? room.rooms?.capacity ?? null
    if (capacity) {
      const count = await prisma.reservation_guests.count({ where: { reservation_room_id: input.reservation_room_id, deleted_at: null } })
      if (count >= capacity) {
        return { ok: false, status: 409, code: 'OCCUPANCY_EXCEEDED', message: `Room capacity (${capacity} guests) reached` }
      }
    }
  }

  const data: Prisma.reservation_guestsUncheckedCreateInput = {
    reservation_id: reservationId,
    reservation_room_id: input.reservation_room_id ?? null,
    full_name: input.full_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    document_type: input.document_type ?? null,
    document_number: input.document_number ?? null,
    nationality: input.nationality ?? null,
    is_primary: input.is_primary ?? false,
    is_vip: input.is_vip ?? false,
    ...(input.role ? { role: input.role } : {}),
  }
  const row = await prisma.reservation_guests.create({ data })
  return { ok: true, data: toRow('reservation_guests', row) }
}

export async function updateReservationGuest(
  reservationId: string,
  guestId: string,
  input: z.infer<typeof ReservationGuestUpdateSchema>,
): Promise<GuestResult> {
  const { count } = await prisma.reservation_guests.updateMany({
    where: { id: guestId, reservation_id: reservationId, deleted_at: null },
    data: input,
  })
  if (count === 0) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Guest not found' }
  const row = await prisma.reservation_guests.findUniqueOrThrow({ where: { id: guestId } })
  return { ok: true, data: toRow('reservation_guests', row) }
}

export async function removeReservationGuest(reservationId: string, guestId: string): Promise<boolean> {
  const { count } = await prisma.reservation_guests.updateMany({
    where: { id: guestId, reservation_id: reservationId, deleted_at: null },
    data: { deleted_at: new Date() },
  })
  return count > 0
}
