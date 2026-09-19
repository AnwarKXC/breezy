'use client'

import { useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import type { RoomType } from '@/modules/room-types/types'
import type { Room } from '@/modules/rooms/types'
import type { DerivedRoomAvailability } from '../utils/deriveRoomAvailability'
import { ROOM_STATUS_STYLES } from '../utils/roomStatusStyles'
import { CleanTimer } from './CleanTimer'

interface RoomHistoryEntry {
  guestName: string
  checkIn: string
  checkOut: string
  status: string
  totalAmount: number
  contactNumber?: string
  idNumber?: string
  country?: string
}

interface RoomDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  room: Room | null
  roomTypes: RoomType[]
  availability: DerivedRoomAvailability | null
  priceLabel: string
  history?: RoomHistoryEntry[]
  onMarkAvailable?: (roomId: string) => void
  onSetMaintenance?: (roomId: string) => void
}

export function RoomDetailsModal({ isOpen, onClose, room, roomTypes, availability, priceLabel, history, onMarkAvailable, onSetMaintenance }: RoomDetailsModalProps) {
  const router = useRouter()
  const timerExpiredRef = useRef(false)
  const { t } = useTranslation()
  const roomTypeMap = useMemo(() => new Map(roomTypes.map((rt) => [rt.id, rt])), [roomTypes])
  if (!room || !availability) return null

  const style = ROOM_STATUS_STYLES[availability.status as keyof typeof ROOM_STATUS_STYLES] ?? ROOM_STATUS_STYLES.available
  const roomTypeName = roomTypeMap.get(room.roomTypeId)?.name ?? room.roomTypeId

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Room ${room.number}`} size="xl">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${style.badge}`}>
            {t(style.labelKey)}
          </span>
          {room.status === 'dirty' && room.updatedAt && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-orange-500">
              <CleanTimer dirtySince={room.updatedAt} />
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#F9F9F8] p-4">
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('rooms.price')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{priceLabel}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('rooms.capacity')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{room.capacity}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('rooms.type')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{roomTypeName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('common.status')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{t(style.labelKey)}</p>
          </div>
        </div>

        {availability.currentReservation && (
          <div className="rounded-xl border border-[#EAEAEA] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">Current Guest</p>
            <p className="text-sm font-semibold text-[#1A1A1A]">{availability.currentReservation.guestName}</p>
            <p className="mt-1 text-xs text-[#787774]">
              {new Date(availability.currentReservation.checkIn).toLocaleDateString()} — {new Date(availability.currentReservation.checkOut).toLocaleDateString()}
            </p>
          </div>
        )}

        {history && history.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">History</p>
            <div className="overflow-x-auto rounded-xl border border-[#EAEAEA]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#EAEAEA] bg-[#F9F9F8]">
                    <th className="px-3 py-2 font-medium text-[#787774]">Guest</th>
                    <th className="px-3 py-2 font-medium text-[#787774]">Check In</th>
                    <th className="px-3 py-2 font-medium text-[#787774]">Check Out</th>
                    <th className="px-3 py-2 font-medium text-[#787774]">Status</th>
                    <th className="px-3 py-2 font-medium text-[#787774]">Amount</th>
                    <th className="px-3 py-2 font-medium text-[#787774]">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => {
                    const bs = ROOM_STATUS_STYLES[entry.status as keyof typeof ROOM_STATUS_STYLES] ?? ROOM_STATUS_STYLES.available
                    return (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-2 font-medium text-[#1A1A1A]">{entry.guestName}</td>
                        <td className="px-3 py-2 text-[#555555]">{entry.checkIn}</td>
                        <td className="px-3 py-2 text-[#555555]">{entry.checkOut}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${bs.badge}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#1A1A1A]">{entry.totalAmount}</td>
                        <td className="px-3 py-2 text-[#555555]">{entry.contactNumber || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {room.status === 'dirty' && room.updatedAt && (
          <div className="rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#787774]">Cleaning Status</p>
                <CleanTimer
                  dirtySince={room.updatedAt}
                  className="mt-1 text-sm font-medium text-orange-500"
                  onExpire={() => {
                    if (onMarkAvailable && !timerExpiredRef.current) {
                      timerExpiredRef.current = true
                      onMarkAvailable(room.id)
                    }
                  }}
                />
              </div>
              {onMarkAvailable && (
                <button
                  type="button"
                  onClick={() => onMarkAvailable(room.id)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Mark Available
                </button>
              )}
            </div>
          </div>
        )}

        {room.status !== 'maintenance' && room.status !== 'dirty' && onSetMaintenance && (
          <button
            type="button"
            onClick={() => onSetMaintenance(room.id)}
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Set to Maintenance
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onClose()
            router.push(`/en/rooms/${room.id}`)
          }}
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100"
        >
          View Full Details →
        </button>
      </div>
    </Modal>
  )
}
