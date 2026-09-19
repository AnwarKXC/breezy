import type { Tables, TablesInsert, TablesUpdate } from '@/services/db/rowTypes'

export type RoomTypeRow = Tables<'room_types'>
// base_price is the room type's current room_type_pricing price, not a column.
export type CreateRoomTypeInput = TablesInsert<'room_types'> & { base_price?: number }
export type UpdateRoomTypeInput = TablesUpdate<'room_types'> & { base_price?: number }

export interface RoomType {
  id: string
  name: string
  slug: string
  description: string | null
  basePrice: number
  defaultCapacity: number
  amenities: string[]
  createdAt: string
  updatedAt: string
}

export function mapRoomTypeRow(row: RoomTypeRow, basePrice = 0): RoomType {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    basePrice,
    defaultCapacity: row.default_capacity,
    amenities: row.amenities as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toRoomTypeRow(input: CreateRoomTypeInput | UpdateRoomTypeInput): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('name' in input && input.name !== undefined) row.name = input.name
  if ('slug' in input && input.slug !== undefined) row.slug = input.slug
  if ('description' in input && input.description !== undefined) row.description = input.description
  if ('default_capacity' in input && input.default_capacity !== undefined) row.default_capacity = input.default_capacity
  if ('amenities' in input && input.amenities !== undefined) row.amenities = input.amenities
  return row
}
