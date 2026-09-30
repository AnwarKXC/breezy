import type { Booking } from '../types'
import type { Room } from '@/modules/rooms/types'
import type { RoomType } from '@/modules/room-types/types'
import type { RoomTypePricing } from '@/modules/pricing/types'

export type RoomPriceSource = 'booking' | 'override' | 'room_type' | 'room' | 'missing'

export interface DeriveRoomPriceInput {
  room: Pick<Room, 'price' | 'roomTypeId'>
  roomType?: Pick<RoomType, 'basePrice'> | null
  pricing?: Pick<RoomTypePricing, 'price' | 'effectiveFrom' | 'effectiveUntil'> & { currency?: string } | null
  booking?: Pick<Booking, 'totalAmount' | 'checkIn' | 'checkOut'> & { currency?: string } | null
  contactPriceOverride?: number | null
  nights?: number
  /** Formats in `code`; omitted = the system currency. */
  formatCurrency: (amount: number, code?: string | null) => string
}

export interface DerivedRoomPrice {
  pricePerNight: number | null
  totalPrice: number | null
  source: RoomPriceSource
  displayPricePerNight: string
  displayTotalPrice: string | null
}

const PRICE_NOT_SET = 'Price not set'

function isPricingActive(
  pricing: Pick<RoomTypePricing, 'effectiveFrom' | 'effectiveUntil'> | null | undefined,
): boolean {
  if (!pricing) return false
  const now = new Date().toISOString()
  if (pricing.effectiveFrom && pricing.effectiveFrom > now) return false
  if (pricing.effectiveUntil && pricing.effectiveUntil < now) return false
  return true
}

function bookingNights(booking: Pick<Booking, 'checkIn' | 'checkOut'>): number {
  const ms = new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()
  const days = Math.round(ms / 86_400_000)
  return days > 0 ? days : 1
}

export function deriveRoomPrice(input: DeriveRoomPriceInput): DerivedRoomPrice {
  const { room, roomType, pricing, booking, contactPriceOverride, nights, formatCurrency } = input

  let pricePerNight: number | null = null
  let source: RoomPriceSource = 'missing'
  // Currency of whichever price wins (a booking's own, else the rate row's).
  let currency: string | null = null

  if (booking && booking.totalAmount > 0) {
    const n = nights && nights > 0 ? nights : bookingNights(booking)
    pricePerNight = booking.totalAmount / n
    source = 'booking'
    currency = booking.currency ?? null
  } else if (contactPriceOverride && contactPriceOverride > 0) {
    pricePerNight = contactPriceOverride
    source = 'override'
  } else if (isPricingActive(pricing) && pricing!.price > 0) {
    pricePerNight = pricing!.price
    source = 'room_type'
    currency = pricing!.currency ?? null
  } else if (roomType && roomType.basePrice > 0) {
    pricePerNight = roomType.basePrice
    source = 'room_type'
  } else if (room.price && room.price > 0) {
    pricePerNight = room.price
    source = 'room'
  }

  const totalPrice =
    pricePerNight !== null && nights && nights > 0 ? pricePerNight * nights : null

  const displayPricePerNight =
    pricePerNight !== null ? `${formatCurrency(pricePerNight, currency)} / night` : PRICE_NOT_SET
  const displayTotalPrice =
    totalPrice !== null ? `Total: ${formatCurrency(totalPrice, currency)}` : null

  return {
    pricePerNight,
    totalPrice,
    source,
    displayPricePerNight,
    displayTotalPrice,
  }
}

export const PRICE_NOT_SET_LABEL = PRICE_NOT_SET
