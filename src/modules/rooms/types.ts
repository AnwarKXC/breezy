import type { Tables, TablesInsert, TablesUpdate } from '@/services/db/rowTypes'

/** Derived summary of the three state columns below. */
export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'dirty'
export type RoomOccupancyStatus = 'vacant' | 'occupied'
export type HousekeepingStatus = 'clean' | 'dirty' | 'cleaning' | 'inspected'
export type RoomOperationalStatus = 'active' | 'maintenance' | 'out_of_order' | 'blocked'

export interface Room {
  id: string
  number: string
  floor: number
  roomTypeId: string
  status: RoomStatus
  occupancyStatus: RoomOccupancyStatus
  housekeepingStatus: HousekeepingStatus
  operationalStatus: RoomOperationalStatus
  /** Standing room-specific price; 0 = inherits the room type's price. */
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
export type CreateRoomInput = TablesInsert<'rooms'> & { price?: number }
export type UpdateRoomInput = TablesUpdate<'rooms'> & { price?: number }

export function mapRoomRow(row: RoomRow, price = 0): Room {
  return {
    id: row.id,
    number: row.number,
    floor: row.floor,
    roomTypeId: row.room_type_id,
    status: row.status as RoomStatus,
    occupancyStatus: row.occupancy_status,
    housekeepingStatus: row.housekeeping_status,
    operationalStatus: row.operational_status,
    price,
    capacity: row.capacity,
    amenities: row.amenities as string[],
    updatedAt: row.updated_at,
  }
}
