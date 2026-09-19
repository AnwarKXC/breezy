import type { Tables, TablesInsert, TablesUpdate } from '@/services/db/rowTypes'

export type PricingRow = Tables<'room_type_pricing'>
export type CreatePricingInput = TablesInsert<'room_type_pricing'>
export type UpdatePricingInput = TablesUpdate<'room_type_pricing'>

export interface RoomTypePricing {
  id: string
  roomTypeId: string
  price: number
  priceSingle: number | null
  priceDouble: number | null
  priceTriple: number | null
  currency: string
  effectiveFrom: string | null
  effectiveUntil: string | null
  createdAt: string
  updatedAt: string
}

export function mapPricingRow(row: PricingRow): RoomTypePricing {
  return {
    id: row.id,
    roomTypeId: row.room_type_id,
    price: Number(row.price),
    priceSingle: row.price_single != null ? Number(row.price_single) : null,
    priceDouble: row.price_double != null ? Number(row.price_double) : null,
    priceTriple: row.price_triple != null ? Number(row.price_triple) : null,
    currency: row.currency,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
