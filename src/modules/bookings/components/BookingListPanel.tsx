'use client'

import { useEffect, useRef } from 'react'

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
  /** Number of list filters currently applied; shown as a badge on the Filter button. */
  activeFilterCount?: number
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
  activeFilterCount = 0,
  onAddBooking,
  ...callbacks
}: BookingListPanelProps) {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)

  // Press "/" anywhere (outside a field) to jump to the search box.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <Card padding="md">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1A1A1A]">
          {t('bookings.bookingList')}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onSearchChange('') }}
              placeholder={t('bookings.searchPlaceholder')}
              aria-label={t('bookings.searchPlaceholder')}
              data-tooltip={t('bookings.hints.search')}
              className="h-9 w-full rounded-lg border border-[#EAEAEA] bg-white pe-10 ps-3 text-sm text-[#333333] placeholder-gray-400 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-200 sm:w-64"
            />
            <kbd aria-hidden="true" className="pointer-events-none absolute end-2 top-1/2 hidden -translate-y-1/2 rounded border border-[#EAEAEA] bg-[#FAFAFA] px-1.5 font-mono text-[10px] text-[#787774] sm:block">/</kbd>
          </div>
          <button
            type="button"
            onClick={onFilterClick}
            data-tooltip={t('bookings.hints.listFilter')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-[#F9F9F8] ${activeFilterCount > 0 ? 'border-[#1A1A1A] bg-white text-[#1A1A1A]' : 'border-[#EAEAEA] bg-white text-[#555555]'}`}
          >
            {t('bookings.filter')}
            {activeFilterCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#1A1A1A] px-1 text-[11px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {onAddBooking && (
            <button
              type="button"
              onClick={onAddBooking}
              data-tooltip={t('bookings.hints.addBooking')}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333]"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
