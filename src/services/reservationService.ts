import type {
  ApiResponse,
  AvailableRoom,
  ReservationDetail,
  ReservationGuestInsert,
  ReservationNote,
  ReservationNoteInsert,
} from '@/modules/reservations/types'

// Browser-side client for the reservation API routes. All data access and
// authorization happen on the server (Prisma); this only speaks HTTP.

async function call<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    })
    const json = (await res.json().catch(() => null)) as ApiResponse<T> | null
    if (!json) return { ok: false, error: { code: 'VALIDATION_ERROR', message: `Request failed (${res.status})` } }
    if (!res.ok && json.ok !== false) {
      return { ok: false, error: { code: res.status === 403 ? 'PERMISSION_DENIED' : 'VALIDATION_ERROR', message: `Request failed (${res.status})` } }
    }
    return json
  } catch {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Network error' } }
  }
}

interface AvailabilityRow {
  room_id: string
  room_number: string
  floor: number
  room_type_id: string
  room_type_name: string
  capacity: number
  status: string
  reason?: string | null
  base_price?: number | null
  effective_price?: number | null
  price_source?: string | null
  currency?: string | null
}

function mapAvailabilityRow(row: AvailabilityRow): AvailableRoom {
  return {
    roomId: row.room_id,
    roomNumber: row.room_number,
    roomTypeId: row.room_type_id,
    roomTypeName: row.room_type_name,
    floor: row.floor,
    capacity: row.capacity,
    status: row.status === 'available' ? 'available' : 'unavailable',
    reason: row.reason ?? undefined,
    price: Number(row.effective_price ?? row.base_price ?? 0),
    currency: row.currency ?? 'EGP',
    priceSource: row.price_source ?? 'standard',
  }
}

export const reservationService = {
  async getAvailability(params: {
    checkIn: string
    checkOut: string
    roomTypeId?: string
    capacity?: number
    contactId?: string
  }): Promise<ApiResponse<AvailableRoom[]>> {
    const query = new URLSearchParams({ checkIn: params.checkIn, checkOut: params.checkOut })
    if (params.roomTypeId) query.set('roomTypeId', params.roomTypeId)
    if (params.capacity != null) query.set('capacity', String(params.capacity))
    if (params.contactId) query.set('contactId', params.contactId)

    const result = await call<AvailabilityRow[]>(`/api/reservations/availability?${query.toString()}`)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, data: (result.data ?? []).map(mapAvailabilityRow) }
  },

  getById(id: string): Promise<ApiResponse<ReservationDetail>> {
    return call<ReservationDetail>(`/api/reservations/${encodeURIComponent(id)}`)
  },

  addGuest(input: ReservationGuestInsert): Promise<ApiResponse<ReservationDetail['guests'][0]>> {
    const { reservation_id: reservationId, ...guest } = input
    return call(`/api/reservations/${encodeURIComponent(reservationId)}/guests`, { method: 'POST', body: JSON.stringify(guest) })
  },

  updateGuest(reservationId: string, id: string, input: Partial<ReservationGuestInsert>): Promise<ApiResponse<ReservationDetail['guests'][0]>> {
    return call(`/api/reservations/${encodeURIComponent(reservationId)}/guests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  removeGuest(reservationId: string, id: string): Promise<ApiResponse<undefined>> {
    return call(`/api/reservations/${encodeURIComponent(reservationId)}/guests/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  addNote(input: ReservationNoteInsert): Promise<ApiResponse<ReservationNote>> {
    return call(`/api/reservations/${encodeURIComponent(input.reservation_id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: input.message }),
    })
  },
}

export default reservationService
