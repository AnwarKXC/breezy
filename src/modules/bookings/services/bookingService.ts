import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { dbDate, serializeRow } from '@/services/db/rows'
import type { Booking } from '../types'

const CONTACT_BOOKINGS_LIMIT = 50

const RESERVATION_INCLUDE = {
  contacts: { select: { name: true } },
  reservation_rooms: { select: { room_id: true, status: true, deleted_at: true, rooms: { select: { number: true } } } },
  reservation_guests: { select: { guest_id: true, full_name: true, contact_id: true, deleted_at: true } },
  reservation_company_info: { select: { company_name: true } },
} satisfies Prisma.reservationsInclude

/** Prisma row -> the embedded-row shape mapReservationToBooking reads. */
function toBookingSource(row: unknown): Record<string, unknown> {
  const { contacts, reservation_rooms, ...rest } = serializeRow('reservations', row) as Record<string, unknown> & {
    contacts: unknown
    reservation_rooms: Array<Record<string, unknown> & { rooms: unknown }>
  }
  return {
    ...rest,
    company: contacts,
    reservation_rooms: reservation_rooms.map(({ rooms, ...rr }) => ({ ...rr, room: rooms })),
  }
}

/** Map a reservations row (with relations) to a Booking display entry */
function mapReservationToBooking(row: Record<string, unknown>): Booking | null {
  const roomsData = (row.reservation_rooms ?? []) as Array<Record<string, unknown>>
  const activeRooms = roomsData.filter((rr) => {
    const s = rr.status as string
    return !rr.deleted_at && s !== 'cancelled' && s !== 'released'
  })
  if (activeRooms.length === 0) return null

  const guests = ((row.reservation_guests ?? []) as Array<Record<string, unknown>>).filter((g) => !g.deleted_at)
  const companyInfo = row.reservation_company_info as Record<string, unknown> | Array<Record<string, unknown>> | undefined
  const company = row.company as Record<string, unknown> | undefined
  const companyId = row.company_id as string | null | undefined
  const bookerName = row.booker_name as string | null | undefined
  const firstGuest = guests[0]
  const companyName = (
    Array.isArray(companyInfo)
      ? (companyInfo[0]?.company_name as string | undefined)
      : (companyInfo?.company_name as string | undefined)
  ) ?? (company?.name as string | undefined)

  const allRoomNumbers = activeRooms
    .map((rr) => {
      const ri = rr.room as Record<string, unknown> | undefined
      return (ri?.number as string) ?? '—'
    })
    .filter(Boolean)
  const roomCount = activeRooms.length
  const displayRoomNumber =
    roomCount > 1 ? `${allRoomNumbers[0]} +${roomCount - 1}` : (allRoomNumbers[0] ?? '—')

  const hasCompany = Boolean(companyName || companyId)
  const guestType = hasCompany ? 'company' as const : 'individual' as const
  const companyGuestName = hasCompany
    ? (bookerName ?? companyName ?? (firstGuest?.full_name as string) ?? 'Company')
    : (firstGuest?.full_name as string) ?? '—'

  function mapResStatus(s: string): Booking['status'] {
    switch (s) {
      case 'confirmed': return 'confirmed'
      case 'checked_in': return 'checked-in'
      case 'checked_out': return 'checked-out'
      case 'cancelled': return 'cancelled'
      default: return 'booked'
    }
  }

  return {
    id: row.id as string,
    guestId: (firstGuest?.guest_id as string) ?? '',
    guestName: companyGuestName,
    contactId: companyId ?? (firstGuest?.contact_id as string | undefined) ?? undefined,
    roomId: (activeRooms[0]?.room_id as string) ?? '',
    roomNumber: displayRoomNumber,
    checkIn: new Date(row.check_in_date as string),
    checkOut: new Date(row.check_out_date as string),
    status: mapResStatus(row.status as string),
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    reservationId: row.id as string,
    roomCount,
    isSubBooking: false,
    guestType,
  }
}

/**
 * Stays booked under a contact: company reservations by company_id, individual
 * reservations through the guest's contact_id.
 */
export async function getBookingsByContact(
  contactId: string,
  contactType?: string,
  filters: { year?: number; month?: number } = {},
): Promise<Booking[]> {
  const periodRange = buildPeriodRange(filters.year, filters.month)

  const where: Prisma.reservationsWhereInput = { deleted_at: null }
  if (contactType === 'company') {
    where.company_id = contactId
  } else {
    where.reservation_guests = { some: { contact_id: contactId, deleted_at: null } }
  }
  if (periodRange) where.check_in_date = { gte: dbDate(periodRange.start), lt: dbDate(periodRange.end) }

  const rows = await prisma.reservations.findMany({
    where,
    include: RESERVATION_INCLUDE,
    orderBy: { check_in_date: 'desc' },
    take: CONTACT_BOOKINGS_LIMIT,
  })

  return rows
    .map((row) => mapReservationToBooking(toBookingSource(row)))
    .filter((booking): booking is Booking => booking !== null)
}

export function buildPeriodRange(year?: number, month?: number): { start: string; end: string } | null {
  if (!year) return null
  const start = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`
  const endMonth = month ? month + 1 : 13
  const endYear = endMonth > 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, '0')}-01`
  return { start, end }
}
