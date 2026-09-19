'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import type { ReservationRoom } from '@/modules/reservations/types'

interface EditPriceModalProps {
  isOpen: boolean
  onClose: () => void
  room: ReservationRoom | null
  onSave: (reservationRoomId: string, ratePerNight: number | null, reason?: string) => Promise<void>
}

export function EditPriceModal({ isOpen, onClose, room, onSave }: EditPriceModalProps) {
  const { t } = useTranslation()
  if (!room) return null
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('reservations.editPriceTitle')} size="md">
      <EditPriceModalBody key={room.id} room={room} onClose={onClose} onSave={onSave} />
    </Modal>
  )
}

function EditPriceModalBody({
  room,
  onClose,
  onSave,
}: {
  room: ReservationRoom
  onClose: () => void
  onSave: EditPriceModalProps['onSave']
}) {
  const { t } = useTranslation()
  const { formatCurrency, currencyCode } = useCurrency()
  const isManual = room.price_source === 'manual_override'
  const [rateText, setRateText] = useState(String(room.rate_per_night ?? ''))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const parsed = Number(rateText)
  const isValid = rateText.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  async function submit(ratePerNight: number | null, submitReason?: string) {
    setSaving(true)
    try {
      await onSave(room.id, ratePerNight, submitReason)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValid || saving) return
    void submit(parsed, reason.trim() || undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-[#F9F9F8] px-3 py-2 text-sm">
        <span className="text-[#787774]">{t('reservations.editPriceCurrentRate')}:</span>
        <span className="font-semibold text-[#1A1A1A]">
          {formatCurrency(Number(room.rate_per_night ?? 0), ((room as unknown as { currency?: string }).currency as CurrencyCode | undefined) ?? currencyCode)}
        </span>
        {isManual && (
          <span className="ml-auto rounded bg-[#FBF3DB] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#956400]">
            {t('reservations.manualPriceBadge')}
          </span>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[#787774]">{t('reservations.editPriceNewRate')}</span>
        <input
          type="number"
          min="1"
          step="any"
          value={rateText}
          onChange={(event) => setRateText(event.target.value)}
          className="h-10 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm tabular-nums focus:border-gray-900 focus:outline-none"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[#787774]">{t('reservations.editPriceReason')}</span>
        <input
          type="text"
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="h-10 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm focus:border-gray-900 focus:outline-none"
        />
      </label>

      {isManual && <p className="text-xs text-[#787774]">{t('reservations.editPriceResetHint')}</p>}

      <div className="flex items-center justify-between gap-2">
        {isManual ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit(null)}
            className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#F9F9F8] disabled:opacity-50"
          >
            {t('reservations.resetToStandard')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[#555555] hover:bg-[#F5F5F5]">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!isValid || saving}
            className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm text-white transition-colors hover:bg-[#333333] disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('reservations.editPriceSave')}
          </button>
        </div>
      </div>
    </form>
  )
}
