'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useCallback, useMemo } from 'react'
import { useResource } from '@/shared/data/useResource'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { reservationService } from '@/services/reservationService'
import { SkeletonCard } from '@/shared/components/SkeletonCard'
import type { ReservationDetail } from '@/modules/reservations/types'
import type { Booking } from '@/modules/bookings/types'
import { ExtendBookingModal } from '@/modules/bookings/components/ExtendBookingModal'
import { ShortenBookingModal } from '@/modules/bookings/components/ShortenBookingModal'
import { CheckoutConfirmModal, type CheckoutPaymentInfo, type InvoicePaymentSummary } from '@/modules/bookings/components/CheckoutConfirmModal'
import { AddExtraChargeModal } from '@/modules/bookings/components/AddExtraChargeModal'
import { ChangeRoomModal } from './ChangeRoomModal'
import { EditPriceModal } from './EditPriceModal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { toast } from '@/shared/toast/toastEvents'
import { ReservationDetailHeader } from './ReservationDetailHeader'
import { RoomGuestCard } from './RoomGuestCard'
import { ReservationNotes } from './ReservationNotes'
import { ReservationActions } from './ReservationActions'

async function fetchReservation(id: string): Promise<ReservationDetail> {
  const res = await reservationService.getById(id)
  if (res.ok && res.data) return res.data
  throw new Error(res.error?.message ?? '')
}

export function ReservationDetailPage() {
  const { t } = useTranslation()
  const { id, locale } = useParams<{ id: string; locale: string }>()
  const router = useRouter()
  const { formatCurrency, vatRate, serviceChargeRate } = useCurrency()
  // Cached per reservation: refreshes after actions keep the page on screen
  // instead of flashing the skeleton.
  const reservation = useResource(`/api/reservations/${id}`, () => fetchReservation(id))
  const detail = reservation.data ?? null
  const loading = reservation.isLoading
  const error = reservation.error ? reservation.error.message || t('reservations.failedToLoadReservation') : null
  const fetchDetail = reservation.refresh
  const refreshDetail = reservation.refresh
  const [extendRoom, setExtendRoom] = useState<ReservationDetail['rooms'][number] | null>(null)
  const [shortenRoom, setShortenRoom] = useState<ReservationDetail['rooms'][number] | null>(null)
  const [changeRoom, setChangeRoom] = useState<ReservationDetail['rooms'][number] | null>(null)
  const [editPriceRoom, setEditPriceRoom] = useState<ReservationDetail['rooms'][number] | null>(null)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [checkoutInvoiceSummary, setCheckoutInvoiceSummary] = useState<InvoicePaymentSummary | null>(null)
  const [extraChargeRoom, setExtraChargeRoom] = useState<ReservationDetail['rooms'][number] | null>(null)
  const [extraChargeModalOpen, setExtraChargeModalOpen] = useState(false)
  const [extendedRooms, setExtendedRooms] = useState<Record<string, { date: string; roomNumber?: string }>>({})
  const [shortenedRooms, setShortenedRooms] = useState<Record<string, { date: string }>>({})

  const handlePriceSave = useCallback(async (reservationRoomId: string, ratePerNight: number | null, reason?: string) => {
    const res = await fetch(`/api/reservations/${id}/rooms/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationRoomId, ratePerNight, reason }),
    })
    const json = await res.json()
    if (!json.ok) {
      toast.error(json.error?.message ?? t('reservations.priceSaveFailed'))
      throw new Error(json.error?.message ?? 'price save failed')
    }
    toast.success(t('reservations.priceSaved'))
    await refreshDetail()
  }, [id, refreshDetail, t])

  /** Convert a reservation + optional room into a Booking-shaped object */
  const buildBooking = useCallback((room?: ReservationDetail['rooms'][number]): Booking | null => {
    if (!detail) return null
    const detailFields = detail as ReservationDetail & {
      check_in_date?: string | null
      check_out_date?: string | null
      paid_amount?: number | string | null
      total_amount?: number | string | null
      created_at?: string | null
      updated_at?: string | null
    }
    const roomFields = room as ReservationDetail['rooms'][number] & {
      room_number?: string | null
      check_in_date?: string | null
      check_out_date?: string | null
      total_amount?: number | string | null
      created_at?: string | null
      updated_at?: string | null
    }
    const primaryGuest = detail.guests.find((g) => g.is_primary) ?? detail.guests[0]
    const status = String(detail.status).toLowerCase()
    const bookingStatus: Booking['status'] = status === 'checked_in'
      ? 'checked-in'
      : status === 'checked_out'
        ? 'checked-out'
        : status === 'cancelled'
          ? 'cancelled'
          : status === 'confirmed'
            ? 'confirmed'
            : 'booked'

    const occCode = (room as unknown as { occupancy_code?: string | null }).occupancy_code
    const occLabel = occCode === 'T' ? 'Triple' : occCode === 'D' ? 'Double' : occCode === 'S' ? 'Single' : undefined
    const occCapacity = occCode === 'T' ? 3 : occCode === 'D' ? 2 : occCode === 'S' ? 1 : (room as unknown as { room_capacity?: number | null }).room_capacity ?? undefined
    const nightly = Number((room as unknown as { rate_per_night?: number }).rate_per_night ?? (room as unknown as { nightly_rate?: number }).nightly_rate ?? 0)

    return {
      id: room?.id ?? detail.id,
      reservationId: detail.id,
      contactId: detail.companyInfo?.company_id ?? undefined,
      guestId: primaryGuest?.guest_id ?? '',
      guestName: primaryGuest?.full_name ?? detail.companyInfo?.company_name ?? t('reservations.reservationGuestFallback'),
      roomId: room?.room_id ?? '',
      roomNumber: roomFields?.room_number ?? room?.room_id?.slice(0, 8) ?? '—',
      checkIn: new Date(roomFields?.check_in_date ?? detailFields.check_in_date ?? new Date()),
      checkOut: new Date(roomFields?.check_out_date ?? detailFields.check_out_date ?? new Date()),
      status: bookingStatus,
      totalAmount: Number(roomFields?.total_amount ?? detailFields.total_amount ?? 0),
      paidAmount: Number(detailFields.paid_amount ?? 0),
      createdAt: new Date(roomFields?.created_at ?? detailFields.created_at ?? new Date()),
      updatedAt: new Date(roomFields?.updated_at ?? detailFields.updated_at ?? new Date()),
      occupancyLabel: occLabel,
      nightlyRate: nightly,
      capacity: occCapacity,
    } satisfies Booking
  }, [detail, t])

  const extendBooking = detail && extendRoom ? buildBooking(extendRoom) : null
  const shortenBooking = detail && shortenRoom ? buildBooking(shortenRoom) : null
  /** Build checkout booking — use reservation total (includes tax/service from snapshotPricing) */
  const checkoutBooking = detail && checkoutModalOpen
    ? (() => {
        const base = buildBooking(detail.rooms[0])
        if (!base) return null
        const roomNumbers = detail.rooms
          .map(r => (r as { room_number?: string | null; room_id?: string }).room_number ?? r.room_id?.slice(0, 8) ?? '—')
          .join(', ')
        return { ...base, id: detail.id, roomNumber: roomNumbers, totalAmount: Number(detail.total_amount ?? 0), roomCount: detail.rooms.length }
      })()
    : null

  /** Compute pricing breakdown from snapshotPricing items */
  const checkoutPricingBreakdown = useMemo(() => {
    if (!detail) return undefined
    const roomCharges = detail.pricingItems
      .filter(p => p.pricing_level === 'nightly_rate')
      .reduce((s, p) => s + p.total_amount, 0)
    const serviceCharge = detail.pricingItems
      .filter(p => p.pricing_level === 'service_charge')
      .reduce((s, p) => s + p.total_amount, 0)
    const taxAmount = detail.pricingItems
      .filter(p => p.pricing_level === 'tax')
      .reduce((s, p) => s + p.total_amount, 0)
    // ponytail: estimate from total when pricing items missing (existing reservations)
    if (roomCharges === 0 && serviceCharge === 0 && taxAmount === 0) {
      const total = Number(detail.total_amount ?? 0)
      if (total > 0) {
        // Derive net from a tax-inclusive gross using the live system rates
        // (accounting settings), not stale hardcoded percentages.
        const divisor = 1 + serviceChargeRate / 100 + (vatRate / 100) * (1 + serviceChargeRate / 100)
        const estimatedRoom = Math.round((total / divisor) * 100) / 100
        const estimatedService = Math.round(estimatedRoom * (serviceChargeRate / 100) * 100) / 100
        const estimatedTax = Math.round((estimatedRoom + estimatedService) * (vatRate / 100) * 100) / 100
        return { roomCharges: estimatedRoom, serviceCharge: estimatedService, taxAmount: estimatedTax }
      }
      return undefined
    }
    return { roomCharges, serviceCharge, taxAmount }
  }, [detail, vatRate, serviceChargeRate])

  /** Derive previously saved extra charges for the selected room */
  const savedRoomCharges = useMemo(() => {
    if (!detail || !extraChargeRoom) return []
    return detail.pricingItems
      .filter((p) => p.pricing_level === 'extra' && p.reservation_room_id === extraChargeRoom.id)
      .map((p) => ({
        id: p.id,
        day_index: 0,
        day_label: '',
        label: p.manual_override_reason ?? t('reservations.extraChargeFallback'),
        amount: p.total_amount,
      }))
  }, [detail, extraChargeRoom, t])

  /** All extra charges across all rooms (for checkout modal) */
  const allExtraCharges = useMemo(() => {
    if (!detail) return []
    return detail.pricingItems
      .filter((p) => p.pricing_level === 'extra')
      .map((p) => ({
        id: p.id,
        day_index: 0,
        day_label: '',
        label: `${p.manual_override_reason ?? t('reservations.extraChargeFallback')}${p.reservation_room_id ? t('reservations.roomSuffix') : ''}`,
        amount: p.total_amount,
      }))
  }, [detail, t])

  /** Fetch how much of the reservation's invoice is already paid (accounting module) */
  const fetchCheckoutInvoiceSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounting/invoices?reservationId=${encodeURIComponent(id)}`)
      if (!res.ok) {
        setCheckoutInvoiceSummary(null)
        return
      }
      const json = await res.json()
      const invoices = (json.data ?? []) as Array<{ status: string; paidAmount: number; remainingBalance: number; discount?: number }>
      const active = invoices.filter((i) => !['void', 'cancelled'].includes(String(i.status)))
      const invoice = active[active.length - 1]
      setCheckoutInvoiceSummary(invoice
        ? {
            status: String(invoice.status),
            paidAmount: Number(invoice.paidAmount ?? 0),
            remainingBalance: Number(invoice.remainingBalance ?? 0),
            discount: Number(invoice.discount ?? 0),
          }
        : null)
    } catch {
      setCheckoutInvoiceSummary(null)
    }
  }, [id])

  const handleCheckoutConfirm = useCallback(async (bookingId: string, extraCharges: Array<{ label: string; amount: number }>, payment: CheckoutPaymentInfo) => {    try {
      const res = await fetch(`/api/reservations/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraCharges,
          paymentMethod: payment.method,
          paidAmount: payment.paidAmount,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? t('reservations.checkoutFailed'))
        return
      }
      toast.success(t('reservations.checkedOutSuccess'))
      setCheckoutModalOpen(false)
      await fetchDetail()

      // Download invoice PDF if available
      if (json.invoice) {
        try {
          const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
          setTimeout(() => downloadInvoicePdf(json.invoice, 'en').catch((e) => console.error('[ReservationDetailPage] PDF failed', e)), 500)
        } catch {
          // PDF download is non-critical
        }
      }
    } catch {
      toast.error(t('reservations.networkErrorCheckout'))
    }
  }, [id, t, fetchDetail])

  const handleSaveExtraCharges = useCallback(async (_bookingId: string, charges: Array<{ dayIndex: number; dayLabel: string; label: string; amount: number }>) => {
    if (!extraChargeRoom) return
    const res = await fetch(`/api/reservations/${id}/extras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationRoomId: extraChargeRoom.id,
        charges,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: t('reservations.failedToSaveFallback') } }))
      const errMsg = typeof err.error === 'string' ? err.error : err.error?.message ?? t('reservations.failedToSaveExtraCharges')
      toast.error(errMsg)
      throw new Error(errMsg)
    }
    toast.success(t('reservations.extraChargesAdded'))
    setExtraChargeModalOpen(false)
    setExtraChargeRoom(null)
    await fetchDetail()
  }, [extraChargeRoom, id, t, fetchDetail])

  const handleEditReservation = useCallback(() => {
    router.push(`/${locale}/reservations/${id}/edit`)
  }, [id, locale, router])

  const handleExtendRoom = async (reservationRoomId: string, newCheckOut: Date, newRoomId?: string, newRoomNumber?: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationRoomId,
          newRoomId,
          newRoomNumber,
          newCheckOut: newCheckOut.toISOString().slice(0, 10),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? t('reservations.failedToExtendRoom'))
        return
      }
      toast.success(t('reservations.roomStayExtended'))
      setExtendRoom(null)
      setExtendedRooms((prev) => ({ ...prev, [reservationRoomId]: { date: newCheckOut.toISOString().slice(0, 10), roomNumber: newRoomNumber } }))
      await fetchDetail()
    } catch {
      toast.error(t('reservations.networkErrorExtend'))
    }
  }

  const handleShortenRoom = async (reservationRoomId: string, newCheckOut: Date) => {
    try {
      const res = await fetch(`/api/reservations/${id}/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationRoomId,
          newCheckOut: newCheckOut.toISOString().slice(0, 10),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? t('reservations.failedToShortenRoom'))
        return
      }
      toast.success(t('reservations.roomStayShortened'))
      setShortenRoom(null)
      setShortenedRooms((prev) => ({ ...prev, [reservationRoomId]: { date: newCheckOut.toISOString().slice(0, 10) } }))
      await fetchDetail()
    } catch {
      toast.error(t('reservations.networkErrorShorten'))
    }
  }

  const handleChangeRoomAction = async (reservationRoomId: string, newRoomId: string, newRoomNumber: string, occupancyCode: 'S' | 'D' | 'T') => {
    try {
      const res = await fetch(`/api/reservations/${id}/change-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationRoomId, newRoomId, newRoomNumber, occupancyCode }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? t('reservations.failedToChangeRoom'))
        return
      }
      toast.success(t('reservations.roomChanged'))
      setChangeRoom(null)
      await fetchDetail()
    } catch {
      toast.error(t('reservations.networkErrorChangeRoom'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <SkeletonCard />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-[#EAEAEA] bg-white p-8">
          <p className="text-sm font-semibold text-rose-700">{error ?? t('reservations.reservationNotFound')}</p>
          <p className="mt-2 text-sm text-[#787774]">{t('reservations.couldNotBeLoaded')}</p>
          <button
            onClick={() => router.push(`/${locale}/reservations`)}
            className="mt-5 inline-flex items-center rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
          >
            {t('reservations.backToReservations')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <button
          onClick={() => router.push(`/${locale}/reservations`)}
          className="inline-flex items-center text-sm font-medium text-[#787774] transition-colors hover:text-[#333333]"
        >
          {t('reservations.backToReservations')}
        </button>

        <ReservationDetailHeader detail={detail} />

        <ReservationActions
          detail={detail}
          onRefresh={fetchDetail}
          onDeleted={() => router.replace(`/${locale}/reservations`)}
          onEdit={() => handleEditReservation()}
        />
        <div className="flex flex-wrap gap-2">
          {String(detail.status).toLowerCase() === 'checked_in' && (
            <button
              type="button"
              onClick={() => {
                setCheckoutModalOpen(true)
                void fetchCheckoutInvoiceSummary()
              }}
              data-tooltip={t('reservations.hints.checkOut')}
              className="rounded-lg bg-[#1A1A1A] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333333]"
            >
              {t('reservations.checkOutButton')}
            </button>
          )}
          {String(detail.status).toLowerCase() === 'checked_out' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const invRes = await fetch(`/api/accounting/invoices?reservationId=${encodeURIComponent(id)}`)
                  const invJson = await invRes.json()
                  const invoices = invJson.data ?? []
                  if (invoices.length > 0) {
                    const invoice = invoices[invoices.length - 1]
                    const fullRes = await fetch(`/api/accounting/invoices/${invoice.id}`)
                    const fullJson = await fullRes.json()
                    const fullInvoice = fullJson.data ?? fullJson
                    const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
                    await downloadInvoicePdf(fullInvoice, 'en')
                  } else {
                    toast.error(t('reservations.noInvoiceFound'))
                  }
                } catch (e) {
                  toast.error(t('reservations.failedToLoadInvoice'))
                  console.error(e)
                }
              }}
              className="rounded-lg border border-[#EAEAEA] bg-white px-5 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('reservations.invoiceButton')}
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">{t('reservations.roomManifest')}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1A1A1A]">{t('reservations.roomsAndGuests')}</h2>
              </div>
              <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-[11px] font-medium text-[#787774]">
                {detail.rooms.length === 1
                  ? t('reservations.roomCountSingular').replace('{n}', String(detail.rooms.length))
                  : t('reservations.roomCountPlural').replace('{n}', String(detail.rooms.length))}
              </span>
            </div>

            {detail.rooms.length > 0 ? (
              <div className="space-y-4">
                  {detail.rooms.map((room) => (
                    <RoomGuestCard
                      key={room.id}
                      room={room}
                      reservationId={id}
                      guests={detail.guests.filter((g) => g.reservation_room_id === room.id)}
                      onGuestChange={refreshDetail}
                      roomCapacity={(room as { room_capacity?: number | null }).room_capacity ?? undefined}
                      extendedDate={extendedRooms[room.id]?.date}
                      shortenedDate={shortenedRooms[room.id]?.date}
                      onExtend={['held', 'confirmed', 'checked_in'].includes(String(detail.status).toLowerCase()) ? setExtendRoom : undefined}
                      onShorten={
                        ['held', 'confirmed', 'checked_in'].includes(String(detail.status).toLowerCase())
                        && Math.round((new Date(room.check_out_date ?? detail.check_out_date).getTime() - new Date(room.check_in_date ?? detail.check_in_date).getTime()) / 86400000) > 1
                          ? setShortenRoom
                          : undefined
                      }
                      onChangeRoom={['held', 'confirmed', 'checked_in'].includes(String(detail.status).toLowerCase()) ? setChangeRoom : undefined}
                      onEditPrice={['held', 'confirmed', 'checked_in'].includes(String(detail.status).toLowerCase()) ? setEditPriceRoom : undefined}
                      onExtraCharge={['checked_in', 'confirmed'].includes(String(detail.status).toLowerCase()) ? (r) => { setExtraChargeRoom(r); setExtraChargeModalOpen(true) } : undefined}
                    />
                  ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#EAEAEA] bg-[#F9F9F8] p-8 text-center">
                <p className="text-sm font-medium text-[#333333]">{t('reservations.noRoomsAssigned')}</p>
                <p className="mt-1 text-sm text-[#787774]">{t('reservations.assignRoomBeforeCheckIn')}</p>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <ReservationNotes reservationId={id} notes={detail.notes} onUpdate={refreshDetail} />

            <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
              <div className="mb-5">
                <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">{t('reservations.auditTrail')}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1A1A1A]">{t('reservations.statusHistory')}</h2>
              </div>
              {detail.statusHistory.length > 0 ? (
                <div className="space-y-3">
                  {detail.statusHistory.map((h) => (
                    <div key={h.id} className="border-b border-[#EAEAEA] pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-[#333333]">
                        <span>{h.from_status ?? t('reservations.statusNew')}</span>
                        <span className="text-[#BBBBBB]">{t('reservations.statusTo')}</span>
                        <span>{h.to_status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#787774]">{new Date(h.changed_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#EAEAEA] bg-[#F9F9F8] px-4 py-5 text-sm text-[#787774] text-center">
                  {t('reservations.noLifecycleEvents')}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      <ExtendBookingModal
        isOpen={Boolean(extendRoom)}
        onClose={() => setExtendRoom(null)}
        booking={extendBooking}
        onExtend={handleExtendRoom}
      />

      <ShortenBookingModal
        isOpen={Boolean(shortenRoom)}
        onClose={() => setShortenRoom(null)}
        booking={shortenBooking}
        onShorten={handleShortenRoom}
      />

      <ChangeRoomModal
        isOpen={Boolean(changeRoom)}
        onClose={() => setChangeRoom(null)}
        room={changeRoom}
        onChangeRoom={handleChangeRoomAction}
      />

      <EditPriceModal
        isOpen={Boolean(editPriceRoom)}
        onClose={() => setEditPriceRoom(null)}
        room={editPriceRoom}
        onSave={handlePriceSave}
      />

      <CheckoutConfirmModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        booking={checkoutBooking}
        formatCurrency={formatCurrency}
        onConfirm={handleCheckoutConfirm}
        savedCharges={allExtraCharges}
        pricingBreakdown={checkoutPricingBreakdown}
        invoiceSummary={checkoutInvoiceSummary}
      />

      <AddExtraChargeModal
        isOpen={extraChargeModalOpen}
        onClose={() => { setExtraChargeModalOpen(false); setExtraChargeRoom(null) }}
        booking={extraChargeRoom ? buildBooking(extraChargeRoom) : null}
        formatCurrency={formatCurrency}
        onSave={handleSaveExtraCharges}
        savedCharges={savedRoomCharges}
      />
    </div>
  )
}
