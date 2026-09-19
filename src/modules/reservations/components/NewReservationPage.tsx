'use client'

import { InfoHint } from '@/shared/components/InfoHint'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useResource } from '@/shared/data/useResource'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { FloatingInput } from '@/shared/components/FloatingField'
import { reservationService } from '@/services/reservationService'
import { toast } from '@/shared/toast/toastEvents'
import type { RoomType } from '@/modules/room-types/types'
import type { RoomTypePricing } from '@/modules/pricing/types'
import { NewContactModal } from './NewContactModal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

interface ContactResult {
  id: string
  name: string
  phone: string
  email: string | null
  type: string
}

interface AvailabilityShortfall {
  roomTypeId: string
  requested: number
  got: number
}

interface ReservationCreateError {
  code?: string
  message?: string
  details?: {
    availability?: AvailabilityShortfall[]
  }
}

function toPositiveInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, parsed)
}


async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as { data?: T } | null
  return json?.data ?? null
}

type PriceOverrides = Record<string, Record<string, number>>
const NO_OVERRIDES: PriceOverrides = {}

async function fetchCompanyPriceOverrides(contactId: string): Promise<PriceOverrides> {
  const rows = await fetchJson<Array<{ roomCategory: string; occupancyCode: string; price: number }>>(
    `/api/contacts/${contactId}/price-overrides`,
  )
  const overrides: PriceOverrides = {}
  for (const row of rows ?? []) {
    overrides[row.roomCategory] ??= {}
    overrides[row.roomCategory][row.occupancyCode] = Number(row.price)
  }
  return overrides
}

export function NewReservationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lockedContactId = searchParams.get('contactId')
  const lockedContactName = searchParams.get('name') ?? ''
  const lockedContact = Boolean(lockedContactId)
  const { locale, t } = useTranslation()
  const searchRef = useRef<HTMLDivElement>(null)
  const { formatCurrency, vatRate: vatPercent, serviceChargeRate: serviceChargePercent } = useCurrency()

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [roomTypesLoading, setRoomTypesLoading] = useState(true)
  const [roomTypeCounts, setRoomTypeCounts] = useState<Record<string, number>>({})
  const [availability, setAvailability] = useState<Record<string, number>>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [roomTypePricing, setRoomTypePricing] = useState<Record<string, { price: number; price_single: number | null; price_double: number | null; price_triple: number | null }>>({})
  const [lineOverrides, setLineOverrides] = useState<Record<string, string>>({})

  const [searchQuery, setSearchQuery] = useState(() => lockedContactName)
  const [searchResults, setSearchResults] = useState<ContactResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null)
  // Negotiated company rates (roomCategory -> occupancy -> price); none for individuals.
  const companyId = selectedContact?.type === 'company' ? selectedContact.id : null
  const { data: companyPriceOverrides = NO_OVERRIDES } = useResource(
    companyId ? `/api/contacts/${companyId}/price-overrides` : null,
    () => fetchCompanyPriceOverrides(companyId!),
  )
  const [newContactModalOpen, setNewContactModalOpen] = useState(false)

  // Pre-select the contact passed from the contact details page (?contactId=&name=)
  useEffect(() => {
    if (!lockedContactId) return
    fetchJson<{ id: string; name: string; phone?: string; email?: string; type: string }>(`/api/contacts/${lockedContactId}`)
      .then((data) => {
        if (!data) return
        setSelectedContact({
          id: data.id,
          name: data.name,
          phone: data.phone ?? '',
          email: data.email ?? null,
          type: data.type,
        })
        setSearchQuery(data.name)
      })
  }, [lockedContactId])

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [totalRooms, setTotalRooms] = useState(1)
  const [roomOccupancies, setRoomOccupancies] = useState<Record<string, ('S' | 'D' | 'T')[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  // ponytail: tax/service_charge rates were hardcoded 10/14 and mismatched the
  // /settings PricingTab. Load them once from accounting_settings so the
  // preview matches the persisted reservation (server's pricingService reads
  // the same keys).
  const serviceChargeRate = serviceChargePercent / 100
  const vatRate = vatPercent / 100

  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut + 'T12:00:00').getTime() - new Date(checkIn + 'T12:00:00').getTime()) / 86400000))
    : 0
  function getStandardRoomPrice(rt: RoomType, occ: 'S' | 'D' | 'T'): number {
    let price = rt.basePrice
    const pricing = roomTypePricing[rt.id]
    if (pricing) {
      if (occ === 'S' && pricing.price_single != null) price = pricing.price_single
      else if (occ === 'D' && pricing.price_double != null) price = pricing.price_double
      else if (occ === 'T' && pricing.price_triple != null) price = pricing.price_triple
      else if (pricing.price > 0) price = pricing.price
    }
    if (selectedContact?.type === 'company') {
      const override = companyPriceOverrides[rt.slug]?.[occ]
      if (override !== undefined) price = override
    }
    return price
  }

  function getOverrideFor(roomTypeId: string, occ: 'S' | 'D' | 'T'): number | undefined {
    const raw = lineOverrides[`${roomTypeId}:${occ}`]
    if (!raw || raw.trim() === '') return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
  }

  function getRoomPrice(rt: RoomType, occ: 'S' | 'D' | 'T'): number {
    return getOverrideFor(rt.id, occ) ?? getStandardRoomPrice(rt, occ)
  }

  const subtotal = useMemo(
    () => roomTypes.reduce((sum, rt) => {
      const occupancies = roomOccupancies[rt.id] ?? []
      if (occupancies.length === 0) return sum
      return sum + occupancies.reduce((roomSum, occ) => roomSum + getRoomPrice(rt, occ) * nights, 0)
    }, 0),
    [roomTypes, roomOccupancies, getRoomPrice, nights],
  )
  const serviceCharge = subtotal * serviceChargeRate
  const tax = (subtotal + serviceCharge) * vatRate
  const estimatedTotal = subtotal + serviceCharge + tax
  const datesValid = Boolean(checkIn && checkOut && new Date(checkOut) > new Date(checkIn))
  const totalSelected = useMemo(
    () => Object.values(roomTypeCounts).reduce((sum, count) => sum + count, 0),
    [roomTypeCounts],
  )
  const exceedsAvailability = useMemo(
    () => Object.entries(roomTypeCounts).some(([roomTypeId, count]) => count > (availability[roomTypeId] ?? 0)),
    [availability, roomTypeCounts],
  )
  const totalMatches = totalSelected === totalRooms
  const canSubmit = Boolean(
    selectedContact && datesValid && totalRooms > 0 && totalSelected > 0 && totalMatches && !exceedsAvailability && !availabilityLoading,
  )

  useEffect(() => {
    let cancelled = false

    ;((async () => {
      const [roomTypeList, pricingList] = await Promise.all([
        fetchJson<RoomType[]>('/api/room-types'),
        fetchJson<RoomTypePricing[]>('/api/pricing'),
      ])

      if (!cancelled) {
        setRoomTypes(roomTypeList ?? [])
        const pricingMap: Record<string, { price: number; price_single: number | null; price_double: number | null; price_triple: number | null }> = {}
        for (const row of pricingList ?? []) {
          const rtId = row.roomTypeId
          if (!pricingMap[rtId]) {
            pricingMap[rtId] = {
              price: Number(row.price ?? 0),
              price_single: row.priceSingle,
              price_double: row.priceDouble,
              price_triple: row.priceTriple,
            }
          }
        }
        setRoomTypePricing(pricingMap)
        setRoomTypesLoading(false)
      }

    })())

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Stable so the focus handler can trigger a fresh search without relying on
  // state bailing out (setSearchQuery with the same value never re-runs the effect).
  const runContactSearch = useCallback(async (query: string) => {
    const params = new URLSearchParams({ limit: '10' })
    const trimmed = query.trim()
    if (trimmed) params.set('search', trimmed)
    const res = await fetch(`/api/contacts?${params.toString()}`)
    const page = res.ok ? ((await res.json()) as { data?: Array<{ id: string; type: string; name: string; phone?: string; email?: string }> }) : null

    return (page?.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone ?? '',
      email: row.email ?? null,
      type: row.type,
    }))
  }, [])

  useEffect(() => {
    if (selectedContact && selectedContact.name === searchQuery) {
      return
    }

    let cancelled = false

    runContactSearch(searchQuery).then((results) => {
      if (!cancelled) {
        setSearchResults(results)
        setSearchLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [searchQuery, selectedContact, runContactSearch])

  useEffect(() => {
    if (!datesValid || roomTypes.length === 0) {
      return
    }

    let cancelled = false

    ;(async () => {
      const res = await reservationService.getAvailability({ checkIn, checkOut })
      if (cancelled) return

      if (res.ok && res.data) {
        const next: Record<string, number> = {}
        for (const room of res.data) {
          if (room.status === 'available') {
            next[room.roomTypeId] = (next[room.roomTypeId] ?? 0) + 1
          }
        }
        setAvailability(next)
      } else {
        setAvailability({})
      }
      setAvailabilityLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [checkIn, checkOut, datesValid, roomTypes.length])


  function selectContact(contact: ContactResult) {
    setSelectedContact(contact)
    setSearchQuery(contact.name)
    setShowResults(false)
    setServerError(null)
  }

  function updateRoomTypeCount(roomTypeId: string, value: number) {
    setServerError(null)
    const prevCount = roomTypeCounts[roomTypeId] ?? 0
    setRoomTypeCounts((prev) => {
      const selectedWithoutCurrent = Object.entries(prev).reduce((sum, [id, count]) => {
        return id === roomTypeId ? sum : sum + count
      }, 0)
      const availableForType = availability[roomTypeId] ?? 0
      const remainingTotal = Math.max(0, totalRooms - selectedWithoutCurrent)
      const maxAllowed = Math.min(availableForType, remainingTotal)
      return { ...prev, [roomTypeId]: Math.min(Math.max(0, value), maxAllowed) }
    })
    setRoomOccupancies((prev) => {
      const current = prev[roomTypeId] ?? []
      if (value > current.length) {
        const fill = Array(value - current.length).fill('D') as ('S' | 'D' | 'T')[]
        return { ...prev, [roomTypeId]: [...current, ...fill] }
      }
      if (value < current.length) {
        return { ...prev, [roomTypeId]: current.slice(0, value) }
      }
      return prev
    })
  }

  function updateRoomOccupancy(roomTypeId: string, index: number, code: 'S' | 'D' | 'T') {
    setRoomOccupancies((prev) => {
      const current = prev[roomTypeId] ?? []
      if (index >= current.length) return prev
      const next = [...current]
      next[index] = code
      return { ...prev, [roomTypeId]: next }
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setServerError(null)

    if (!canSubmit || !selectedContact) return

    const requestedRoomTypeCounts = roomTypes.flatMap((roomType) => {
      const count = roomTypeCounts[roomType.id] ?? 0
      const occupancies = roomOccupancies[roomType.id] ?? []
      if (count === 0) return []
      if (occupancies.length === 0) {
        return [{
          roomTypeId: roomType.id,
          count,
          occupancyCode: 'D' as const,
          overrideRatePerNight: getOverrideFor(roomType.id, 'D') ?? null,
        }]
      }
      // Merge per-room occupancies into one entry per occupancy code. Sending
      // one entry per room made the RPC see duplicate roomTypeId entries and
      // pick the same room twice (its selection loop does not exclude rooms
      // already selected by earlier entries), which tripped the room overlap
      // exclusion constraint.
      const byCode = new Map<'S' | 'D' | 'T', number>()
      for (const occ of occupancies) byCode.set(occ, (byCode.get(occ) ?? 0) + 1)
      return [...byCode.entries()].map(([occupancyCode, n]) => ({
        roomTypeId: roomType.id,
        count: n,
        occupancyCode,
        overrideRatePerNight: getOverrideFor(roomType.id, occupancyCode) ?? null,
      }))
    })

    setSubmitting(true)
    try {
      const response = await fetch('/api/reservations/create-with-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact.id,
          guestName: selectedContact.name,
          checkIn,
          checkOut,
          roomTypeCounts: requestedRoomTypeCounts,
        }),
      })
      const json = await response.json()

      if (!json.ok) {
        const error = json.error as ReservationCreateError | undefined
        if (error?.code === 'ROOM_UNAVAILABLE') {
          setServerError(error.message ?? 'Some room types do not have enough available rooms.')
          toast.error(error.message ?? 'Room availability changed. Adjust room selection and try again.')
          const shortfalls = error.details?.availability ?? []
          if (shortfalls.length > 0) {
            setAvailability((prev) => {
              const next = { ...prev }
              for (const item of shortfalls) next[item.roomTypeId] = item.got
              return next
            })
          }
        } else {
          const msg = error?.message ?? 'Failed to create reservation'
          setServerError(msg)
          toast.error(msg)
        }
        return
      }

      const reservationId = json.data.reservationId as string
      const rooms = json.data.rooms as Array<{ roomNumber: string }>
      const roomList = rooms.map((r: { roomNumber: string }) => r.roomNumber).join(', ')

      // Company bookings: company info + removal of the RPC's placeholder
      // guest now happen server-side in POST /api/reservations/create-with-rooms.

      toast.success(`Reservation created — Rooms: ${roomList}`)
      router.push(`/${locale}/reservations/${reservationId}`)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Failed to create reservation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FBFBFA] px-4 py-5 text-[#1A1A1A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/reservations`)}
          className="inline-flex items-center rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-sm font-medium text-[#787774] transition-colors hover:bg-[#F9F9F8] hover:text-[#1A1A1A]"
        >
          <span aria-hidden="true" className="me-1 rtl:rotate-180">&larr;</span>
          {t('common.back')}
        </button>

        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.desk')}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#1A1A1A]">{t('reservations.new.title')}</h1>
          <p className="mt-1 text-sm text-[#787774]">{t('reservations.new.subtitle')}</p>
        </header>

        {serverError && (
          <div className="rounded-xl border border-red-200 bg-[#FDEBEC] px-4 py-3 text-sm font-medium text-[#9F2F2D]">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="space-y-4">
            {/* Guest card */}
            <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.guest')}<InfoHint text={t('reservations.new.hints.guest')} /></p>
              <div ref={searchRef} className="relative">
                <FloatingInput
                  label={t('reservations.new.searchGuest')}
                  type="search"
                  value={searchQuery}
                  disabled={lockedContact}
                  onChange={(event) => {
                    if (lockedContact) return
                    const nextValue = event.target.value
                    setSearchQuery(nextValue)
                    setSelectedContact(null)
                    setServerError(null)
                    setSearchLoading(Boolean(nextValue.trim()))
                    if (!nextValue.trim()) {
                      setSearchResults([])
                      setShowResults(false)
                    }
                  }}
                  onFocus={() => {
                    if (lockedContact || selectedContact) {
                      if (!lockedContact) setShowResults(true)
                      return
                    }
                    // Show all contacts on focus, even with an empty query
                    setSearchLoading(true)
                    runContactSearch(searchQuery).then((results) => {
                      setSearchResults(results)
                      setSearchLoading(false)
                    })
                    setShowResults(true)
                  }}
                  placeholder={t('reservations.new.searchPlaceholder')}
                />
                {selectedContact && (
                  <p className="mt-1 text-xs font-medium text-[#346538]">Selected: {selectedContact.name}</p>
                )}
                {searchLoading && !lockedContact && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#EAEAEA] bg-white p-4 text-center ">
                    <span className="text-sm text-[#787774]">{t('common.searching')}</span>
                  </div>
                )}
                {showResults && !searchLoading && !lockedContact && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#EAEAEA] bg-white ">
                    <div className="max-h-56 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => selectContact(result)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#333333] transition-colors hover:bg-[#F9F9F8]"
                        >
                          <span className="font-medium">{result.name}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            result.type === 'company'
                              ? 'bg-[#FBF3DB] text-[#956400]'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {result.type}
                          </span>
                          <span className="ml-auto text-xs text-[#787774]">
                            {result.phone || result.email || ''}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewContactModalOpen(true)}
                      data-tooltip={t('reservations.new.hints.addContact')}
                      className="sticky bottom-0 flex w-full items-center justify-center gap-1.5 border-t border-[#EAEAEA] bg-[#F9F9F8] px-3 py-2.5 text-sm font-medium text-[#555555] transition-colors hover:bg-[#F5F5F5]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('common.add')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stay dates card */}
            <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.stayDates')}<InfoHint text={t('reservations.new.hints.stayDates')} /></p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FloatingInput
                  label={t('reservations.new.checkIn')}
                  type="date"
                  value={checkIn}
                  onChange={(event) => {
                    setCheckIn(event.target.value)
                    setServerError(null)
                    setAvailability({})
                  }}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
                <FloatingInput
                  label={t('reservations.new.checkOut')}
                  type="date"
                  value={checkOut}
                  onChange={(event) => {
                    setCheckOut(event.target.value)
                    setServerError(null)
                    setAvailability({})
                  }}
                  min={checkIn || undefined}
                  required
                />
              </div>
              {checkIn && checkOut && !datesValid && (
                <p className="mt-2 text-xs font-medium text-[#9F2F2D]">{t('reservations.new.checkOutAfterCheckIn')}</p>
              )}
            </div>

            {/* Room distribution card */}
            <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.roomDistribution')}<InfoHint text={t('reservations.new.hints.roomDistribution')} /></p>
                  <p className="mt-0.5 text-sm font-medium text-[#1A1A1A]">{t('reservations.new.chooseByType')}</p>
                </div>
                <div className="w-32">
                  <FloatingInput
                    label={t('reservations.new.totalRooms')}
                    type="number" inputMode="numeric" step={1}
                    min={1}
                    value={totalRooms > 0 ? String(totalRooms) : ''}
                    onChange={(event) => setTotalRooms(toPositiveInteger(event.target.value, 0))}
                  />
                </div>
              </div>

              {!datesValid && (
                <p className="rounded-lg border border-dashed border-[#D4D4D4] bg-[#F9F9F8] p-4 text-sm text-[#787774]">
                  {t('reservations.new.selectDatesFirst')}
                </p>
              )}

              {datesValid && roomTypesLoading && <p className="text-sm text-[#787774]">{t('common.loading')}</p>}
              {datesValid && availabilityLoading && <p className="mb-3 text-sm text-[#787774]">Checking availability...</p>}

              {datesValid && !roomTypesLoading && roomTypes.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {roomTypes.filter((roomType) => {
                    const requested = roomTypeCounts[roomType.id] ?? 0
                    const available = availability[roomType.id] ?? 0
                    // ponytail: hide room types with no available rooms unless
                    // the user has already selected some (e.g. selection made
                    // before availability went to 0). 0-total room types
                    // (deleted physical inventory) never surface in the picker.
                    return available > 0 || requested > 0
                  }).map((roomType) => {
                    const requested = roomTypeCounts[roomType.id] ?? 0
                    const available = availability[roomType.id] ?? 0
                    const isTooHigh = requested > available
                    const isSelected = requested > 0
                    const selectedWithoutCurrent = totalSelected - requested
                    const maxAllowed = Math.min(available, Math.max(0, totalRooms - selectedWithoutCurrent))
                    const canDecrease = requested > 0
                    const canIncrease = requested < maxAllowed

                    return (
                      <div
                        key={roomType.id}
                        className={`rounded-xl border p-4 transition-all ${
                          isTooHigh
                            ? 'border-red-200 bg-[#FDEBEC]'
                            : isSelected
                              ? 'border-gray-900 bg-[#1A1A1A] text-white'
                              : 'border-[#EAEAEA] bg-[#F9F9F8] hover:border-[#D4D4D4]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${isSelected && !isTooHigh ? 'text-white' : 'text-[#1A1A1A]'}`}>
                              {roomType.name}
                            </p>
                            <p className={`mt-0.5 text-xs ${isSelected && !isTooHigh ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}>
                              Capacity {roomType.defaultCapacity} &middot; {available} available
                            </p>
                          </div>
                          {requested > 0 && (
                            <span className="shrink-0 rounded-md bg-[#EDF3EC]0/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                              {requested}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateRoomTypeCount(roomType.id, Math.max(0, requested - 1))}
                            disabled={!canDecrease}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-sm font-semibold text-[#555555] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={t('reservations.new.hints.decreaseRooms').replace('{type}', roomType.name)}
                          >
                            &minus;
                          </button>
                          <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                            {requested}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateRoomTypeCount(roomType.id, requested + 1)}
                            disabled={!canIncrease}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-sm font-semibold text-[#555555] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={t('reservations.new.hints.increaseRooms').replace('{type}', roomType.name)}
                          >
                            +
                          </button>
                        </div>

                        {isSelected && !isTooHigh && (
                          <div className="mt-2 space-y-1">
                            {(roomOccupancies[roomType.id] ?? ['D']).map((occ, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                {requested > 1 && (
                                  <span className="mr-0.5 w-5 text-[10px] font-medium text-[#BBBBBB]">
                                    {idx + 1}.
                                  </span>
                                )}
                                {(['S', 'D', 'T'] as const).map((code) => {
                                  const active = occ === code
                                  return (
                                    <button
                                      key={code}
                                      type="button"
                                      onClick={() => updateRoomOccupancy(roomType.id, idx, code)}
                                      aria-pressed={active}
                                      data-tooltip={t(`reservations.new.occupancy.${code}`)}
                                      className={`min-h-7 min-w-7 rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
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
                            ))}
                          </div>
                        )}

                        {isTooHigh && (
                          <p className="mt-2 text-xs font-medium text-[#9F2F2D]">
                            Only {available} room{available === 1 ? '' : 's'} available.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="sticky top-5 rounded-xl border border-[#EAEAEA] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('reservations.new.review')}</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#787774]">{t('reservations.new.guest')}</span>
                  <span className="text-right font-medium text-[#1A1A1A]">{selectedContact?.name ?? t('reservations.new.notSelected')}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#787774]">{t('reservations.new.checkIn')}</span>
                  <span className="text-right font-medium text-[#1A1A1A]">{checkIn || t('reservations.new.notSelected')}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#787774]">{t('reservations.new.checkOut')}</span>
                  <span className="text-right font-medium text-[#1A1A1A]">{checkOut || t('reservations.new.notSelected')}</span>
                </div>
                {checkIn && checkOut && (
                  <div className="flex justify-between gap-4">
                    <span className="text-[#787774]">{t('accounting.invoices.nights')}</span>
                    <span className="text-right font-medium text-[#1A1A1A]">
                      {nights} {t('accounting.invoices.nights')}
                    </span>
                  </div>
                )}
              </div>

              {/* Room breakdown */}
              {datesValid && totalSelected > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#787774]">{t('rooms.title')}</p>
                  {roomTypes.filter((rt) => (roomTypeCounts[rt.id] ?? 0) > 0).map((rt) => {
                    const occupancies = roomOccupancies[rt.id] ?? []
                    const occLabels = { S: 'Single', D: 'Double', T: 'Triple' }
                    return (
                      <div key={rt.id} className="rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] px-3 py-2">
                        <p className="text-sm font-semibold text-[#1A1A1A]">{rt.name}</p>
                        {occupancies.length === 0 ? (
                          <p className="text-xs text-[#8B5CF6]">Select occupancy</p>
                        ) : (
                          (() => {
                            const groups = new Map<'S' | 'D' | 'T', number>()
                            for (const occ of occupancies) groups.set(occ, (groups.get(occ) ?? 0) + 1)
                            return [...groups.entries()].map(([occ, count]) => {
                              const key = `${rt.id}:${occ}`
                              const std = getStandardRoomPrice(rt, occ)
                              const custom = getOverrideFor(rt.id, occ)
                              return (
                                <div key={key} className="flex items-center justify-between gap-2 py-0.5">
                                  <p className="flex items-center gap-1.5 text-xs text-[#8B5CF6]">
                                    {count} &times; {occLabels[occ]}
                                    {custom !== undefined && (
                                      <span className="rounded bg-[#FBF3DB] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#956400]">
                                        {t('reservations.customPriceIndicator')}
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    {custom !== undefined && (
                                      <span className="text-[10px] text-[#787774] line-through">{formatCurrency(std)}</span>
                                    )}
                                    <input
                                      type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
                                      min="0"
                                      step="any"
                                      value={lineOverrides[key] ?? ''}
                                      placeholder={String(std)}
                                      onChange={(event) => setLineOverrides((prev) => ({ ...prev, [key]: event.target.value }))}
                                      aria-label={`${rt.name} ${occLabels[occ]} price override`}
                                      className="h-7 w-20 rounded border border-[#EAEAEA] bg-white px-2 text-right text-xs tabular-nums focus:border-gray-900 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-[#787774]">/night</span>
                                  </div>
                                </div>
                              )
                            })
                          })()
                        )}
                        <div className="mt-1 flex items-center justify-between border-t border-[#EAEAEA] pt-1">
                          <span className="text-xs font-medium text-[#787774]">{occupancies.length} room{occupancies.length !== 1 ? 's' : ''}</span>
                          <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(
                            occupancies.reduce((sum, occ) => sum + getRoomPrice(rt, occ) * nights, 0)
                          )}</span>
                        </div>
                      </div>
                    )
                  })}
                  {/* Subtotal */}
                  <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('common.subtotal')}</span>
                    <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(subtotal)}</span>
                  </div>
                  {/* Service charge */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-[#787774]">{t('accounting.invoices.serviceCharge')}<InfoHint text={t('reservations.new.hints.serviceCharge')} /></span>
                    <span className="text-sm text-[#1A1A1A]">{formatCurrency(serviceCharge)}</span>
                  </div>
                  {/* Tax */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-[#787774]">{t('accounting.settings.vatRate')}<InfoHint text={t('reservations.new.hints.vat')} /></span>
                    <span className="text-sm text-[#1A1A1A]">{formatCurrency(tax)}</span>
                  </div>
                  {/* Total */}
                  <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#787774]">{t('common.total')}</span>
                    <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(estimatedTotal)}</span>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-1.5 text-xs text-[#787774]">
                {!selectedContact && <p className="text-[#9F2F2D]">{t('reservations.new.selectGuest')}</p>}
                {!datesValid && <p className="text-[#9F2F2D]">{t('reservations.new.selectDates')}</p>}
                {totalSelected < 1 && <p className="text-[#9F2F2D]">{t('reservations.new.selectRoom')}</p>}
                {totalSelected > 0 && !totalMatches && <p className="text-amber-600">{t('reservations.new.typeTotalsMatch')}</p>}
                {exceedsAvailability && <p className="text-[#9F2F2D]">{t('reservations.new.exceedsAvailability')}</p>}
              </div>

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="mt-4 h-10 w-full rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? t('reservations.new.creating') : t('reservations.new.create')}
              </button>
              <p className="mt-2 text-center text-xs text-[#787774]">
                {t('reservations.new.availabilityVerified')}
              </p>
            </div>
          </aside>
        </form>
      </div>

      <NewContactModal
        isOpen={newContactModalOpen}
        onClose={() => setNewContactModalOpen(false)}
        onCreated={(contact) => {
          selectContact(contact)
          setNewContactModalOpen(false)
        }}
      />
    </main>
  )
}
