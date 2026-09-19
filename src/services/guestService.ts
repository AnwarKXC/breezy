import type { Tables } from '@/services/db/rowTypes'
import type { Guest, GuestStatus } from '@/modules/guests/types'

type GuestRow = Tables<'guests'>

function mapGuestRow(row: GuestRow): Guest {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? '',
    country: row.country ?? '',
    passportNumber: row.passport_number ?? undefined,
    status: row.status as GuestStatus,
    totalBookings: row.total_bookings,
    totalSpent: row.total_spent,
    lastVisit: row.last_visit ? new Date(row.last_visit) : undefined,
    createdAt: new Date(row.created_at),
  }
}

export const guestService = {
  async getAll(options: { limit?: number } = {}): Promise<Guest[]> {
    const res = await fetch(`/api/guests${options.limit ? `?limit=${options.limit}` : ''}`)
    if (!res.ok) throw new Error(`Failed to load guests (${res.status})`)
    const json = (await res.json()) as { data?: GuestRow[] }
    return (json.data ?? []).map(mapGuestRow)
  },
}

export default guestService
