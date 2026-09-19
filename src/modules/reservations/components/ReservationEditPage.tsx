'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useCallback, type FormEvent } from 'react'
import { toast } from '@/shared/toast/toastEvents'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { FloatingInput } from '@/shared/components/FloatingField'
import { roomService } from '@/services/roomService'
import { reservationService } from '@/services/reservationService'
import type { Room } from '@/modules/rooms/types'
import type { RoomType } from '@/modules/room-types/types'
import type { RoomTypePricing } from '@/modules/pricing/types'
import type { ReservationDetail, OccupancyCode } from '@/modules/reservations/types'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

interface FormData {
  check_in_date: string
  check_out_date: string
  booker_name: string
  booker_email: string
  booker_phone: string
  selectedRoomIds: string[]
}


async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as { data?: T } | null
  return json?.data ?? null
}

export function ReservationEditPage() {
  const { id, locale } = useParams<{ id: string; locale: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const { formatCurrency, vatRate: vatPercent, serviceChargeRate: serviceChargePercent } = useCurrency()

  // Data
  const [detail, setDetail] = useState<ReservationDetail | null>(null)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [availableRoomIds, setAvailableRoomIds] = useState<Set<string>>(new Set())
  const [companyPriceOverrides, setCompanyPriceOverrides] = useState<Record<string, Record<string, number>>>({})
  const [roomTypePricing, setRoomTypePricing] = useState<Record<string, { price: number; price_single?: number; price_double?: number; price_triple?: number }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState<FormData>({
    check_in_date: '',
    check_out_date: '',
    booker_name: '',
    booker_email: '',
    booker_phone: '',
    selectedRoomIds: [],
  })
  const [roomOccupancies, setRoomOccupancies] = useState<Record<string, OccupancyCode>>({})
  const [lineOverrides, setLineOverrides] = useState<Record<string, string>>({})
  // Rates as loaded from the reservation. A box still holding its baseline was
  // never touched by staff, so it must not be sent as a manual price override.
  const [baselineOverrides, setBaselineOverrides] = useState<Record<string, string>>({})
  // ponytail: load service/vat from settings so the edit preview matches
  // pricingService.calculatePricing on the server rather than a hardcoded 10/14.
  const serviceChargeRate = serviceChargePercent / 100
  const vatRate = vatPercent / 100

  // Derived
  const datesValid = Boolean(form.check_in_date && form.check_out_date && new Date(form.check_out_date) > new Date(form.check_in_date))
  const status = String(detail?.status ?? '').toLowerCase()
  const canEdit = ['draft', 'held'].includes(status)

  const roomTypeMap = useMemo(() => new Map(roomTypes.map((rt) => [rt.id, rt])), [roomTypes])
  const roomsByType = useMemo(() => {
    const grouped = new Map<string, Room[]>()
    for (const room of allRooms) {
      const list = grouped.get(room.roomTypeId) ?? []
      list.push(room)
      grouped.set(room.roomTypeId, list)
    }
    return grouped
  }, [allRooms])

  const roomTypeIds = useMemo(() => Array.from(roomsByType.keys()), [roomsByType])

  const nights = useMemo(() => {
    if (!datesValid) return 0
    const ci = new Date(form.check_in_date)
    const co = new Date(form.check_out_date)
    return Math.max(1, Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24)))
  }, [form.check_in_date, form.check_out_date, datesValid])

  // Preserves selection order (not allRooms' fetch order) so "last room in a
  // group" below actually means "most recently added", not an arbitrary member.
  const selectedRooms = useMemo(() => {
    const byId = new Map(allRooms.map((r) => [r.id, r]))
    return form.selectedRoomIds.map((rid) => byId.get(rid)).filter((r): r is Room => r != null)
  }, [allRooms, form.selectedRoomIds])

  // Keyed by physical room id (not room type) so each room added, even of the
  // same type, gets its own independent override instead of sharing one price.
  function getOverrideFor(roomId: string): number | undefined {
    const raw = lineOverrides[roomId]
    if (!raw || raw.trim() === '') return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
  }

  function getStandardRoomPrice(room: Room): { price: number; occCode: OccupancyCode; occLabel: string } {
    const rt = roomTypeMap.get(room.roomTypeId)
    const defaultOcc: OccupancyCode = room.capacity >= 3 ? 'T' : room.capacity === 2 ? 'D' : 'S'
    const occCode = roomOccupancies[room.id] ?? defaultOcc
    const occLabel = occCode === 'T' ? 'Triple' : occCode === 'D' ? 'Double' : 'Single'
    if (!rt) return { price: 0, occCode, occLabel }
    let price = rt.basePrice
    const pricing = roomTypePricing[rt.id]
    if (pricing) {
      if (occCode === 'S' && pricing.price_single != null) price = pricing.price_single
      else if (occCode === 'D' && pricing.price_double != null) price = pricing.price_double
      else if (occCode === 'T' && pricing.price_triple != null) price = pricing.price_triple
      else if (pricing.price > 0) price = pricing.price
    }
    if (detail?.companyInfo) {
      const companyOverride = companyPriceOverrides[rt.slug]?.[occCode]
      if (companyOverride !== undefined) price = companyOverride
    }
    return { price, occCode, occLabel }
  }

  function computePricing() {
    if (!datesValid || form.selectedRoomIds.length === 0) return null
    // Grouped by (type, occupancy, actual price) so a room whose price gets
    // overridden splits off into its own line instead of staying lumped in
    // with same-type siblings still on the standard rate.
    const groups = new Map<string, { key: string; name: string; standardPrice: number; price: number; count: number; occLabel: string; roomIds: string[] }>()

    for (const room of selectedRooms) {
      const rt = roomTypeMap.get(room.roomTypeId)
      if (!rt) continue
      const { price: standardPrice, occCode, occLabel } = getStandardRoomPrice(room)
      const price = getOverrideFor(room.id) ?? standardPrice
      const key = `${rt.id}:${occCode}:${price}`
      const existing = groups.get(key)
      if (existing) {
        existing.count++
        existing.roomIds.push(room.id)
      } else {
        groups.set(key, { key, name: rt.name, standardPrice, price, count: 1, occLabel, roomIds: [room.id] })
      }
    }

    const roomDetails = Array.from(groups.values())
    const roomCharges = roomDetails.reduce((sum, g) => sum + g.price * g.count * nights, 0)
    const serviceCharge = roomCharges * serviceChargeRate
    const tax = (roomCharges + serviceCharge) * vatRate
    const total = roomCharges + serviceCharge + tax
    return { roomDetails, roomCharges, serviceCharge, tax, total }
  }
  const pricing = computePricing()

  // Load initial data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, roomsData] = await Promise.all([
          fetch(`/api/reservations/${id}`),
          roomService.getAll(),
        ])


        const json = await res.json()
        if (!json.ok || !json.data) {
          if (!cancelled) setError(json.error?.message ?? 'Failed to load')
          return
        }
        const data = json.data as ReservationDetail
        const df = data as ReservationDetail & {
          check_in_date?: string; check_out_date?: string
          booker_name?: string; booker_email?: string; booker_phone?: string
        }

        // Load room types
        const [rtData, pricingData] = await Promise.all([
          fetchJson<RoomType[]>('/api/room-types'),
          fetchJson<RoomTypePricing[]>('/api/pricing'),
        ])

        // Most recent pricing window first (nulls last), first row per type wins.
        const sortedPricing = [...(pricingData ?? [])].sort((a, b) =>
          (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? ''),
        )
        const pricingMap: Record<string, { price: number; price_single?: number; price_double?: number; price_triple?: number }> = {}
        for (const row of sortedPricing) {
          if (!pricingMap[row.roomTypeId]) {
            pricingMap[row.roomTypeId] = {
              price: Number(row.price),
              price_single: row.priceSingle ?? undefined,
              price_double: row.priceDouble ?? undefined,
              price_triple: row.priceTriple ?? undefined,
            }
          }
        }

        if (!cancelled) {
          setDetail(data)
          setAllRooms(roomsData)
          setRoomTypes(rtData ?? [])
          setRoomTypePricing(pricingMap)
          const selectedIds = data.rooms.map((r) => r.room_id).filter(Boolean) as string[]
          setForm({
            check_in_date: df.check_in_date?.slice(0, 10) ?? '',
            check_out_date: df.check_out_date?.slice(0, 10) ?? '',
            // create_reservation_with_rooms only snapshots booker_name, so
            // phone/email are null on every reservation until someone saves an
            // edit. Fall back to the linked contact so the boxes aren't blank.
            booker_name: df.booker_name || data.guests[0]?.full_name || data.contact?.name || '',
            booker_email: df.booker_email || data.contact?.email || '',
            booker_phone: df.booker_phone || data.contact?.phone || '',
            selectedRoomIds: selectedIds,
          })
          const initialOcc: Record<string, OccupancyCode> = {}
          for (const rr of data.rooms) {
            if (!rr.room_id) continue
            const room = roomsData.find((r) => r.id === rr.room_id)
            initialOcc[rr.room_id] = (rr.occupancy_code ?? (room && (room.capacity >= 3 ? 'T' : room.capacity === 2 ? 'D' : 'S'))) as OccupancyCode
          }
          setRoomOccupancies(initialOcc)

          // Prefill every room's box with the rate actually stored on the
          // reservation, not just the manually-overridden ones, so the sidebar
          // shows real numbers instead of empty boxes over a placeholder.
          // baselineOverrides remembers what was prefilled so an untouched box
          // is never resubmitted as a manual override on save.
          const initialOverrides: Record<string, string> = {}
          for (const rr of data.rooms) {
            if (!rr.room_id) continue
            const rate = Number(rr.rate_per_night ?? 0)
            if (!Number.isFinite(rate)) continue
            initialOverrides[rr.room_id] = String(rate)
          }
          setLineOverrides(initialOverrides)
          setBaselineOverrides(initialOverrides)
          setLoading(false)

          // Fetch company price overrides if company reservation
          if (data.companyInfo?.company_id) {
            const overridesData = await fetchJson<Array<{ roomCategory: string; occupancyCode: string; price: number }>>(
              `/api/contacts/${data.companyInfo.company_id}/price-overrides`,
            )
            if (!cancelled && overridesData) {
              const overrides: Record<string, Record<string, number>> = {}
              for (const row of overridesData) {
                if (!overrides[row.roomCategory]) overrides[row.roomCategory] = {}
                overrides[row.roomCategory][row.occupancyCode] = Number(row.price)
              }
              setCompanyPriceOverrides(overrides)
            }
          }
        }
      } catch {
        if (!cancelled) setError('Network error')
      }
    })()
    return () => { cancelled = true }
  }, [id])

  // Check availability when dates change
  useEffect(() => {
    if (!datesValid || !detail) return
    let cancelled = false;
    (async () => {
      try {
        const result = await reservationService.getAvailability({
          checkIn: form.check_in_date,
          checkOut: form.check_out_date,
        })
        if (cancelled) return
        if (result.ok && result.data) {
        // getAvailability returns every room tagged available/unavailable, so
        // the status has to be filtered here or booked rooms stay selectable.
        const availableIds = new Set(result.data.filter((r) => r.status === 'available').map((r) => r.roomId))
        // Also allow currently assigned rooms to stay selected
        const currentAssigned = new Set(detail.rooms.map((r) => r.room_id).filter(Boolean) as string[])
        const merged = new Set([...availableIds, ...currentAssigned])
        setAvailableRoomIds(merged)
      } else {
        setAvailableRoomIds(new Set())
      }
      } catch {
        if (!cancelled) setAvailableRoomIds(new Set())
      }
    })()
    return () => { cancelled = true }
  }, [form.check_in_date, form.check_out_date, datesValid, detail])

  function toggleRoom(roomId: string) {
    setForm((f) => {
      const isSelected = f.selectedRoomIds.includes(roomId)
      return {
        ...f,
        selectedRoomIds: isSelected
          ? f.selectedRoomIds.filter((id) => id !== roomId)
          : [...f.selectedRoomIds, roomId],
      }
    })
  }

  const handleSave = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!detail || form.selectedRoomIds.length === 0) return
    setSaving(true)
    try {
      const roomOverrides: Record<string, number | null> = {}
      for (const room of selectedRooms) {
        if (!Object.prototype.hasOwnProperty.call(lineOverrides, room.id)) continue
        const raw = lineOverrides[room.id].trim()
        // Untouched prefill: leave the room's existing price source alone.
        if (baselineOverrides[room.id] !== undefined && raw === baselineOverrides[room.id]) continue
        if (raw === '') {
          roomOverrides[room.id] = null
          continue
        }
        const parsed = Number(raw)
        if (Number.isFinite(parsed) && parsed >= 0) roomOverrides[room.id] = parsed
      }

      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_in_date: form.check_in_date,
          check_out_date: form.check_out_date,
          booker_name: form.booker_name || null,
          booker_email: form.booker_email || null,
          booker_phone: form.booker_phone || null,
          roomIds: form.selectedRoomIds,
          roomOccupancies,
          roomOverrides,
        }),
      })
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.error?.message ?? 'Failed to save')
        return
      }
      toast.success('Reservation updated')
      router.push(`/${locale}/reservations/${id}`)
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }, [id, form, roomOccupancies, lineOverrides, baselineOverrides, selectedRooms, detail, locale, router])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-[#EAEAEA]" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-xl border border-[#EAEAEA] bg-white p-5" />
              <div className="h-24 animate-pulse rounded-xl border border-[#EAEAEA] bg-white p-5" />
              <div className="h-64 animate-pulse rounded-xl border border-[#EAEAEA] bg-white p-5" />
            </div>
            <div className="h-48 animate-pulse rounded-xl border border-[#EAEAEA] bg-white p-5" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error || !detail) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-[#EAEAEA] bg-white p-8">
          <p className="text-sm font-semibold text-rose-700">{error ?? 'Reservation not found'}</p>
          <button onClick={() => router.push(`/${locale}/reservations`)}
            className="mt-5 inline-flex items-center rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]">
            Back to reservations
          </button>
        </div>
      </div>
    )
  }

  // ── Not editable state ──
  if (!canEdit) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-[#EAEAEA] bg-white p-8">
          <p className="text-sm font-medium text-[#333333]">{t('reservations.new.desk')}</p>
          <p className="mt-1 text-sm text-[#787774]">{t('reservations.new.subtitle')}</p>
          <button onClick={() => router.push(`/${locale}/reservations/${id}`)}
            className="mt-5 inline-flex items-center rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]">
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  // ── Edit form ──
  return (
    <main className="min-h-screen bg-[#FBFBFA] px-4 py-5 text-[#1A1A1A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/reservations/${id}`)}
          className="inline-flex items-center rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-sm font-medium text-[#787774] transition-colors hover:bg-[#F9F9F8] hover:text-[#1A1A1A]"
        >
          &larr; {t('common.back')}
        </button>

        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.desk')}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#1A1A1A]">{t('reservations.new.title')}</h1>
        </header>

        <form onSubmit={handleSave}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ── Main column ── */}
          <div className="space-y-4">
            {/* Guest / Booker Info */}
            <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.guest')}</p>
              <div className="space-y-3">
                <FloatingInput
                  label={t('contacts.name')}
                  value={form.booker_name}
                  disabled
                  placeholder={t('contacts.name')}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FloatingInput
                    label={t('common.email')}
                    type="email"
                    value={form.booker_email}
                    disabled
                    placeholder={t('common.email')}
                  />
                  <FloatingInput
                    label={t('common.phone')}
                    type="tel"
                    value={form.booker_phone}
                    disabled
                    placeholder={t('common.phone')}
                  />
                </div>
              </div>
            </div>

            {/* Stay Dates */}
            <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.stayDates')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FloatingInput
                  label={t('reservations.new.checkIn')}
                  type="date"
                  value={form.check_in_date}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, check_in_date: e.target.value, selectedRoomIds: [] }))
                  }}
                  required
                />
                <FloatingInput
                  label={t('reservations.new.checkOut')}
                  type="date"
                  value={form.check_out_date}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, check_out_date: e.target.value, selectedRoomIds: [] }))
                  }}
                  min={form.check_in_date || undefined}
                  required
                />
              </div>
              {form.check_in_date && form.check_out_date && !datesValid && (
                <p className="mt-2 text-xs font-medium text-[#9F2F2D]">{t('reservations.new.checkOutAfterCheckIn')}</p>
              )}
            </div>

            {/* Room Selection */}
            <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.roomDistribution')}</p>
                  <p className="mt-0.5 text-sm font-medium text-[#1A1A1A]">
                    {form.selectedRoomIds.length} room{form.selectedRoomIds.length === 1 ? '' : 's'} selected
                  </p>
                </div>
              </div>

              {!datesValid && (
                <p className="rounded-lg border border-dashed border-[#D4D4D4] bg-[#F9F9F8] p-4 text-sm text-[#787774]">
                  Select valid dates to see available rooms.
                </p>
              )}

              {datesValid && roomTypeIds.length === 0 && (
                <p className="rounded-lg border border-dashed border-[#D4D4D4] bg-[#F9F9F8] p-4 text-sm text-[#787774]">
                  No rooms found.
                </p>
              )}

              {datesValid && roomTypeIds.map((typeId) => {
                const roomType = roomTypeMap.get(typeId)
                const rooms = roomsByType.get(typeId) ?? []
                return (
                  <div key={typeId} className="mb-5 last:mb-0">
                    <h3 className="mb-2 text-sm font-semibold text-[#333333]">
                      {roomType?.name ?? 'Unknown type'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {rooms.map((room) => {
                          const isSelected = form.selectedRoomIds.includes(room.id)
                          const isAvailable = availableRoomIds.has(room.id)
                          const canSelect = isAvailable || isSelected
                          const statusColor = room.status === 'available' ? 'bg-emerald-400' : 'bg-[#D4D4D4]'

                          const defaultOcc: OccupancyCode = room.capacity >= 3 ? 'T' : room.capacity === 2 ? 'D' : 'S'
                          const currentOcc = roomOccupancies[room.id] ?? defaultOcc

                          return (
                            <div
                              key={room.id}
                              className={`rounded-xl border p-3 text-left transition-all ${
                                !canSelect
                                  ? 'cursor-not-allowed border-[#EAEAEA] bg-[#F9F9F8] opacity-50'
                                  : isSelected
                                    ? 'border-gray-900 bg-[#1A1A1A] text-white'
                                    : 'border-[#EAEAEA] bg-white text-[#333333]'
                              }`}
                            >
                              <button
                                type="button"
                                disabled={!canSelect}
                                onClick={() => toggleRoom(room.id)}
                                className="w-full text-left"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
                                    <span className="truncate text-sm font-bold leading-tight">{room.number}</span>
                                  </div>
                                  {isSelected && (
                                    <span className="shrink-0 rounded-md bg-[#EDF3EC]0/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                  )}
                                </div>
                                <p className={`mt-1 text-[10px] font-medium ${isSelected ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}>
                                  {roomType?.name ?? ''}
                                </p>
                                <p className={`mt-0.5 text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#1A1A1A]'}`}>
                                  {defaultOcc === 'T' ? 'Triple' : defaultOcc === 'D' ? 'Double' : 'Single'}
                                </p>
                                <p className={`text-[10px] ${isSelected ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}>
                                  {room.capacity} guest{room.capacity === 1 ? '' : 's'} &middot; Floor {room.floor}
                                </p>
                              </button>
                              {isSelected && (
                                <div className="mt-2 flex items-center gap-1.5 border-t border-[#333333] pt-2">
                                  <span className="text-[10px] font-medium text-[#BBBBBB]">Occ:</span>
                                  {(['S', 'D', 'T'] as const).map((code) => {
                                    const active = currentOcc === code
                                    return (
                                      <button
                                        key={code}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setRoomOccupancies((prev) => ({ ...prev, [room.id]: code }))
                                        }}
                                        className={`min-w-[22px] rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                          active
                                            ? 'bg-white text-[#1A1A1A]'
                                            : 'bg-[#333333] text-[#BBBBBB] hover:bg-[#444444] hover:text-white'
                                        }`}
                                      >
                                        {code}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4">
            <div className="sticky top-5 rounded-xl border border-[#EAEAEA] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.review')}</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#787774]">{t('contacts.name')}</span>
                  <span className="text-right font-medium text-[#1A1A1A]">{form.booker_name || '—'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#787774]">{t('reservations.new.checkIn')}</span>
                  <span className="text-right font-medium text-[#1A1A1A]">{form.check_in_date || t('reservations.new.notSelected')}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#787774]">{t('reservations.new.checkOut')}</span>
                  <span className="text-right font-medium text-[#1A1A1A]">{form.check_out_date || t('reservations.new.notSelected')}</span>
                </div>
                {form.check_in_date && form.check_out_date && (
                  <div className="flex justify-between gap-4">
                    <span className="text-[#787774]">{t('accounting.invoices.nights')}</span>
                    <span className="text-right font-medium text-[#1A1A1A]">{nights} {t('accounting.invoices.nights')}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2 border-t border-[#EAEAEA] pt-3">
                  <span className="text-[#787774]">{t('rooms.title')}</span>
                  <span className="font-semibold text-[#1A1A1A]">{form.selectedRoomIds.length}</span>
                </div>
              </div>

              {/* Room breakdown */}
              {datesValid && pricing && (() => {
                const roomCards = pricing.roomDetails.map((g) => {
                  const hasOverride = g.price !== g.standardPrice
                  // Typing here targets the most-recently-added room in this group: it
                  // peels that one room off with its own rate, splitting it into its own
                  // line next render (same as adding a room of a different type would),
                  // instead of bulk-changing every room still grouped in.
                  const targetRoomId = g.roomIds[g.roomIds.length - 1]
                  // Key on the room the input writes to, NOT on g.key — g.key
                  // embeds the price, so every keystroke changed the key, React
                  // unmounted the input mid-type and focus was lost. targetRoomId
                  // is unique per group and stable while typing.
                  return (
                    <div key={targetRoomId} className="rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A]">
                            {g.name}
                            {hasOverride && (
                              <span className="rounded bg-[#FBF3DB] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#956400]">
                                {t('reservations.customPriceIndicator')}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[#8B5CF6]">{g.count} room{g.count > 1 ? 's' : ''} &middot; {g.occLabel}</p>
                        </div>
                        <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(g.price * g.count * nights)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {hasOverride && (
                          <span className="text-[10px] text-[#787774] line-through">{formatCurrency(g.standardPrice)}</span>
                        )}
                        <input
                          type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
                          min="0"
                          step="any"
                          value={lineOverrides[targetRoomId] ?? ''}
                          placeholder={String(g.standardPrice)}
                          onChange={(event) => setLineOverrides((prev) => ({ ...prev, [targetRoomId]: event.target.value }))}
                          aria-label={`${g.name} ${g.occLabel} price override`}
                          className="h-7 w-20 rounded border border-[#EAEAEA] bg-white px-2 text-right text-xs tabular-nums focus:border-gray-900 focus:outline-none"
                        />
                        <span className="text-[10px] text-[#787774]">/night</span>
                      </div>
                    </div>
                  )
                })
                return (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#787774]">{t('rooms.title')}</p>
                    {roomCards}
                    <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('common.subtotal')}</span>
                      <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(pricing.roomCharges)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#787774]">{t('accounting.invoices.serviceCharge')}</span>
                      <span className="text-sm text-[#1A1A1A]">{formatCurrency(pricing.serviceCharge)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#787774]">{t('accounting.settings.vatRate')}</span>
                      <span className="text-sm text-[#1A1A1A]">{formatCurrency(pricing.tax)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('common.total')}</span>
                      <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                )
              })()}
                  {detail?.companyInfo && Object.keys(companyPriceOverrides).length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[#956400]">{t('contacts.priceOverridesTitle')}</span>
                    </div>
                  )}

              <div className="mt-4 space-y-1.5 text-xs text-[#787774]">
                {!datesValid && <p className="text-[#9F2F2D]">{t('reservations.new.selectDates')}</p>}
                {form.selectedRoomIds.length === 0 && <p className="text-[#9F2F2D]">{t('reservations.new.selectRoom')}</p>}
              </div>

              <button
                type="submit"
                disabled={saving || !datesValid || form.selectedRoomIds.length === 0}
                className="mt-4 h-10 w-full rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <p className="mt-2 text-center text-xs text-[#787774]">
                {t('reservations.new.availabilityVerified')}
              </p>
            </div>
          </aside>
        </div>
        </form>
      </div>
    </main>
  )
}
