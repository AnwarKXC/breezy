'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { ROOM_STATUS_STYLES } from '../utils/roomStatusStyles'
import type { RoomAvailabilityStatus } from '../utils/deriveRoomAvailability'
import { CleanTimer } from './CleanTimer'

interface RoomStatusCellProps {
  roomNumber: string
  priceLabel: string
  status: RoomAvailabilityStatus
  dirtySince?: string | null
  pendingExpiry?: string | null
  onClick?: () => void
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

export function RoomStatusCell({ roomNumber, priceLabel, status, dirtySince, pendingExpiry, onClick }: RoomStatusCellProps) {
  const { t } = useTranslation()
  const style = ROOM_STATUS_STYLES[status as keyof typeof ROOM_STATUS_STYLES] ?? ROOM_STATUS_STYLES.available
  const label = t(style.labelKey)

  const tooltipText = pendingExpiry
    ? `This room pending until ${formatDate(pendingExpiry)}`
    : dirtySince
      ? 'This room is being cleaned'
      : `${roomNumber} — ${label} — ${priceLabel}`

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all duration-150 sm:rounded-xl sm:p-2 ${style.cell} ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <span className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full sm:left-1.5 sm:top-1.5 sm:h-2 sm:w-2 ${style.dot}`} />
      <span className="text-xs font-bold leading-tight text-[#1A1A1A] sm:text-sm">{roomNumber}</span>
      <span className="mt-0.5 max-w-full truncate text-[9px] font-medium text-[#787774] sm:text-[10px]">{priceLabel}</span>
      {status !== 'available' && (
        <span className="mt-0.5 hidden sm:inline text-[9px] font-medium text-[#787774]">{label}</span>
      )}
      {dirtySince && (
        <CleanTimer dirtySince={dirtySince} className="mt-0.5 hidden sm:block text-[9px] font-medium text-orange-500" />
      )}
      {pendingExpiry && (
        <span className="absolute -left-0.5 -top-0.5 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-[#FDEBEC]0 text-[8px] font-bold text-white shadow sm:left-0.5 sm:top-0.5 sm:h-5 sm:w-5 sm:text-[10px]">
          !
        </span>
      )}
      <div className="pointer-events-none absolute -top-2 left-1/2 z-[2] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#1A1A1A] px-2.5 py-1.5 text-xs text-white opacity-0  transition-opacity duration-100 group-hover:opacity-100">
        {tooltipText}
      </div>
    </button>
  )
}
