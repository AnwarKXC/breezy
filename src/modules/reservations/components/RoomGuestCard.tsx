'use client'

import { useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { reservationService } from '@/services/reservationService'
import type { ReservationRoom, ReservationGuest, OccupancyCode } from '@/modules/reservations/types'
import { GuestForm, type GuestFormData } from './GuestForm'
import { toast } from '@/shared/toast/toastEvents'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'

const ROLE_LABELS: Record<string, string> = {
  primary_guest: 'reservations.role_primary_guest',
  additional_guest: 'reservations.role_additional_guest',
  company_guest: 'reservations.role_company_guest',
  child: 'reservations.role_child',
}

function toGuestInput(data: GuestFormData) {
  return {
    full_name: data.full_name,
    email: data.email || null,
    phone: data.phone || null,
    document_type: data.document_type || null,
    document_number: data.document_number || null,
    nationality: data.nationality || null,
    role: data.role,
    is_primary: data.role === 'primary_guest',
    is_vip: false,
  }
}

function toFormData(guest: ReservationGuest): Partial<GuestFormData> {
  return {
    full_name: guest.full_name,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    document_type: guest.document_type ?? '',
    document_number: guest.document_number ?? '',
    nationality: guest.nationality ?? '',
    role: guest.role ?? 'additional_guest',
  }
}

interface Props {
  room: ReservationRoom
  reservationId: string
  guests: ReservationGuest[]
  onGuestChange: () => void
  roomCapacity?: number
  onExtend?: (room: ReservationRoom) => void
  onShorten?: (room: ReservationRoom) => void
  onChangeRoom?: (room: ReservationRoom) => void
  onEditPrice?: (room: ReservationRoom) => void
  onExtraCharge?: (room: ReservationRoom) => void
  extendedDate?: string
  shortenedDate?: string
}

export function RoomGuestCard({ room, reservationId, guests, onGuestChange, roomCapacity, onExtend, onShorten, onChangeRoom, onEditPrice, onExtraCharge, extendedDate, shortenedDate }: Props) {
  const { t } = useTranslation()
  const { formatCurrency, currencyCode } = useCurrency()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<string | null>(null)
  const [confirmRemoveGuest, setConfirmRemoveGuest] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  const handleAddGuest = async (data: GuestFormData) => {
    setSaving(true)
    const res = await reservationService.addGuest({
      ...toGuestInput(data),
      reservation_id: reservationId,
      reservation_room_id: room.id,
    } as never)
    if (res.ok) {
      setAddedCount((c) => c + 1)
      onGuestChange()
      toast.success(t('reservations.guestAdded'))
    } else {
      toast.error(res.error?.message ?? t('reservations.failedToAddGuest'))
    }
    setSaving(false)
  }

  const handleUpdateGuest = async (guestId: string, data: GuestFormData) => {
    setSaving(true)
    const res = await reservationService.updateGuest(reservationId, guestId, toGuestInput(data))
    if (res.ok) {
      setEditingGuest(null)
      onGuestChange()
      toast.success(t('reservations.guestUpdated'))
    } else {
      toast.error(res.error?.message ?? t('reservations.failedToUpdateGuest'))
    }
    setSaving(false)
  }

  const handleRemoveGuest = async (guestId: string) => {
    setSaving(true)
    setConfirmRemoveGuest(null)
    const res = await reservationService.removeGuest(reservationId, guestId)
    if (res.ok) {
      onGuestChange()
      toast.success(t('reservations.guestRemoved'))
    } else {
      toast.error(res.error?.message ?? t('reservations.failedToRemoveGuest'))
    }
    setSaving(false)
  }

  const roomNumber = (room as { room_number?: string | null }).room_number
  const roomOccCode = (room as { occupancy_code?: OccupancyCode | null }).occupancy_code
  const occLabel = roomOccCode === 'T' ? 'Triple' : roomOccCode === 'D' ? 'Double' : roomOccCode === 'S' ? 'Single' : null
  // ponytail: derive capacity from occupancy_code, not physical room capacity
  const occCapacity: number | undefined = roomOccCode === 'T' ? 3 : roomOccCode === 'D' ? 2 : roomOccCode === 'S' ? 1 : roomCapacity
  const canAddGuest = !occCapacity || guests.length < occCapacity

  return (
    <div className="rounded-lg border border-[#EAEAEA] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-[#1A1A1A]">
            {t('bookings.roomLabel')}{roomNumber ?? room.room_id?.slice(0, 8) ?? '—'}
          </span>
          {extendedDate && (
            <span className="ml-1.5 rounded bg-[#FDEBEC] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9F2F2D]">
              {t('reservations.extendDatePrefix')} {new Date(extendedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {shortenedDate && (
            <span className="ml-1.5 rounded bg-[#FDEBEC] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9F2F2D]">
              {t('reservations.shortenDatePrefix')} {new Date(shortenedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {occLabel && (
            <span className="ml-1.5 rounded bg-[#F0F0F0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#787774]">
              {occLabel}
            </span>
          )}
          {occCapacity && (
            <span className="ml-2 text-xs text-[#787774]">
              {t('reservations.guestCount').replace('{count}', String(guests.length)).replace('{capacity}', String(occCapacity))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(room as unknown as { price_source?: string }).price_source === 'manual_override' && (
            <span className="rounded bg-[#FBF3DB] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#956400]">
              {t('reservations.manualPriceBadge')}
            </span>
          )}
          <span className="text-sm font-medium text-[#333333]">
            {formatCurrency(
              (room as unknown as { rate_per_night?: number }).rate_per_night
                ?? (room as unknown as { nightly_rate?: number }).nightly_rate
                ?? 0,
              ((room as unknown as { currency?: string }).currency as CurrencyCode | undefined) ?? currencyCode,
            )}{t('bookings.perNight')}
          </span>
          {onEditPrice && (
            <button
              type="button"
              onClick={() => onEditPrice(room)}
              className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('reservations.editPriceLabel')}
            </button>
          )}
          {onExtraCharge && (
            <button
              type="button"
              onClick={() => onExtraCharge(room)}
              className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('reservations.extraChargeLabel')}
            </button>
          )}
          {onChangeRoom && (
            <button
              type="button"
              onClick={() => onChangeRoom(room)}
              className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('reservations.changeRoomLabel')}
            </button>
          )}
          {onShorten && (
            <button
              type="button"
              onClick={() => onShorten(room)}
              className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('reservations.shortenLabel')}
            </button>
          )}
          {onExtend && (
            <button
              type="button"
              onClick={() => onExtend(room)}
              className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
            >
              {t('reservations.extendLabel')}
            </button>
          )}
        </div>
      </div>

      {guests.length > 0 && (
        <div className="mb-3 space-y-2">
          {guests.map((guest) => (
              <div key={guest.id}>
                {editingGuest === guest.id ? (
                  <GuestForm
                    initial={toFormData(guest)}
                    onSubmit={(data) => handleUpdateGuest(guest.id, data)}
                    onCancel={() => setEditingGuest(null)}
                    loading={saving}
                  />
                ) : (
                  <div className="flex items-center justify-between rounded-lg bg-[#F9F9F8] px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium text-[#333333]">{guest.full_name}</span>
                      <span className="ml-2 text-xs text-[#787774]">{ROLE_LABELS[guest.role] ? t(ROLE_LABELS[guest.role]) : guest.role}</span>
                      {guest.email && (
                        <span className="ml-2 text-xs text-[#787774]">· {guest.email}</span>
                      )}
                      {guest.phone && (
                        <span className="ml-2 text-xs text-[#787774]">· {guest.phone}</span>
                      )}
                      {guest.document_number && (
                        <span className="ml-2 text-xs text-[#787774]">
                          · {guest.document_type ?? 'Doc'}: {guest.document_number}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingGuest(guest.id)}
                        className="text-xs font-medium text-[#787774] transition-colors hover:text-[#333333]"
                      >
                        {t('reservations.editGuest')}
                      </button>
                      <button
                        onClick={() => setConfirmRemoveGuest(guest.id)}
                        className="text-xs font-medium text-[#787774] transition-colors hover:text-rose-600"
                      >
                        {t('reservations.removeButton')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {showAddForm ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-[#787774]">
              {addedCount > 0 ? t(addedCount > 1 ? 'reservations.addedGuestCountPlural' : 'reservations.addedGuestCount').replace('{n}', String(addedCount)) : t('reservations.newGuestLabel')}
            </span>
          </div>
          <GuestForm
            key={addedCount}
            onSubmit={handleAddGuest}
            onCancel={() => { setShowAddForm(false); setAddedCount(0) }}
            loading={saving}
          />
        </div>
      ) : canAddGuest ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-sm font-medium text-[#787774] transition-colors hover:text-[#333333]"
        >
          {t('reservations.addGuest')}
        </button>
      ) : (
        <p className="text-xs text-[#787774]">{t('reservations.roomAtFullCapacity')}</p>
      )}

      {confirmRemoveGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="rounded-xl border border-[#EAEAEA] bg-white p-6 ">
            <p className="text-sm font-medium text-[#1A1A1A]">{t('reservations.removeThisGuest')}</p>
            <p className="mt-1 text-sm text-[#787774]">{t('reservations.cannotBeUndone')}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemoveGuest(null)}
                className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleRemoveGuest(confirmRemoveGuest)}
                disabled={saving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {saving ? t('common.deleting') : t('reservations.removeButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
