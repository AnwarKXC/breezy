'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { FloatingInput } from '@/shared/components/FloatingField'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useClickOutside } from '@/shared/hooks/useClickOutside'
import { InvoiceWizardBookingSummary } from './InvoiceWizardBookingSummary'
import type { InvoiceBookingLookup, WizardMode } from '../types'

interface Props {
  t: (key: string) => string
  mode: WizardMode
  lookups: { bookings: InvoiceBookingLookup[] }
  lookupsLoading: boolean
  selectedBooking: InvoiceBookingLookup | null
  contactId: string
  guestName: string
  companyName: string
  errors?: Record<string, string>
  onSelectBooking: (booking: InvoiceBookingLookup) => void
  onSetGuestName: (name: string) => void
  onSetCompanyName: (name: string) => void
  onSwitchToManual: () => void
}

const BOOKING_LOOKUP_PAGE_SIZE = 10

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-[#787774]" fill="none" viewBox="0 0 24 24">
      <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function formatBookingLabel(booking: InvoiceBookingLookup) {
  const room = booking.roomNumber ? `Room ${booking.roomNumber}` : 'No room'
  return `${booking.guestName} - ${room} - ${booking.checkIn.slice(0, 10)}`
}

export function InvoiceWizardStepBooking({
  t,
  mode,
  lookups,
  lookupsLoading,
  selectedBooking,
  contactId,
  guestName,
  companyName,
  errors,
  onSelectBooking,
  onSetGuestName,
  onSetCompanyName,
  onSwitchToManual,
}: Props) {
  const { formatCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleBookingCount, setVisibleBookingCount] = useState(BOOKING_LOOKUP_PAGE_SIZE)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setOpen(false))

  const contactBookings = useMemo(() => {
    if (!contactId) return lookups.bookings
    return lookups.bookings.filter((booking) => booking.contactId === contactId)
  }, [contactId, lookups.bookings])

  const filteredBookings = useMemo(() => {
    if (!searchQuery) return contactBookings
    const q = searchQuery.toLowerCase()
    return contactBookings.filter(
      (booking) =>
        booking.guestName.toLowerCase().includes(q) ||
        booking.id.toLowerCase().includes(q) ||
        Boolean(booking.roomNumber?.toLowerCase().includes(q)) ||
        Boolean(booking.contactName?.toLowerCase().includes(q)) ||
        Boolean(booking.companyName?.toLowerCase().includes(q)),
    )
  }, [contactBookings, searchQuery])

  const visibleBookings = useMemo(
    () => filteredBookings.slice(0, visibleBookingCount),
    [filteredBookings, visibleBookingCount],
  )

  const emptyMessage = contactId && contactBookings.length === 0
    ? t('accounting.invoices.wizard.noBookingsForContact')
    : t('accounting.invoices.wizard.noBookingsFound')

  const handleSelect = useCallback((booking: InvoiceBookingLookup) => {
    onSelectBooking(booking)
    setSearchQuery('')
    setOpen(false)
    setHighlightIdx(-1)
  }, [onSelectBooking])

  const handleFocus = useCallback(() => {
    setOpen(true)
    setSearchQuery('')
    setVisibleBookingCount(BOOKING_LOOKUP_PAGE_SIZE)
    setHighlightIdx(-1)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setOpen(true)
    setVisibleBookingCount(BOOKING_LOOKUP_PAGE_SIZE)
    setHighlightIdx(-1)
  }, [])

  const handleBookingScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom > 32) return

    setVisibleBookingCount((current) => {
      if (current >= filteredBookings.length) return current
      return Math.min(current + BOOKING_LOOKUP_PAGE_SIZE, filteredBookings.length)
    })
  }, [filteredBookings.length])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.min(prev + 1, visibleBookings.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightIdx >= 0 && highlightIdx < visibleBookings.length) {
      e.preventDefault()
      handleSelect(visibleBookings[highlightIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [handleSelect, highlightIdx, open, visibleBookings])

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]')
      items[highlightIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIdx])

  if (mode === 'manual') {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[#333333]">{t('accounting.invoices.wizard.guestInfo')}</h3>
        <div>
          <FloatingInput
            label={t('accounting.invoices.wizard.guestName')}
            value={guestName}
            onChange={(e) => onSetGuestName(e.target.value)}
            wrapperClassName="w-full"
            className={errors?.guestName ? 'border-red-400' : ''}
          />
          {errors?.guestName && (
            <p className="mt-1 text-xs text-[#9F2F2D]">{errors.guestName}</p>
          )}
        </div>
        <div>
          <FloatingInput
            label={t('accounting.invoices.wizard.companyName')}
            value={companyName}
            onChange={(e) => onSetCompanyName(e.target.value)}
            wrapperClassName="w-full"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#333333]">{t('accounting.invoices.wizard.selectBookingTitle')}</h3>
      <p className="text-xs text-[#787774]">{t('accounting.invoices.wizard.selectBookingDescription')}</p>

      <div ref={dropdownRef} className="relative">
        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={open ? searchQuery : selectedBooking ? formatBookingLabel(selectedBooking) : ''}
          onFocus={handleFocus}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('accounting.invoices.wizard.searchBooking')}
          className="form-control booking-select-input w-full"
          autoComplete="off"
        />

        {open && (
          <div
            ref={listRef}
            role="listbox"
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[#EAEAEA] bg-white text-sm shadow-[0_18px_40px_rgba(16,26,36,0.14)]"
          >
            {lookupsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-[#787774]">{t('common.loading')}</div>
            ) : filteredBookings.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[#787774]">
                <p>{emptyMessage}</p>
                <button
                  type="button"
                  onClick={onSwitchToManual}
                  className="mt-3 text-indigo-600 underline hover:text-indigo-800"
                >
                  {t('accounting.invoices.wizard.manualInvoiceTitle')}
                </button>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-1" onScroll={handleBookingScroll}>
                {visibleBookings.map((booking, idx) => {
                  const active = selectedBooking?.id === booking.id
                  const highlighted = idx === highlightIdx
                  return (
                    <button
                      key={booking.id}
                      role="option"
                      aria-selected={active}
                      type="button"
                      onClick={() => handleSelect(booking)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                        highlighted ? 'bg-indigo-50' : active ? 'bg-[#F9F9F8]' : 'hover:bg-[#F9F9F8]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-medium text-[#1A1A1A]">{booking.guestName}</span>
                          <span className="shrink-0 rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#787774]">
                            {booking.status}
                          </span>
                        </div>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-[#787774]">
                          {booking.roomNumber && <span>Room {booking.roomNumber}</span>}
                          <span>{booking.checkIn.slice(0, 10)} - {booking.checkOut.slice(0, 10)}</span>
                          {booking.nights > 0 && <span>{booking.nights} night(s)</span>}
                          {booking.totalAmount != null && <span>{formatCurrency(booking.totalAmount)}</span>}
                        </div>
                      </div>
                      {active && <CheckIcon />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedBooking && <InvoiceWizardBookingSummary booking={selectedBooking} />}

      <div className="border-t border-[#EAEAEA] pt-3 text-center">
        <button
          type="button"
          onClick={onSwitchToManual}
          className="text-sm text-indigo-600 underline hover:text-indigo-800"
        >
          {t('accounting.invoices.wizard.manualInvoiceLink')}
        </button>
      </div>
    </div>
  )
}
