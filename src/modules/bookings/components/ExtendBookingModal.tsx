'use client'

import { useState, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { checkExtensionConflict, getAlternativeRooms } from '@/services/checkExtensionConflict'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { Booking } from '../types'
import type { AvailableRoom } from '@/modules/reservations/types'

interface ExtendBookingModalProps {
  isOpen: boolean
  onClose: () => void
  booking: Booking | null
  onExtend: (bookingId: string, newCheckOut: Date, newRoomId?: string, newRoomNumber?: string) => Promise<void>
}

type CheckState = 'idle' | 'checking' | 'available' | 'conflict' | 'error'

function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Content remounts on every open/close, so each opening starts from fresh state.
export function ExtendBookingModal(props: ExtendBookingModalProps) {
  return <ExtendBookingModalContent key={props.isOpen ? 'open' : 'closed'} {...props} />
}

function ExtendBookingModalContent({ isOpen, onClose, booking, onExtend }: ExtendBookingModalProps) {
  const { formatCurrency } = useCurrency()
  const [newCheckOut, setNewCheckOut] = useState('')
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [conflictMessage, setConflictMessage] = useState('')
  const [alternativeRooms, setAlternativeRooms] = useState<AvailableRoom[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!booking) return null

  const checkoutDate = booking.checkOut instanceof Date
    ? booking.checkOut
    : new Date(booking.checkOut)

  const checkinDate = booking.checkIn instanceof Date
    ? booking.checkIn
    : new Date(booking.checkIn)

  // ponytail: local date parts avoid toISOString timezone drift
  const minDate = new Date(checkoutDate)
  minDate.setDate(minDate.getDate() + 1)
  const minY = minDate.getFullYear()
  const minM = String(minDate.getMonth() + 1).padStart(2, '0')
  const minD = String(minDate.getDate()).padStart(2, '0')
  const minStr = `${minY}-${minM}-${minD}`

  const ciY = checkinDate.getFullYear()
  const ciM = String(checkinDate.getMonth() + 1).padStart(2, '0')
  const ciD = String(checkinDate.getDate()).padStart(2, '0')
  const checkInStr = `${ciY}-${ciM}-${ciD}`

  const selectedDate = newCheckOut ? new Date(newCheckOut) : null
  const extraNights = selectedDate ? Math.max(0, dayDiff(checkoutDate, selectedDate)) : 0
  const ratePerNight = booking.nightlyRate ?? (booking.totalAmount / Math.max(1, dayDiff(checkinDate, checkoutDate)))
  const addedCost = extraNights * ratePerNight

  const handleDateChange = async (val: string) => {
    setNewCheckOut(val)
    setSelectedRoomId(null)
    if (!val) {
      setCheckState('idle')
      return
    }
    setCheckState('checking')
    try {
      const result = await checkExtensionConflict(
        booking.roomId,
        checkInStr,
        val,
        { reservationId: booking.reservationId },
      )
      if (result.ok) {
        setCheckState('available')
      } else {
        setCheckState('conflict')
        setConflictMessage('This room is not available for the selected extension period.')
        const alternatives = await getAlternativeRooms(checkInStr, val, booking.roomId)
        setAlternativeRooms(alternatives)
      }
    } catch {
      setCheckState('error')
      setConflictMessage('Failed to check availability.')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!newCheckOut) return
    if (checkState === 'conflict' && !selectedRoomId) return
    setSaving(true)
    try {
      const selectedRoom = alternativeRooms.find((r) => r.roomId === selectedRoomId)
      await onExtend(
        booking.id,
        new Date(newCheckOut),
        selectedRoom?.roomId,
        selectedRoom?.roomNumber,
      )
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = newCheckOut && (
    checkState === 'available' ||
    (checkState === 'conflict' && selectedRoomId !== null)
  )

  const confirmLabel = saving
    ? 'Saving...'
    : (checkState === 'conflict' && selectedRoomId ? 'Move & Extend' : 'Extend')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Extend stay`} size="xl">
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
            onChange={(e) => void handleDateChange(e.target.value)}
            className="w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2.5 text-sm text-[#333] outline-none transition-colors focus:border-[#999]"
          />
        </div>

        {checkState === 'checking' && (
          <p className="text-sm text-[#787774]">Checking availability...</p>
        )}

        {checkState === 'available' && newCheckOut && (
          <div className="rounded-lg border border-[#EDF3EC] bg-[#EDF3EC] px-4 py-3">
            <p className="text-sm font-medium text-[#346538]">
              Room is available until {selectedDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        )}

        {checkState === 'conflict' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#FDEBEC] bg-[#FDEBEC] px-4 py-3">
              <p className="text-sm font-medium text-[#9F2F2D]">{conflictMessage}</p>
            </div>
            {alternativeRooms.length > 0 ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">Available alternative rooms</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {alternativeRooms.map((room) => {
                    const isSelected = selectedRoomId === room.roomId
                    return (
                      <button
                        key={room.roomId}
                        type="button"
                        onClick={() => setSelectedRoomId(room.roomId)}
                        className={`rounded-lg border p-3 text-left transition-all duration-150 ${
                          isSelected
                            ? 'border-[#1A1A1A] bg-[#1A1A1A]'
                            : 'border-[#EAEAEA] bg-white hover:border-[#D4D4D4]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-[#1A1A1A]'}`}>
                            {room.roomNumber}
                          </span>
                          <span className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            isSelected ? 'bg-white/20 text-[#ccc]' : 'bg-[#F0F0F0] text-[#787774]'
                          }`}>
                            {room.capacity} pax
                          </span>
                        </div>
                        <span className={`mt-0.5 block text-[11px] font-medium ${
                          isSelected ? 'text-[#BBB]' : 'text-[#787774]'
                        }`}>
                          {room.roomTypeName}
                        </span>
                        <span className={`mt-0.5 block text-[11px] font-semibold ${
                          isSelected ? 'text-white' : 'text-[#333]'
                        }`}>
                          {formatCurrency(room.price)}
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-[#BBB]' : 'text-[#999]'}`}> / night</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#EAEAEA] bg-[#F9F9F8] px-4 py-5 text-center text-sm text-[#787774]">
                No alternative rooms available for this period.
              </div>
            )}
          </div>
        )}

        {checkState === 'error' && (
          <div className="rounded-lg border border-[#FDEBEC] bg-[#FDEBEC] px-4 py-3">
            <p className="text-sm font-medium text-[#9F2F2D]">{conflictMessage}</p>
          </div>
        )}

        {newCheckOut && extraNights > 0 && (
          <div className="border-t border-[#EAEAEA] pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#787774]">Extension summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[#787774]">Extra nights</span>
                <span className="font-medium text-[#333]">{extraNights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787774]">Rate</span>
                <span className="font-medium text-[#333]">{formatCurrency(ratePerNight)} / night</span>
              </div>
              <div className="flex justify-between border-t border-[#EAEAEA] pt-1">
                <span className="text-xs font-semibold text-[#1A1A1A]">Added to bill</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(addedCost)}</span>
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
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
