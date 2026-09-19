'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { Booking } from '../types'

interface ShortenBookingModalProps {
  isOpen: boolean
  onClose: () => void
  booking: Booking | null
  onShorten: (bookingId: string, newCheckOut: Date) => Promise<void>
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Opposite of ExtendBookingModal: pulls the check-out date earlier instead of
// later. Removing nights can never conflict with another booking, so there is
// no availability check here.
export function ShortenBookingModal({ isOpen, onClose, booking, onShorten }: ShortenBookingModalProps) {
  const { formatCurrency } = useCurrency()
  const [newCheckOut, setNewCheckOut] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setNewCheckOut('')
      setSaving(false)
    }
  }, [isOpen])

  if (!booking) return null

  const checkoutDate = booking.checkOut instanceof Date
    ? booking.checkOut
    : new Date(booking.checkOut)

  const checkinDate = booking.checkIn instanceof Date
    ? booking.checkIn
    : new Date(booking.checkIn)

  // ponytail: local date parts avoid toISOString timezone drift
  const minDate = new Date(checkinDate)
  minDate.setDate(minDate.getDate() + 1)
  const minY = minDate.getFullYear()
  const minM = String(minDate.getMonth() + 1).padStart(2, '0')
  const minD = String(minDate.getDate()).padStart(2, '0')
  const minStr = `${minY}-${minM}-${minD}`

  const maxDate = new Date(checkoutDate)
  maxDate.setDate(maxDate.getDate() - 1)
  const maxY = maxDate.getFullYear()
  const maxM = String(maxDate.getMonth() + 1).padStart(2, '0')
  const maxD = String(maxDate.getDate()).padStart(2, '0')
  const maxStr = `${maxY}-${maxM}-${maxD}`

  const selectedDate = newCheckOut ? new Date(newCheckOut) : null
  const removedNights = selectedDate ? Math.max(0, dayDiff(selectedDate, checkoutDate)) : 0
  const ratePerNight = booking.nightlyRate ?? (booking.totalAmount / Math.max(1, dayDiff(checkinDate, checkoutDate)))
  const refundAmount = removedNights * ratePerNight

  const canSubmit = Boolean(newCheckOut) && removedNights > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await onShorten(booking.id, new Date(newCheckOut))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Shorten stay" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="rounded-lg border border-[#EAEAEA] bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#1A1A1A]">
                  Room {booking.roomNumber}
                </span>
                {booking.occupancyLabel && (
                  <span className="rounded bg-[#F0F0F0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#787774]">
                    {booking.occupancyLabel}
                  </span>
                )}
                {booking.capacity && (
                  <span className="text-[10px] font-medium text-[#999]">
                    {booking.capacity} pax
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-[#787774]">
                <span>{checkinDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="text-[#ccc]">→</span>
                <span>{checkoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="ml-1 rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] font-medium">
                  {dayDiff(checkinDate, checkoutDate)} nights
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[#1A1A1A]">
                {formatCurrency(ratePerNight)}
              </p>
              <p className="text-[10px] font-medium text-[#999]">/ night</p>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#787774]">
            New check-out date
          </label>
          <input
            type="date"
            value={newCheckOut}
            min={minStr}
            max={maxStr}
            onChange={(e) => setNewCheckOut(e.target.value)}
            className="w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2.5 text-sm text-[#333] outline-none transition-colors focus:border-[#999]"
          />
        </div>

        {newCheckOut && removedNights > 0 && (
          <div className="border-t border-[#EAEAEA] pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#787774]">Shorten summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[#787774]">Removed nights</span>
                <span className="font-medium text-[#333]">{removedNights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787774]">Rate</span>
                <span className="font-medium text-[#333]">{formatCurrency(ratePerNight)} / night</span>
              </div>
              <div className="flex justify-between border-t border-[#EAEAEA] pt-1">
                <span className="text-xs font-semibold text-[#1A1A1A]">Removed from bill</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">-{formatCurrency(refundAmount)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-[#EAEAEA] bg-white px-4 py-2 text-sm font-medium text-[#555] transition-colors hover:bg-[#F5F5F5]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="rounded-md bg-[#1A1A1A] px-5 py-2 text-sm font-medium text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Shorten'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
