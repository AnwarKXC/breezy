'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DeleteConfirmationDialog } from '@/shared/components/DeleteConfirmationDialog'
import { BookingDeleteModal } from './BookingDeleteModal'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useBookings } from '../hooks/useBookings'
import { useRooms } from '@/modules/rooms/hooks/useRooms'
import { useRoomTypes } from '@/modules/room-types/hooks/useRoomTypes'
import { usePricing } from '@/modules/pricing/hooks/usePricing'
import { guestService } from '@/services/guestService'
import { roomService } from '@/services/roomService'
import type { Guest } from '@/modules/guests/types'
import { reservationService } from '@/services/reservationService'
import { BookingListPanel } from './BookingListPanel'
import { BookingsTableRow } from './BookingsTable'
import { BookingStatsCards } from './BookingStatsCards'
import { RoomStatusPanel } from './RoomStatusPanel'
import { RoomDetailsModal } from './RoomDetailsModal'
import { BookingDetailModal } from './BookingDetailModal'
import { CheckoutConfirmModal, type SavedCharge } from './CheckoutConfirmModal'
import { BookingListFilterModal } from './BookingListFilterModal'
import { RoomStatusFilterModal } from './RoomStatusFilterModal'
import { toast } from '@/shared/toast/toastEvents'
import { useCan } from '@/shared/rbac/useCan'
import { ACTIONS } from '@/config/rbac'
import type { Room } from '@/modules/rooms/types'
import type { DerivedRoomAvailability } from '../utils/deriveRoomAvailability'
import { deriveRoomPrice } from '../utils/deriveRoomPrice'
import type { Booking, BookingStatus } from '../types'

export function BookingsPage() {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const { formatCurrency } = useCurrency()
  const canCreateReservation = useCan(ACTIONS.RESERVATIONS_CREATE)
  const { bookings, loading: bookingsLoading, fetchBookings } = useBookings()
  const { rooms, loading: roomsLoading, fetchRooms } = useRooms()
  const { items: roomTypes } = useRoomTypes()
  const { items: pricing } = usePricing()
  const [guests, setGuests] = useState<Guest[]>([])
  const [guestsLoading, setGuestsLoading] = useState(true)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null)
  const [checkoutSavedCharges, setCheckoutSavedCharges] = useState<SavedCharge[]>([])

  const [confirmAction, setConfirmAction] = useState<{ action: string; booking: Booking } | null>(null)
  const [confirmDeleting, setConfirmDeleting] = useState(false)

  const [bookingCancelOpen, setBookingCancelOpen] = useState(false)
  const [bookingCancelFee, setBookingCancelFee] = useState('')
  const [bookingCancelLoading, setBookingCancelLoading] = useState(false)

  const [deleteBookingInvoiceOpen, setDeleteBookingInvoiceOpen] = useState(false)
  const [deleteBookingInvoiceData, setDeleteBookingInvoiceData] = useState<{ booking: Booking; invoice: { id: string; invoiceNumber: string; status: string; amount: number } } | null>(null)
  const [deleteBookingInvoiceLoading, setDeleteBookingInvoiceLoading] = useState(false)

  useEffect(() => {
    guestService.getAll()
      .then(setGuests)
      .catch(() => {})
      .finally(() => setGuestsLoading(false))
  }, [])

  // Check-out date of the confirmed stay on each room, derived from the loaded
  // reservations (single-room rows and per-room sub-bookings carry roomId).
  const roomReservationDates = useMemo(() => {
    const dates = new Map<string, string>()
    for (const b of bookings) {
      if (b.status !== 'confirmed' || !b.roomId || ((b.roomCount ?? 1) > 1 && !b.isSubBooking)) continue
      dates.set(b.roomId, new Date(b.checkOut).toISOString().slice(0, 10))
    }
    return dates
  }, [bookings])

  const [searchQuery, setSearchQuery] = useState('')
  const [roomDetailOpen, setRoomDetailOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedAvailability, setSelectedAvailability] = useState<DerivedRoomAvailability | null>(null)
  const [selectedPriceLabel, setSelectedPriceLabel] = useState('')
  const [selectedRoomHistory, setSelectedRoomHistory] = useState<Array<{
    guestName: string
    checkIn: string
    checkOut: string
    status: string
    totalAmount: number
    contactNumber?: string
    idNumber?: string
    country?: string
  }>>([])
  const [bookingFilterOpen, setBookingFilterOpen] = useState(false)
  const [roomFilterOpen, setRoomFilterOpen] = useState(false)
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [roomStatusFilter, setRoomStatusFilter] = useState('')
  const [bookingStatusFilter, setBookingStatusFilter] = useState('')
  const [guestTypeFilter, setGuestTypeFilter] = useState('')


  const roomTypeMap = useMemo(
    () => new Map(roomTypes.map((rt) => [rt.id, rt])),
    [roomTypes],
  )

  const pricingMap = useMemo(() => {
    const map = new Map<string, typeof pricing[0]>()
    for (const p of pricing) {
      if (!map.has(p.roomTypeId)) map.set(p.roomTypeId, p)
    }
    return map
  }, [pricing])

  const guestMap = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests],
  )

  const handleRoomClick = useCallback((room: Room, _availability: DerivedRoomAvailability, _priceLabel: string) => {
    router.push(`/${locale}/rooms/${room.id}`)
  }, [locale, router])

  const handleMarkRoomAvailable = useCallback(async (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return
    try {
      await roomService.setStatus(roomId, 'available', 'Cleaned in under 2 hours')
    } catch {
      toast.error('Failed to update room status')
      return
    }
    toast.success(`Room ${room.number} marked as available`)
    setRoomDetailOpen(false)
    await fetchRooms()
  }, [rooms, fetchRooms])

  const handleSetMaintenance = useCallback(async (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return
    try {
      await roomService.setStatus(roomId, 'maintenance', 'Set to maintenance')
    } catch {
      toast.error('Failed to update room status')
      return
    }
    toast.success(`Room ${room.number} set to maintenance`)
    setRoomDetailOpen(false)
    await fetchRooms()
  }, [rooms, fetchRooms])

  const handleAddBooking = useCallback(() => {
    router.push(`/${locale}/reservations/new`)
  }, [locale, router])

  const handleCheckoutConfirm = useCallback(async (bookingId: string, extraCharges: Array<{ label: string; amount: number }>, payment?: { method: string; paidAmount: number }) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking?.reservationId) return

    const payInfo = payment ?? { method: 'cash', paidAmount: 0 }
    const res = await fetch(`/api/reservations/${booking.reservationId}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extraCharges,
        paymentMethod: payInfo.method,
        paidAmount: payInfo.paidAmount,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      toast.error(json.error?.message ?? 'Check-out failed')
      return
    }
    toast.success('Checked out successfully')
    setCheckoutBooking(null)
    setCheckoutSavedCharges([])

    // Download invoice PDF if available
    if (json.invoice) {
      try {
        const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
        setTimeout(() => downloadInvoicePdf(json.invoice, 'en').catch((e) => console.error('[BookingsPage] PDF failed', e)), 500)
      } catch { /* non-critical */ }
    }

    await fetchBookings()
    await fetchRooms()
  }, [bookings, fetchBookings, fetchRooms])

  const handleAction = useCallback(
    async (action: string, booking: Booking) => {
      try {
        switch (action) {
          case 'checkIn': {
            // Reservation-based check-in — use the reservation API
            if (booking.reservationId) {
              const res = await fetch(`/api/reservations/${booking.reservationId}/check-in`, { method: 'POST' })
              const json = await res.json()
              if (json.ok) {
                toast.success('Checked in successfully')
              } else {
                toast.error(json.error?.message ?? 'Check-in failed')
              }
              break
            }
            break
          }
          case 'checkOut': {
            setCheckoutBooking(booking)
            // Fetch saved extra charges for reservation-based bookings
            if (booking.reservationId) {
              reservationService.getById(booking.reservationId).then((res) => {
                if (!res.ok || !res.data) return
                setCheckoutSavedCharges(
                  res.data.pricingItems
                    .filter((p) => p.pricing_level === 'extra')
                    .map((p) => ({
                      id: p.id,
                      day_index: 0,
                      day_label: '',
                      label: p.manual_override_reason ?? 'Extra charge',
                      amount: Number(p.total_amount),
                    })),
                )
              })
            } else {
              setCheckoutSavedCharges([])
            }
            return
          }
          case 'cancel':
            setConfirmAction({ action: 'cancel', booking })
            setBookingCancelFee(String(booking.totalAmount ?? ''))
            setBookingCancelOpen(true)
            return
          case 'view':
            setDetailBooking(booking)
            setDetailOpen(true)
            return
          case 'invoice': {
            try {
              const listRes = await fetch(`/api/accounting/invoices?reservationId=${booking.reservationId}`)
              if (!listRes.ok) {
                console.error('Invoice list fetch failed', listRes.status)
                break
              }
              const listJson = await listRes.json()
              const invoices = listJson.data ?? []
              const first = Array.isArray(invoices) ? invoices[0] : invoices
              if (!first?.id) {
                console.error('No invoice found for booking', booking.id)
                break
              }
              const detailRes = await fetch(`/api/accounting/invoices/${first.id}`)
              if (!detailRes.ok) {
                console.error('Invoice detail fetch failed', detailRes.status)
                break
              }
              const detailJson = await detailRes.json()
              const fullInvoice = detailJson.data ?? detailJson
              const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
              await downloadInvoicePdf(fullInvoice, 'en')
            } catch (e) {
              console.error('Invoice PDF failed', e)
              toast.error('Failed to generate invoice PDF')
            }
            return
          }
          case 'delete': {
            const listRes = await fetch(`/api/accounting/invoices?reservationId=${booking.reservationId}`)
            if (listRes.ok) {
              const listJson = await listRes.json()
              const invoices = listJson.data ?? []
              const invoice = Array.isArray(invoices) ? invoices[0] : null
              if (invoice?.id) {
                setDeleteBookingInvoiceData({ booking, invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status, amount: invoice.amount } })
                setDeleteBookingInvoiceOpen(true)
                return
              }
            }
            setConfirmAction({ action: 'delete', booking })
            return
          }
          case 'edit': {
            // For reservation-based bookings, navigate to edit route
            if (booking.reservationId) router.push(`/${locale}/reservations/${booking.reservationId}/edit`)
            return
          }
          case 'navigate': {
            if (booking.reservationId) router.push(`/${locale}/reservations/${booking.reservationId}`)
            return
          }
        }
        await fetchBookings()
        await fetchRooms()
      } catch {
        // error handled by hook
      }
    },
    [fetchBookings, fetchRooms, locale, router],
  )

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return
    const { action, booking } = confirmAction
    setConfirmDeleting(true)
    try {
      if (action === 'delete') {
        if (booking.reservationId) {
          const res = await fetch(`/api/reservations/${booking.reservationId}`, { method: 'DELETE' })
          const data = await res.json()
          if (!data.ok) {
            toast.error(data.error?.message ?? 'Failed to delete reservation')
          }
        }
      }
      await fetchBookings()
      await fetchRooms()
    } catch {
      toast.error('Failed to delete booking')
    } finally {
      setConfirmDeleting(false)
      setConfirmAction(null)
    }
  }, [confirmAction, fetchBookings, fetchRooms])

  const handleBookingCancel = useCallback(async (feeAmount?: number) => {
    const booking = confirmAction?.booking
    if (!booking) return
    setBookingCancelLoading(true)
    try {
      if (booking.reservationId) {
        const body = feeAmount && feeAmount > 0 ? JSON.stringify({ feeAmount }) : JSON.stringify({})
        const res = await fetch(`/api/reservations/${booking.reservationId}/cancel`, {
          method: 'POST',
          body,
        })
        const data = await res.json()
        if (!data.ok) {
          toast.error(data.error?.message ?? 'Failed to cancel')
          return
        }
        if (data.invoice) toast.success('Cancellation fee invoice created')
      }
      toast.success('Booking cancelled')
      setBookingCancelOpen(false)
      setConfirmAction(null)
      await fetchBookings()
      await fetchRooms()
    } catch {
      toast.error('Failed to cancel booking')
    } finally {
      setBookingCancelLoading(false)
    }
  }, [confirmAction, fetchBookings, fetchRooms])

  const handleDeleteBookingWithInvoice = useCallback(async (type: 'charge' | 'delete-invoice') => {
    if (!deleteBookingInvoiceData) return
    const { booking, invoice } = deleteBookingInvoiceData
    setDeleteBookingInvoiceLoading(true)
    try {
      if (type === 'charge') {
        const detailRes = await fetch(`/api/accounting/invoices/${invoice.id}`)
        if (detailRes.ok) {
          const detailJson = await detailRes.json()
          const fullInvoice = detailJson.data ?? detailJson
          toast.success(`Invoice #${invoice.invoiceNumber} — $${Number(invoice.amount).toFixed(2)} will be charged`)
          const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
          await downloadInvoicePdf(fullInvoice, 'en').catch((e) => console.error('[BookingsPage] PDF failed', e))
        }
      }

      if (type === 'delete-invoice') {
        const res = await fetch(`/api/accounting/invoices/${invoice.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error?.message ?? 'Failed to delete invoice')
          return
        }
      }

      if (booking.reservationId) {
        const res = await fetch(`/api/reservations/${booking.reservationId}`, { method: 'DELETE' })
        const data = await res.json()
        if (!data.ok) {
          toast.error(data.error?.message ?? 'Failed to delete reservation')
        }
      }
      await fetchBookings()
      await fetchRooms()
    } catch {
      toast.error('Failed to delete booking')
    } finally {
      setDeleteBookingInvoiceLoading(false)
      setDeleteBookingInvoiceOpen(false)
      setDeleteBookingInvoiceData(null)
    }
  }, [deleteBookingInvoiceData, fetchBookings, fetchRooms])

  const handleDownloadInvoiceFromDelete = useCallback(async () => {
    if (!deleteBookingInvoiceData) return
    const { invoice } = deleteBookingInvoiceData
    try {
      const detailRes = await fetch(`/api/accounting/invoices/${invoice.id}`)
      if (!detailRes.ok) return
      const detailJson = await detailRes.json()
      const fullInvoice = detailJson.data ?? detailJson
      const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
      await downloadInvoicePdf(fullInvoice, 'en')
    } catch (e) {
      console.error('Invoice PDF download failed', e)
      toast.error('Failed to generate invoice PDF')
    }
  }, [deleteBookingInvoiceData])

  const filteredBookings = useMemo(() => {
    let result = bookings

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (b) =>
          b.guestName.toLowerCase().includes(q) ||
          b.roomNumber.toLowerCase().includes(q),
      )
    }

    if (dateRange.startDate) {
      const start = new Date(dateRange.startDate)
      result = result.filter((b) => new Date(b.checkIn) >= start || new Date(b.checkOut) >= start)
    }
    if (dateRange.endDate) {
      const end = new Date(dateRange.endDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter((b) => new Date(b.checkIn) <= end || new Date(b.checkOut) <= end)
    }

    if (bookingStatusFilter) {
      result = result.filter((b) => b.status === bookingStatusFilter)
    }

    if (guestTypeFilter) {
      result = result.filter((b) => b.guestType === guestTypeFilter)
    }

    // Group order: currently checked-in first, then upcoming (booked/confirmed),
    // then checked-out, cancelled last. Nearest check-in date first within each group.
    const statusRank: Record<BookingStatus, number> = {
      'checked-in': 0,
      booked: 1,
      confirmed: 1,
      'checked-out': 2,
      cancelled: 3,
    }
    return [...result].sort((a, b) => {
      const rankDiff = statusRank[a.status] - statusRank[b.status]
      if (rankDiff !== 0) return rankDiff
      return new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
    })
  }, [bookings, searchQuery, dateRange, bookingStatusFilter, guestTypeFilter])

  // Separate display bookings (for table) from all bookings (for room status grid)
  const displayAllBookings = useMemo(
    () => bookings.filter((b) => !b.isSubBooking),
    [bookings],
  )

  const displayBookings = useMemo(
    () => filteredBookings.filter((b) => !b.isSubBooking),
    [filteredBookings],
  )

  const tableRows: BookingsTableRow[] = useMemo(
    () =>
      displayBookings.map((booking) => {
        const room = rooms.find((r) => r.id === booking.roomId)
        const roomType = room ? roomTypeMap.get(room.roomTypeId) : undefined
        const activePricing = room ? pricingMap.get(room.roomTypeId) : undefined
        const guest = booking.guestId ? guestMap.get(booking.guestId) : undefined
        const ms = new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()
        const nights = Math.round(ms / 86_400_000) || 1

        const derived = deriveRoomPrice({
          room: room ?? { price: 0, roomTypeId: '' },
          roomType,
          pricing: activePricing,
          booking,
          nights,
          formatCurrency,
        })

        return {
          booking,
          guest,
          priceLabel: derived.displayPricePerNight,
          totalPriceLabel: derived.displayTotalPrice,
          nights,
          status: booking.status,
        }
      }),
    [displayBookings, rooms, roomTypeMap, pricingMap, guestMap, formatCurrency],
  )

  const handleRefresh = useCallback(() => {
    void fetchBookings()
  }, [fetchBookings])

  return (
    <main className="w-full">
      <div className="py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">
              {t('bookings.title')}
            </h1>
            <p className="mt-1 text-sm font-medium text-[#787774]">
              {t('bookings.subtitle')}
            </p>
          </div>
          <Link
            href={`/${locale}/reservations/year-view`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm font-medium text-[#555555] transition-colors hover:bg-[#F9F9F8]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {t('bookings.yearView.open')}
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
          <RoomStatusPanel
            rooms={rooms}
            roomTypes={roomTypes}
            pricing={pricing}
            bookings={bookings}
            roomReservationDates={roomReservationDates}
            selectedDate={new Date()}
            formatCurrency={formatCurrency}
            statusFilter={roomStatusFilter}
            onRoomClick={handleRoomClick}
            onRefresh={handleRefresh}
            onFilterClick={() => setRoomFilterOpen(true)}
            dateRange={dateRange}
          />
          <BookingStatsCards
            bookings={displayAllBookings}
            formatCurrency={formatCurrency}
            loading={bookingsLoading}
          />
        </div>

        <div className="mt-5">
          <BookingListPanel
            rows={tableRows}
            loading={bookingsLoading || roomsLoading || guestsLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onFilterClick={() => setBookingFilterOpen(true)}
            onAddBooking={canCreateReservation ? handleAddBooking : undefined}
            onCheckIn={(b) => handleAction('checkIn', b)}
            onCheckOut={(b) => handleAction('checkOut', b)}
            onCancel={(b) => handleAction('cancel', b)}
            onEdit={(b) => handleAction('edit', b)}
            onView={(b) => handleAction('view', b)}
            onInvoice={(b) => handleAction('invoice', b)}
            onDelete={(b) => handleAction('delete', b)}
            onNavigate={(b) => handleAction('navigate', b)}
          />
        </div>
      </div>

      <RoomDetailsModal
        isOpen={roomDetailOpen}
        onClose={() => setRoomDetailOpen(false)}
        room={selectedRoom}
        roomTypes={roomTypes}
        availability={selectedAvailability}
        priceLabel={selectedPriceLabel}
        history={selectedRoomHistory}
        onMarkAvailable={handleMarkRoomAvailable}
        onSetMaintenance={handleSetMaintenance}
      />

      <BookingListFilterModal
        isOpen={bookingFilterOpen}
        onClose={() => setBookingFilterOpen(false)}
        current={{ startDate: dateRange.startDate, endDate: dateRange.endDate, status: bookingStatusFilter, guestType: guestTypeFilter }}
        onApply={(f) => {
          setDateRange({ startDate: f.startDate, endDate: f.endDate })
          setBookingStatusFilter(f.status)
          setGuestTypeFilter(f.guestType)
        }}
      />

      <RoomStatusFilterModal
        isOpen={roomFilterOpen}
        onClose={() => setRoomFilterOpen(false)}
        current={{ startDate: dateRange.startDate, endDate: dateRange.endDate, status: roomStatusFilter }}
        onApply={(f) => {
          setDateRange({ startDate: f.startDate, endDate: f.endDate })
          setRoomStatusFilter(f.status)
        }}
      />

      <BookingDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        booking={detailBooking}
        guest={detailBooking ? guests.find((g) => g.id === detailBooking.guestId) : null}
      />

      <CheckoutConfirmModal
        key={`checkout-${checkoutBooking?.id ?? 'none'}`}
        isOpen={!!checkoutBooking}
        onClose={() => { setCheckoutBooking(null); setCheckoutSavedCharges([]) }}
        booking={checkoutBooking}
        formatCurrency={formatCurrency}
        onConfirm={handleCheckoutConfirm}
        savedCharges={checkoutSavedCharges}
        invoiceSummary={checkoutBooking ? {
          status: checkoutBooking.paidAmount >= checkoutBooking.totalAmount && checkoutBooking.paidAmount > 0
            ? 'paid'
            : checkoutBooking.paidAmount > 0 ? 'partially_paid' : 'issued',
          paidAmount: checkoutBooking.paidAmount,
          remainingBalance: Math.max(0, checkoutBooking.totalAmount - checkoutBooking.paidAmount),
        } : null}
      />

      <DeleteConfirmationDialog
        isOpen={confirmAction?.action === 'delete'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        loading={confirmDeleting}
        title={t('bookings.deleteBookingTitle')}
        description={confirmAction ? t('bookings.deleteBookingDescription').replace('{name}', confirmAction.booking.guestName) : ''}
        confirmLabel={t('bookings.deleteConfirmLabel')}
        cancelLabel={t('bookings.keepLabel')}
      />

      {bookingCancelOpen && confirmAction?.booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="rounded-xl border border-[#EAEAEA] bg-white p-6 w-96">
            <p className="text-sm font-medium text-[#1A1A1A]">{t('bookings.cancelBookingTitle')}</p>
            <p className="mt-1 text-sm text-[#787774]">{t('bookings.cancelBookingDescription')}</p>
            <div className="mt-4">
              <label className="text-xs font-medium text-[#787774]">{t('bookings.cancellationFeeAmount')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bookingCancelFee}
                onChange={(e) => setBookingCancelFee(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#EAEAEA] px-3 py-2 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10"
                placeholder="0.00"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setBookingCancelOpen(false); setBookingCancelFee(''); setConfirmAction(null) }}
                disabled={bookingCancelLoading}
                className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8] disabled:opacity-50"
              >
                {t('bookings.backLabel')}
              </button>
              <button
                onClick={() => handleBookingCancel()}
                disabled={bookingCancelLoading}
                className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                {t('bookings.justCancel')}
              </button>
              <button
                onClick={() => handleBookingCancel(Number(bookingCancelFee) || undefined)}
                disabled={bookingCancelLoading}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {t('bookings.cancelAndChargeFee')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BookingDeleteModal
        isOpen={deleteBookingInvoiceOpen}
        onClose={() => { setDeleteBookingInvoiceOpen(false); setDeleteBookingInvoiceData(null) }}
        onChargeBooking={() => handleDeleteBookingWithInvoice('charge')}
        onDeleteInvoice={() => handleDeleteBookingWithInvoice('delete-invoice')}
        onDownloadInvoice={handleDownloadInvoiceFromDelete}
        bookingGuestName={deleteBookingInvoiceData?.booking?.guestName ?? ''}
        invoice={deleteBookingInvoiceData?.invoice ?? null}
        chargeAmount={deleteBookingInvoiceData?.invoice?.amount}
        chargeInvoiceNumber={deleteBookingInvoiceData?.invoice?.invoiceNumber}
        loading={deleteBookingInvoiceLoading}
      />
    </main>
  )
}
