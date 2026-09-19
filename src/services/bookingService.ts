import type { Booking } from '@/modules/bookings/types'

function mapReservationStatus(status: string): Booking['status'] {
  switch (status) {
    case 'confirmed': return 'confirmed'
    case 'checked_in': return 'checked-in'
    case 'checked_out': return 'checked-out'
    case 'cancelled': return 'cancelled'
    default: return 'booked'
  }
}

function mapReservationToBooking(row: Record<string, unknown>): Booking[] {
  const reservationId = row.id as string
  const rooms = row.reservation_rooms as Array<Record<string, unknown>> | undefined
  const guests = row.reservation_guests as Array<Record<string, unknown>> | undefined
  const rawCompanyInfo = row.reservation_company_info as Record<string, unknown> | Array<Record<string, unknown>> | undefined
  const company = row.company as Record<string, unknown> | undefined
  const companyId = row.company_id as string | null | undefined
  const bookerName = row.booker_name as string | null | undefined
  const firstGuest = guests?.[0]
  const companyName = (
    Array.isArray(rawCompanyInfo)
      ? (rawCompanyInfo[0]?.company_name as string | undefined)
      : (rawCompanyInfo?.company_name as string | undefined)
  ) ?? (company?.name as string | undefined)
  const hasCompany = Boolean(companyName || companyId)
  const reservationCancelled = (row.status as string) === 'cancelled'
  const activeRooms = (rooms ?? []).filter((r: Record<string, unknown>) => {
    const rrDeleted = r.deleted_at as string | null
    if (rrDeleted) return false
    if (reservationCancelled) return true
    const rrStatus = r.status as string
    return rrStatus !== 'cancelled' && rrStatus !== 'released'
  })
  const allRoomNumbers = activeRooms
    .map((r: Record<string, unknown>) => {
      const roomInfo = r.room as Record<string, unknown> | undefined
      return (roomInfo?.number as string) ?? '—'
    })
    .filter(Boolean)
  const roomCount = activeRooms.length

  const displayRoomNumber = roomCount > 1
    ? `${allRoomNumbers[0]} +${roomCount - 1}`
    : (allRoomNumbers[0] ?? '—')

  const guestType = hasCompany ? 'company' : 'individual'

  // Primary display booking (used in the booking list table)
  const companyGuestName = hasCompany
    ? bookerName ?? companyName ?? (firstGuest?.full_name as string) ?? 'Company'
    : (firstGuest?.full_name as string) ?? '—'
  const displayBooking: Booking = {
    id: reservationId,
    guestId: (firstGuest?.guest_id as string) ?? '',
    guestName: companyGuestName,
    contactId: companyId ?? undefined,
    roomId: activeRooms[0]?.room_id as string ?? '',
    roomNumber: displayRoomNumber,
    checkIn: new Date(row.check_in_date as string),
    checkOut: new Date(row.check_out_date as string),
    status: mapReservationStatus(row.status as string),
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    reservationId,
    roomCount,
    isSubBooking: false,
    guestType,
  }

  // For multi-room reservations, also create individual sub-bookings
  // so the room status grid can derive per-room occupancy correctly
  const subBookings: Booking[] = roomCount > 1
    ? activeRooms.map((r: Record<string, unknown>) => {
        const roomInfo = r.room as Record<string, unknown> | undefined
        return {
          id: `${reservationId}_${r.room_id}`,
          guestId: (firstGuest?.guest_id as string) ?? '',
          guestName: companyGuestName,
          contactId: companyId ?? undefined,
          roomId: (r.room_id as string) ?? '',
          roomNumber: (roomInfo?.number as string) ?? '—',
          checkIn: new Date(row.check_in_date as string),
          checkOut: new Date(row.check_out_date as string),
          status: mapReservationStatus(row.status as string),
          totalAmount: Number(row.total_amount) / roomCount,
          paidAmount: Number(row.paid_amount) / roomCount,
          createdAt: new Date(row.created_at as string),
          updatedAt: new Date(row.updated_at as string),
          reservationId,
          roomCount,
          isSubBooking: true,
          guestType,
        }
      })
    : []

  return [displayBooking, ...subBookings]
}

export interface BookingListQuery {
  page: number
  pageSize: number
  search?: string
  from?: string
  to?: string
  status?: string
  guestType?: string
}

export interface BookingPage {
  /** One display row per reservation, in server order. */
  bookings: Booking[]
  total: number
}

async function fetchBoard(query: string) {
  const res = await fetch(`/api/reservations/board?${query}`)
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: Record<string, unknown>[]; total?: number; error?: { message?: string } }
    | null
  if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `Failed to load reservations (${res.status})`)
  return json
}

export function bookingListQueryString(query: BookingListQuery): string {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })
  if (query.search) params.set('q', query.search)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.status) params.set('status', query.status)
  if (query.guestType) params.set('guestType', query.guestType)
  return params.toString()
}

export const bookingService = {
  /** Current and upcoming stays plus the last week's bookings (room grid + stats). */
  async getActive(): Promise<Booking[]> {
    const json = await fetchBoard('scope=active')
    return (json.data ?? []).flatMap(mapReservationToBooking)
  },

  /** One server-filtered, server-ordered page (query from bookingListQueryString). */
  async getPage(queryString: string): Promise<BookingPage> {
    const json = await fetchBoard(queryString)
    return {
      bookings: (json.data ?? []).map((row) => mapReservationToBooking(row)[0]),
      total: json.total ?? 0,
    }
  },
}

export default bookingService
