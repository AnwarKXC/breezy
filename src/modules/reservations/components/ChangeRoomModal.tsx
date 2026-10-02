'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import type { ReservationRoom } from '@/modules/reservations/types'

interface ChangeRoomModalProps {
  isOpen: boolean
  onClose: () => void
  room: ReservationRoom | null
  onChangeRoom: (reservationRoomId: string, newRoomId: string, newRoomNumber: string, occupancyCode: 'S' | 'D' | 'T') => Promise<void>
}

interface RoomOption {
  id: string
  number: string
  roomTypeName: string
  floor: number
  status: string
  capacity: number
  singlePrice: number
  doublePrice: number
  triplePrice: number
  currency: string
}

export function ChangeRoomModal({ isOpen, onClose, room, onChangeRoom }: ChangeRoomModalProps) {
  const { t } = useTranslation()
  if (!room) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('bookings.changeRoomTitle')} size="lg">
      <ChangeRoomModalBody key={room.room_id} room={room} onClose={onClose} onChangeRoom={onChangeRoom} />
    </Modal>
  )
}

function ChangeRoomModalBody({
  room,
  onClose,
  onChangeRoom,
}: {
  room: ReservationRoom
  onClose: () => void
  onChangeRoom: ChangeRoomModalProps['onChangeRoom']
}) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [occupancies, setOccupancies] = useState<Record<string, 'S' | 'D' | 'T'>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const qp = new URLSearchParams({
      checkIn: room.check_in_date,
      checkOut: room.check_out_date,
    })
    fetch(`/api/reservations/availability?${qp}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.ok && json.data) {
          setRooms(
            (json.data as Array<Record<string, unknown>>)
              .map((r) => ({
                id: String(r.room_id ?? ''),
                number: String(r.room_number ?? ''),
                roomTypeName: String(r.room_type_name ?? ''),
                floor: Number(r.floor ?? 0),
                status: String(r.status ?? ''),
                capacity: Number(r.capacity ?? 0),
                singlePrice: Number(r.price_single ?? r.effective_price ?? r.base_price ?? 0),
                doublePrice: Number(r.price_double ?? r.effective_price ?? r.base_price ?? 0),
                triplePrice: Number(r.price_triple ?? r.effective_price ?? r.base_price ?? 0),
                currency: String(r.currency ?? ''),
              }))
              .filter((r) => r.id && r.status === 'available' && r.id !== room.room_id),
          )
        } else {
          setRooms([])
        }
      })
      .catch(() => { if (!cancelled) setRooms([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [room])

  // ponytail: occupancy carries over from the reservation room, defaults per card
  const currentOcc: 'S' | 'D' | 'T' = (() => {
    const occ = (room as { occupancy_code?: string | null }).occupancy_code
    return occ === 'S' || occ === 'D' || occ === 'T' ? occ : 'D'
  })()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedRoomId) return
    const selected = rooms.find((r) => r.id === selectedRoomId)
    if (!selected) return
    setSaving(true)
    try {
      await onChangeRoom(room.id, selectedRoomId, selected.number, occupancies[selectedRoomId] ?? currentOcc)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[#555555]">
          {t('bookings.currentRoom')} <span className="font-semibold text-[#1A1A1A]">{(room as unknown as { room_number?: string }).room_number ?? room.room_id?.slice(0, 8) ?? '—'}</span>
        </p>

        <p className="text-xs font-medium text-[#787774]">{t('bookings.selectNewRoom')}</p>

        {loading ? (
          <p className="text-sm text-[#787774]">{t('bookings.loadingAvailableRooms')}</p>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-[#787774]">{t('bookings.noAvailableRooms')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((r) => {
              const isSelected = selectedRoomId === r.id
              const cardOcc = occupancies[r.id] ?? currentOcc
              const occPrice = cardOcc === 'S' ? r.singlePrice : cardOcc === 'D' ? r.doublePrice : r.triplePrice
              return (
                <div
                  key={r.id}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-gray-900 bg-[#1A1A1A] text-white'
                      : 'border-[#EAEAEA] bg-[#F9F9F8] hover:border-[#D4D4D4]'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedRoomId(r.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${isSelected ? 'bg-[#BBBBBB]' : 'bg-emerald-400'}`} />
                        <span className="truncate text-sm font-bold leading-tight">{r.number}</span>
                      </div>
                      {isSelected && (
                        <span className="shrink-0 rounded-md bg-[#EDF3EC]/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-[10px] font-medium ${isSelected ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}>
                      {r.roomTypeName}
                    </p>
                    <p className={`mt-0.5 text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#1A1A1A]'}`}>
                      {cardOcc === 'T' ? 'Triple' : cardOcc === 'D' ? 'Double' : 'Single'}
                    </p>
                    <p className={`text-[10px] ${isSelected ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}>
                      {r.capacity} guest{r.capacity === 1 ? '' : 's'} &middot; Floor {r.floor}
                    </p>
                    <p className={`mt-1 text-sm font-bold ${isSelected ? 'text-emerald-300' : 'text-[#1A1A1A]'}`}>
                      {formatCurrency(occPrice, r.currency as CurrencyCode | undefined)}
                      <span className={`text-[10px] font-medium ${isSelected ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}>{t('bookings.perNight')}</span>
                    </p>
                  </button>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1.5 border-t border-[#333333] pt-2">
                      <span className="text-[10px] font-medium text-[#BBBBBB]">Occ:</span>
                      {(['S', 'D', 'T'] as const).map((code) => {
                        const active = cardOcc === code
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOccupancies((prev) => ({ ...prev, [r.id]: code }))
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
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[#555555] hover:bg-accent/10">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!selectedRoomId || saving}
            className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('bookings.changeRoomButton')}
          </button>
        </div>
      </form>
  )
}
