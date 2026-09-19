'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Card } from '@/shared/components/Card'
import { BookingsTable, type BookingsTableRow } from './BookingsTable'
import type { Booking } from '../types'

interface BookingListPanelProps {
  rows: BookingsTableRow[]
  loading?: boolean
  searchQuery: string
  onSearchChange: (value: string) => void
  onFilterClick?: () => void
  onAddBooking?: () => void
  onCheckIn?: (booking: Booking) => void
  onCheckOut?: (booking: Booking) => void
  onCancel?: (booking: Booking) => void
  onEdit?: (booking: Booking) => void
  onView?: (booking: Booking) => void
  onInvoice?: (booking: Booking) => void
  onExtend?: (booking: Booking) => void
  onChangeRoom?: (booking: Booking) => void
  onDelete?: (booking: Booking) => void
  onAddCharge?: (booking: Booking) => void
  onNavigate?: (booking: Booking) => void
}

export function BookingListPanel({
  rows,
  loading,
  searchQuery,
  onSearchChange,
  onFilterClick,
  onAddBooking,
  ...callbacks
}: BookingListPanelProps) {
  const { t } = useTranslation()

  return (
    <Card padding="md">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1A1A1A]">
          {t('bookings.bookingList')}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('bookings.searchPlaceholder')}
              className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-3 pr-8 text-sm text-[#333333] placeholder-gray-400 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
            />
          </div>
          <button
            type="button"
            onClick={onFilterClick}
            className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm font-medium text-[#555555] transition-colors hover:bg-[#F9F9F8]"
          >
            {t('bookings.filter')}
          </button>
          {onAddBooking && (
            <button
              type="button"
              onClick={onAddBooking}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('bookings.addBooking')}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <BookingsTable
          rows={rows}
          loading={loading}
          {...callbacks}
        />
      </div>
    </Card>
  )
}
