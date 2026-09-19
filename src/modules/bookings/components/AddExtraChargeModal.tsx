'use client'

import { useState, useMemo, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { Booking } from '../types'

interface SavedCharge {
  id: string
  day_index: number
  day_label: string
  label: string
  amount: number
}

interface DayCharge {
  dayIndex: number
  dayLabel: string
  label: string
  amount: number
}

const QUICK_CHARGES = [
  { label: 'Minibar', amount: 200 },
  { label: 'Laundry', amount: 150 },
  { label: 'Restaurant', amount: 350 },
  { label: 'Parking', amount: 100 },
  { label: 'Late Checkout', amount: 500 },
  { label: 'Damage Fee', amount: 0 },
]

interface AddExtraChargeModalProps {
  isOpen: boolean
  onClose: () => void
  booking: Booking | null
  formatCurrency: (amount: number) => string
  onSave: (bookingId: string, charges: DayCharge[]) => Promise<void>
  savedCharges?: SavedCharge[]
}

export function AddExtraChargeModal({ isOpen, onClose, booking, formatCurrency, onSave, savedCharges }: AddExtraChargeModalProps) {
  const { t } = useTranslation()
  const [pendingCharges, setPendingCharges] = useState<DayCharge[]>([])
  const [selectedDay, setSelectedDay] = useState(0)
  const [customLabel, setCustomLabel] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const days = useMemo(() => {
    if (!booking) return []
    const start = new Date(booking.checkIn)
    const end = new Date(booking.checkOut)
    const list: { index: number; label: string; date: Date }[] = []
    const cursor = new Date(start)
    let i = 0
    while (cursor < end) {
      list.push({
        index: i,
        label: t('bookings.dayLabel').replace('{n}', String(i + 1)).replace('{date}', cursor.toLocaleDateString()),
        date: new Date(cursor),
      })
      cursor.setDate(cursor.getDate() + 1)
      i++
    }
    return list
  }, [booking])

  if (!booking) return null

  const allCharges = [
    ...(savedCharges ?? []).map((c) => ({
      dayIndex: c.day_index,
      dayLabel: c.day_label,
      label: c.label,
      amount: c.amount,
      saved: true,
    })),
    ...pendingCharges.map((c) => ({
      ...c,
      saved: false,
    })),
  ]

  const totalCharges = allCharges.reduce((s, c) => s + c.amount, 0)
  const totalNewCharges = pendingCharges.reduce((s, c) => s + c.amount, 0)

  const addCharge = (label: string, amount: number) => {
    const day = days[selectedDay]
    if (!day) return
    setPendingCharges((prev) => [...prev, {
      dayIndex: selectedDay,
      dayLabel: day.label,
      label,
      amount,
    }])
  }

  const addCustomCharge = () => {
    if (!customLabel || !customAmount) return
    addCharge(customLabel, Number(customAmount))
    setCustomLabel('')
    setCustomAmount('')
  }

  const removePendingCharge = (idx: number) => {
    setPendingCharges((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (pendingCharges.length === 0) return
    setSaving(true)
    try {
      await onSave(booking.id, pendingCharges)
      setPendingCharges([])
      setSelectedDay(0)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('bookings.addExtraChargesTitle').replace('{name}', booking.guestName)} size="lg">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#787774]">{t('bookings.bookingDetails')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[#787774]">{t('bookings.roomLabel')}</span>
              <span className="font-semibold text-[#1A1A1A]">{booking.roomNumber}</span>
            </div>
            <div>
              <span className="text-[#787774]">{t('bookings.roomChargesLabel')}</span>
              <span className="font-semibold text-[#1A1A1A]">{formatCurrency(booking.totalAmount)}</span>
            </div>
            <div>
              <span className="text-[#787774]">{t('bookings.checkInBookingLabel')}</span>
              <span className="text-[#1A1A1A]">{new Date(booking.checkIn).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-[#787774]">{t('bookings.checkOutBookingLabel')}</span>
              <span className="text-[#1A1A1A]">{new Date(booking.checkOut).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">{t('bookings.selectDay')}</p>
          <div className="flex flex-wrap gap-1.5">
            {days.map((day) => {
              const dayCharges = allCharges.filter((c) => c.dayIndex === day.index)
              return (
                <button
                  key={day.index}
                  type="button"
                  onClick={() => setSelectedDay(day.index)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedDay === day.index
                      ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                      : 'border-[#EAEAEA] text-[#333333] hover:border-[#D4D4D4] hover:bg-[#F9F9F8]'
                  }`}
                >
                  {day.label}
                  {dayCharges.length > 0 && (
                    <span className="ml-1 text-[10px] opacity-70">({dayCharges.length})</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">
            {t('bookings.quickCharges').replace('{day}', days[selectedDay]?.label ?? '')}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_CHARGES.map((qc) => (
              <button
                key={qc.label}
                type="button"
                onClick={() => addCharge(qc.label, qc.amount)}
                className="rounded-lg border border-[#EAEAEA] px-3 py-1.5 text-xs font-medium text-[#333333] transition-colors hover:border-[#D4D4D4] hover:bg-[#F9F9F8]"
              >
                {qc.label}{qc.amount > 0 ? ` (${formatCurrency(qc.amount)})` : ''}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={t('bookings.itemNamePlaceholder')}
              className="flex-1 rounded-lg border border-[#EAEAEA] px-3 py-1.5 text-sm outline-none focus:border-gray-400"
            />
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={t('bookings.amountPlaceholder')}
              className="w-24 rounded-lg border border-[#EAEAEA] px-3 py-1.5 text-sm outline-none focus:border-gray-400"
            />
            <button
              type="button"
              disabled={!customLabel || !customAmount}
              onClick={addCustomCharge}
              className="rounded-lg bg-[#EAEAEA] px-3 py-1.5 text-sm font-medium text-[#333333] disabled:opacity-50"
            >
              {t('bookings.addExtraChargeLabel')}
            </button>
          </div>
        </div>

        {allCharges.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">
              {t('bookings.chargesCount').replace('{n}', String(allCharges.length))}
            </p>
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {allCharges.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[#F9F9F8] px-3 py-1.5 text-sm">
                  <div className="min-w-0 flex-1">
                    {c.saved && (
                      <span className="mr-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-[#346538]">{t('bookings.savedLabel')}</span>
                    )}
                    <span className="text-xs font-medium text-[#787774]">{c.dayLabel}</span>
                    <span className="ml-2 text-[#333333]">{c.label}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-medium text-[#1A1A1A]">{formatCurrency(c.amount)}</span>
                    {!c.saved && (
                      <button type="button" onClick={() => removePendingCharge(i - (savedCharges?.length ?? 0))} className="text-xs text-[#9F2F2D] hover:text-[#9F2F2D]">{t('bookings.removeCharge')}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[#EAEAEA] pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#787774]">{t('bookings.roomChargesSummary')}</span>
            <span className="text-[#1A1A1A]">{formatCurrency(booking.totalAmount)}</span>
          </div>
          {(savedCharges ?? []).length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#787774]">{t('bookings.savedExtraCharges')}</span>
              <span className="text-[#1A1A1A]">{formatCurrency(totalCharges - totalNewCharges)}</span>
            </div>
          )}
          {pendingCharges.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#787774]">{t('bookings.newExtraCharges')}</span>
              <span className="text-[#1A1A1A]">{formatCurrency(totalNewCharges)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-[#EAEAEA] pt-1 text-base font-bold">
            <span className="text-[#1A1A1A]">{t('common.total')}</span>
            <span className="text-[#1A1A1A]">{formatCurrency(booking.totalAmount + totalCharges)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[#555555] hover:bg-[#F5F5F5]">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pendingCharges.length === 0 || saving}
            className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('bookings.addToInvoice').replace('{amount}', formatCurrency(totalNewCharges))}
          </button>
        </div>
      </form>
    </Modal>
  )
}
