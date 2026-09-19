'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { ROOM_STATUS_LEGEND, ROOM_STATUS_STYLES } from '../utils/roomStatusStyles'
import type { Room } from '@/modules/rooms/types'
import type { RoomType } from '@/modules/room-types/types'
import type { RoomTypePricing } from '@/modules/pricing/types'
import type { Booking } from '../types'
import type { DeriveRoomAvailabilityInput, DerivedRoomAvailability } from '../utils/deriveRoomAvailability'
import { deriveRoomAvailability } from '../utils/deriveRoomAvailability'
import { deriveRoomPrice, type DeriveRoomPriceInput } from '../utils/deriveRoomPrice'
import { RoomStatusCell } from './RoomStatusCell'

interface RoomStatusGridProps {
  rooms: Room[]
  roomTypes: RoomType[]
  pricing: RoomTypePricing[]
  bookings: Booking[]
  roomReservationDates?: Map<string, string>
  selectedDate: Date
  formatCurrency: (amount: number) => string
  statusFilter?: string
  onRoomClick?: (room: Room, availability: DerivedRoomAvailability, priceLabel: string) => void
}

export function RoomStatusGrid({
  rooms,
  roomTypes,
  pricing,
  bookings,
  roomReservationDates,
  selectedDate,
  formatCurrency,
  statusFilter,
  onRoomClick,
}: RoomStatusGridProps) {
  const { t } = useTranslation()

  const roomTypeMap = useMemo(
    () => new Map(roomTypes.map((rt) => [rt.id, rt])),
    [roomTypes],
  )

  const pricingMap = useMemo(() => {
    const map = new Map<string, RoomTypePricing>()
    for (const p of pricing) {
      if (!map.has(p.roomTypeId)) map.set(p.roomTypeId, p)
    }
    return map
  }, [pricing])

  const overduePendingRooms = useMemo(() => {
    const map = new Map<string, string>()
    for (const room of rooms) {
      const pending = bookings.filter(
        (b) => b.roomId === room.id && b.status === 'booked',
      )
      if (pending.length > 0) {
        const latest = pending.reduce((a, b) => new Date(a.checkOut) > new Date(b.checkOut) ? a : b)
        map.set(room.id, latest.checkOut.toISOString())
      } else {
        const roomBookings = bookings.filter((b) => b.roomId === room.id)
        const hasResolvedBooking = roomBookings.some((b) =>
          ['checked-out', 'cancelled', 'no-show'].includes(b.status),
        )
        if (!hasResolvedBooking) {
          const resDate = roomReservationDates?.get(room.id)
          if (resDate) map.set(room.id, resDate)
        }
      }
    }
    return map
  }, [rooms, bookings, roomReservationDates])

  const filteredRooms = useMemo(() => {
    if (!statusFilter) return rooms
    return rooms.filter((room) => {
      const availInput: DeriveRoomAvailabilityInput = { room, bookings, selectedDate }
      const availability = deriveRoomAvailability(availInput)
      return availability.status === statusFilter
    })
  }, [rooms, bookings, selectedDate, statusFilter])

  if (!filteredRooms.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-[#EAEAEA] py-8 text-sm text-[#787774]">
        {t('bookings.noRooms')}
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {filteredRooms.map((room) => {
          const roomType = roomTypeMap.get(room.roomTypeId)
          const activePricing = pricingMap.get(room.roomTypeId)
          const priceInput: DeriveRoomPriceInput = {
            room,
            roomType,
            pricing: activePricing,
            formatCurrency,
          }
          const derivedPrice = deriveRoomPrice(priceInput)
          const availInput: DeriveRoomAvailabilityInput = { room, bookings, selectedDate }
          const availability = deriveRoomAvailability(availInput)

          const pendingExpiry = availability.status !== 'checked_out' ? (overduePendingRooms.get(room.id) ?? null) : null
          const dirtySince = room.status === 'dirty' ? room.updatedAt ?? null : null

          return (
            <RoomStatusCell
              key={room.id}
              roomNumber={room.number}
              priceLabel={derivedPrice.displayPricePerNight}
              status={availability.status}
              dirtySince={dirtySince}
              pendingExpiry={pendingExpiry}
              onClick={onRoomClick ? () => onRoomClick(room, availability, derivedPrice.displayPricePerNight) : undefined}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {ROOM_STATUS_LEGEND.map(({ status, labelKey }) => {
          const style = ROOM_STATUS_STYLES[status as keyof typeof ROOM_STATUS_STYLES] ?? ROOM_STATUS_STYLES.available
          return (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs text-[#787774]">
              <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
              {t(labelKey)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
