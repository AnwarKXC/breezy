'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Card } from '@/shared/components/Card'
import { InfoHint } from '@/shared/components/InfoHint'
import type { Room } from '@/modules/rooms/types'
import type { RoomType } from '@/modules/room-types/types'
import type { RoomTypePricing } from '@/modules/pricing/types'
import type { Booking } from '../types'
import type { DerivedRoomAvailability } from '../utils/deriveRoomAvailability'
import { RoomStatusGrid } from './RoomStatusGrid'

interface RoomStatusPanelProps {
  rooms: Room[]
  roomTypes: RoomType[]
  pricing: RoomTypePricing[]
  bookings: Booking[]
  roomReservationDates?: Map<string, string>
  selectedDate: Date
  formatCurrency: (amount: number, code?: string | null) => string
  statusFilter?: string
  onRoomClick?: (room: Room, availability: DerivedRoomAvailability, priceLabel: string) => void
  onFilterClick?: () => void
  onRefresh?: () => void
  dateRange?: { startDate: string; endDate: string }
}

export function RoomStatusPanel({
  rooms,
  roomTypes,
  pricing,
  bookings,
  roomReservationDates,
  selectedDate,
  formatCurrency,
  statusFilter,
  onRoomClick,
  onFilterClick,
  onRefresh,
  dateRange,
}: RoomStatusPanelProps) {
  const { t } = useTranslation()

  // Apply date range filter to bookings shared with the grid
  const filteredBookingsForGrid = useMemo(() => {
    let result = bookings
    if (dateRange?.startDate) {
      const start = new Date(dateRange.startDate)
      result = result.filter((b) => new Date(b.checkIn) >= start || new Date(b.checkOut) >= start)
    }
    if (dateRange?.endDate) {
      const end = new Date(dateRange.endDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter((b) => new Date(b.checkIn) <= end || new Date(b.checkOut) <= end)
    }
    return result
  }, [bookings, dateRange])

  return (
    <Card padding="md">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-[#1A1A1A]">
          {t('bookings.roomStatusTitle')}
          <InfoHint text={t('bookings.hints.roomStatus')} />
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFilterClick}
            data-tooltip={t('bookings.hints.roomFilter')}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#787774] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
          >
            {t('bookings.filter')}
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              data-tooltip={t('bookings.hints.refresh')}
              className="rounded-lg px-2 py-1 text-xs font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F5F5]"
            >
              {t('bookings.refresh')}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4">
        <RoomStatusGrid
          rooms={rooms}
          roomTypes={roomTypes}
          pricing={pricing}
          bookings={filteredBookingsForGrid}
          roomReservationDates={roomReservationDates}
          selectedDate={selectedDate}
          formatCurrency={formatCurrency}
          statusFilter={statusFilter}
          onRoomClick={onRoomClick}
        />
      </div>
    </Card>
  )
}
