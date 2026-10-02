'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import { BOOKING_STATUS_STYLES } from '../utils/roomStatusStyles'

const STATUS_OPTIONS = ['booked', 'confirmed', 'checked-in', 'checked-out', 'cancelled'] as const
const GUEST_TYPE_OPTIONS = ['individual', 'company'] as const

export interface BookingListFilters {
  startDate: string
  endDate: string
  status: string
  guestType: string
}

interface BookingListFilterModalProps {
  isOpen: boolean
  onClose: () => void
  current: BookingListFilters
  onApply: (filters: BookingListFilters) => void
}

export function BookingListFilterModal({ isOpen, onClose, current, onApply }: BookingListFilterModalProps) {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(current.startDate)
  const [endDate, setEndDate] = useState(current.endDate)
  const [status, setStatus] = useState(current.status)
  const [guestType, setGuestType] = useState(current.guestType)

  const handleApply = (e: FormEvent) => {
    e.preventDefault()
    onApply({ startDate, endDate, status, guestType })
    onClose()
  }

  const handleClear = () => {
    onApply({ startDate: '', endDate: '', status: '', guestType: '' })
    onClose()
  }

  const hasActiveFilters = status || guestType || startDate || endDate

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('bookings.bookingFilters')} size="md">
      <form onSubmit={handleApply} className="space-y-5">

        {/* Date range */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">{t('bookings.dateRange')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#787774]">{t('bookings.fromDate')}</label>
              <input
                type="date" max={endDate || undefined}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#EAEAEA] px-3 py-2 text-sm text-[#333333] outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#787774]">{t('bookings.toDate')}</label>
              <input
                type="date" min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-[#EAEAEA] px-3 py-2 text-sm text-[#333333] outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">{t('bookings.bookingStatusSection')}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatus('')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                status === ''
                  ? 'border-accent bg-accent/10 text-accent-ink'
                  : 'border-[#EAEAEA] text-[#333333] hover:border-[#D4D4D4] hover:bg-accent/10'
              }`}
            >
              {t('bookings.allStatuses')}
            </button>
            {STATUS_OPTIONS.map((s) => {
              const style = BOOKING_STATUS_STYLES[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(status === s ? '' : s)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    status === s
                      ? 'border-accent bg-accent/10 text-accent-ink'
                      : 'border-[#EAEAEA] text-[#333333] hover:border-[#D4D4D4] hover:bg-accent/10'
                  }`}
                >
                  {style ? t(style.labelKey) : s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Guest type */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">{t('bookings.guestTypeSection')}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setGuestType('')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                guestType === ''
                  ? 'border-accent bg-accent/10 text-accent-ink'
                  : 'border-[#EAEAEA] text-[#333333] hover:border-[#D4D4D4] hover:bg-accent/10'
              }`}
            >
              {t('bookings.allStatuses')}
            </button>
            {GUEST_TYPE_OPTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGuestType(guestType === g ? '' : g)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  guestType === g
                    ? 'border-accent bg-accent/10 text-accent-ink'
                    : 'border-[#EAEAEA] text-[#333333] hover:border-[#D4D4D4] hover:bg-accent/10'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-4">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasActiveFilters}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#787774] transition-colors hover:bg-accent/10 disabled:opacity-40"
          >
            {t('bookings.clearAll')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#555555] transition-colors hover:bg-accent/10"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              {t('bookings.filterApply')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
