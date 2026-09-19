'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'

interface DateRange {
  startDate: string
  endDate: string
}

interface DateRangeFilterModalProps {
  isOpen: boolean
  onClose: () => void
  currentRange: DateRange
  onApply: (range: DateRange) => void
}

export function DateRangeFilterModal({ isOpen, onClose, currentRange, onApply }: DateRangeFilterModalProps) {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(currentRange.startDate)
  const [endDate, setEndDate] = useState(currentRange.endDate)

  const handleApply = (e: FormEvent) => {
    e.preventDefault()
    onApply({ startDate, endDate })
    onClose()
  }

  const handleClear = () => {
    onApply({ startDate: '', endDate: '' })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('bookings.filter')}>
      <form onSubmit={handleApply} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]">
            {t('bookings.filterStartDate')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-[#EAEAEA] px-3 py-2 text-sm text-[#333333] outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]">
            {t('bookings.filterEndDate')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-[#EAEAEA] px-3 py-2 text-sm text-[#333333] outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#787774] transition-colors hover:bg-[#F5F5F5]"
          >
            {t('bookings.filterClear')}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#1A1A1A] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333333]"
          >
            {t('bookings.filterApply')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
