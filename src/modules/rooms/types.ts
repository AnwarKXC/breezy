import type { Tables, TablesInsert, TablesUpdate } from '@/services/db/rowTypes'

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'dirty'

export interface Room {
  id: string
  number: string
  floor: number
  roomTypeId: string
  status: RoomStatus
  price: number
  capacity: number
  amenities: string[]
  updatedAt?: string | null
}

export interface RoomFilters {
  status?: RoomStatus
  roomTypeId?: string
  floor?: number
  minPrice?: number
  maxPrice?: number
}

export type RoomRow = Tables<'rooms'>
export type CreateRoomInput = TablesInsert<'rooms'>
export type UpdateRoomInput = TablesUpdate<'rooms'>

export function mapRoomRow(row: RoomRow): Room {
  return {
    id: row.id,
    number: row.number,
    floor: row.floor,
    roomTypeId: row.room_type_id,
    status: row.status as RoomStatus,
    price: Number(row.price),
    capacity: row.capacity,
    amenities: row.amenities as string[],
    updatedAt: row.updated_at,
  }
}
