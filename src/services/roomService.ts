import type { Room, RoomStatus } from '@/modules/rooms/types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  })
  const body = (await res.json().catch(() => null)) as { data?: T; error?: string } | null
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body?.data as T
}

function toRoomInput(data: Partial<Room>) {
  return {
    ...(data.number !== undefined ? { number: data.number } : {}),
    ...(data.floor !== undefined ? { floor: data.floor } : {}),
    ...(data.roomTypeId !== undefined ? { room_type_id: data.roomTypeId } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.price !== undefined ? { price: data.price } : {}),
    ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
    ...(data.amenities !== undefined ? { amenities: data.amenities } : {}),
  }
}

export const roomService = {
  getAll(): Promise<Room[]> {
    return request<Room[]>('/api/rooms')
  },

  getAvailable(): Promise<Room[]> {
    return request<Room[]>('/api/rooms?status=available')
  },

  async getById(id: string): Promise<Room | null> {
    return request<Room>(`/api/rooms/${id}`).catch(() => null)
  },

  create(data: Omit<Room, 'id'>): Promise<Room> {
    return request<Room>('/api/rooms', { method: 'POST', body: JSON.stringify(toRoomInput(data)) })
  },

  async update(id: string, data: Partial<Room>): Promise<Room | null> {
    return request<Room>(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(toRoomInput(data)) }).catch(() => null)
  },

  async delete(id: string): Promise<boolean> {
    return request<{ success: boolean }>(`/api/rooms/${id}`, { method: 'DELETE' })
      .then(() => true)
      .catch(() => false)
  },

  /** Status-only change, allowed for every staff role; recorded in room history. */
  setStatus(id: string, status: RoomStatus, reason?: string): Promise<Room> {
    return request<Room>(`/api/rooms/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) })
  },
}

export default roomService
