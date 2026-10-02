'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import { ROOM_STATUS_LEGEND } from '../utils/roomStatusStyles'

export interface RoomStatusFilters {
  startDate: string
  endDate: string
  status: string
}

interface RoomStatusFilterModalProps {
  isOpen: boolean
  onClose: () => void
  current: RoomStatusFilters
  onApply: (filters: RoomStatusFilters) => void
}

export function RoomStatusFilterModal({ isOpen, onClose, current, onApply }: RoomStatusFilterModalProps) {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(current.startDate)
  const [endDate, setEndDate] = useState(current.endDate)
  const [status, setStatus] = useState(current.status)

  const handleApply = (e: FormEvent) => {
    e.preventDefault()
    onApply({ startDate, endDate, status })
    onClose()
  }

  const handleClear = () => {
    onApply({ startDate: '', endDate: '', status: '' })
    onClose()
  }

  const hasActiveFilters = status || startDate || endDate

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('bookings.roomStatusFilters')} size="md">
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

        {/* Room status */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">{t('bookings.roomStatusSection')}</p>
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
            {ROOM_STATUS_LEGEND.map(({ status: s, labelKey }) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(status === s ? '' : s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  status === s
                    ? 'border-accent bg-accent/10 text-accent-ink'
                    : 'border-[#EAEAEA] text-[#333333] hover:border-[#D4D4D4] hover:bg-accent/10'
                }`}
              >
                {t(labelKey)}
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
