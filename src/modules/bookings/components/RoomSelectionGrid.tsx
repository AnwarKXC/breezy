'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { FloatingInput } from '@/shared/components/FloatingField'
import { CleanTimer } from './CleanTimer'
import { deriveRoomPrice } from '../utils/deriveRoomPrice'
import { ROOM_STATUS_STYLES } from '../utils/roomStatusStyles'
import { deriveRoomAvailability, type RoomAvailabilityStatus, type DeriveRoomAvailabilityInput } from '../utils/deriveRoomAvailability'
import type { Room } from '@/modules/rooms/types'
import type { RoomType } from '@/modules/room-types/types'
import type { RoomTypePricing } from '@/modules/pricing/types'
import type { Booking } from '../types'

interface RoomSelectionGridProps {
 editBooking?: unknown
 hasDates: boolean
 roomTypes: RoomType[]
 rooms: Room[]
  roomTypeMap: Map<string, RoomType>; pricingMap: Map<string, RoomTypePricing>; roomTypeCounts: Record<string, number>; roomTypeAvailability: Record<string, number>; totalRooms: number
  selectedRoomIds: Set<string>; roomAvailabilityMap: Map<string, RoomAvailabilityStatus>; overduePendingRooms: Set<string>; dirtyRoomsMap: Map<string, string>; bookings: Booking[]
 formatCurrency: (amount: number) => string
 statusLabel: (status: RoomAvailabilityStatus) => string
 roomCount: number
 selectedRoomTypeId: string
 onToggleRoom: (roomId: string) => void
 onTotalRoomsChange: (value: string) => void
 onRoomCountChange: (count: number) => void
 onSelectedRoomTypeIdChange: (id: string) => void
 onShowDateValidation: (show: boolean) => void
 onDecreaseRoomType: (roomTypeId: string) => void
 onIncreaseRoomType: (roomTypeId: string, maxAllowed: number) => void
}

export function RoomSelectionGrid({
 editBooking,
 hasDates,
 roomTypes,
 rooms,
 roomTypeMap,
 pricingMap,
 roomTypeCounts,
 roomTypeAvailability,
 totalRooms,
 selectedRoomIds,
 roomAvailabilityMap,
 overduePendingRooms,
 dirtyRoomsMap,
 bookings,
 formatCurrency,
 statusLabel,
 roomCount,
 selectedRoomTypeId,
 onToggleRoom,
 onTotalRoomsChange,
 onRoomCountChange,
 onSelectedRoomTypeIdChange,
 onShowDateValidation,
 onDecreaseRoomType,
 onIncreaseRoomType,
}: RoomSelectionGridProps) {
 const { t } = useTranslation()

 if (!editBooking) {
 return (
 <div className="rounded-xl border border-[#EAEAEA] p-5"> <div className="mb-4 flex flex-wrap items-end justify-between gap-3"> <div> <p className="text-xs font-bold uppercase tracking-wider text-[#787774]">Room distribution</p> <p className="mt-0.5 text-sm font-medium text-[#1A1A1A]">Choose by type</p> </div> <div className="w-32"> <FloatingInput
  label={t('reservations.new.totalRooms')}
 type="number" inputMode="numeric" step={1}
 min={1}
 value={String(totalRooms)}
 onChange={(e) => onTotalRoomsChange(e.target.value)}
 /> </div> </div> {!hasDates && (
 <p className="rounded-lg border border-dashed border-[#D4D4D4] bg-[#F9F9F8] p-4 text-sm text-[#787774]"> Select valid dates first to calculate room-type availability.
 </p> )}

 {hasDates && roomTypes.length> 0 && (
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"> {roomTypes.map((roomType) => {
 const requested = roomTypeCounts[roomType.id] ?? 0
 const available = roomTypeAvailability[roomType.id] ?? 0
 const isTooHigh = requested> available
 const isSelected = requested> 0
 const totalSelected = Object.values(roomTypeCounts).reduce((sum, c) => sum + c, 0)
 const selectedWithoutCurrent = totalSelected - requested
 const maxAllowed = Math.min(available, Math.max(0, totalRooms - selectedWithoutCurrent))
 const canDecrease = requested> 0
 const canIncrease = requested < maxAllowed

 return (
 <div
 key={roomType.id}
 className={`rounded-xl border p-4 transition-all ${
 isTooHigh
 ? 'border-red-200 bg-[#FDEBEC]'
 : isSelected
 ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
 : 'border-[#EAEAEA] bg-[#F9F9F8] hover:border-[#D4D4D4]'
 }`}> <div className="flex items-center justify-between gap-2"> <div className="min-w-0"> <p className={`text-sm font-semibold ${isSelected && !isTooHigh ? 'text-white' : 'text-[#1A1A1A]'}`}> {roomType.name}
 </p> <p className={`mt-0.5 text-xs ${isSelected && !isTooHigh ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}> Capacity {roomType.defaultCapacity} &middot; {available} available
 </p> </div> {requested> 0 && (
 <span className="shrink-0 rounded-md bg-[#EDF3EC]0/20 px-2 py-0.5 text-xs font-semibold text-emerald-300"> {requested}
 </span> )}
 </div> <div className="mt-3 flex items-center gap-2"> <button
 type="button"
 onClick={() => onDecreaseRoomType(roomType.id)}
 disabled={!canDecrease}
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-sm font-semibold text-[#555555] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
 aria-label={`Decrease ${roomType.name} rooms`}> &minus;
 </button> <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums"> {requested}
 </span> <button
 type="button"
 onClick={() => onIncreaseRoomType(roomType.id, maxAllowed)}
 disabled={!canIncrease}
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-sm font-semibold text-[#555555] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
 aria-label={`Increase ${roomType.name} rooms`}> +
 </button> </div> {isTooHigh && (
 <p className="mt-2 text-xs font-medium text-[#9F2F2D]"> Only {available} room{available === 1 ? '' : 's'} available.
 </p> )}
 </div> )
 })}
 </div> )}
 {hasDates && roomTypes.length === 0 && (
 <p className="text-sm text-[#787774]">No room types defined.</p> )}
 </div> )
 }

 return (
 <> <div className="grid grid-cols-2 gap-3"> <FloatingInput
  label={t('reservations.new.totalRooms')}
 type="number" inputMode="numeric" step={1}
 min={1}
 value={String(roomCount)}
 onChange={(e) => onRoomCountChange(Math.max(1, parseInt(e.target.value) || 1))}
 /> <select
 value={selectedRoomTypeId}
 onChange={(e) => onSelectedRoomTypeIdChange(e.target.value)}
 className="rounded-lg border border-[#EAEAEA] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950"> <option value="">Select room type</option> {roomTypes.map((rt) => (
 <option key={rt.id} value={rt.id}>{rt.name}</option> ))}
 </select> </div> <div className="overflow-x-hidden"> <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]"> Select Rooms
 {selectedRoomIds.size> 0 && (
 <span className="ml-2 font-normal text-[#787774]">({selectedRoomIds.size} selected)</span> )}
 </p> {rooms.length === 0 ? (
 <p className="text-sm text-[#787774]">{t('bookings.noRooms')}</p> ) : (
 <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"> {rooms.map((room) => {
 const roomType = roomTypeMap.get(room.roomTypeId)
 const activePricing = pricingMap.get(room.roomTypeId)
 const derived = deriveRoomPrice({ room, roomType, pricing: activePricing, formatCurrency })
 const isSelected = selectedRoomIds.has(room.id)
 const dateConflict = hasDates ? roomAvailabilityMap.get(room.id) : undefined
 const baseInput: DeriveRoomAvailabilityInput = { room, bookings, selectedDate: new Date() }
 const baseAvail = deriveRoomAvailability(baseInput)
 const displayStatus = dateConflict ?? baseAvail.status
 const style = ROOM_STATUS_STYLES[displayStatus] ?? ROOM_STATUS_STYLES.available
 const label = statusLabel(displayStatus)
 const isUnavailable = dateConflict !== undefined
 const hasOverduePending = overduePendingRooms.has(room.id)
 const dirtySince = dirtyRoomsMap.get(room.id) ?? null
 const tooltipText = hasOverduePending
 ? 'This room has pending reservations'
 : dirtySince
 ? 'This room is being cleaned'
 : `${room.number} — ${label} — ${derived.displayPricePerNight}`
 return (
 <button
 key={room.id}
 type="button"
 disabled={isUnavailable}
 onClick={() => {
 if (!hasDates) {
 onShowDateValidation(true)
 } else {
 onToggleRoom(room.id)
 }
 }}
 className={`group relative flex flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all duration-150 sm:rounded-xl sm:p-2 ${
 isSelected
 ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white ring-2 ring-gray-950'
 : isUnavailable
 ? `${style.cell} cursor-not-allowed opacity-60`
 : style.cell
 }`}> <span className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full sm:left-1.5 sm:top-1.5 sm:h-2 sm:w-2 ${isSelected ? 'bg-gray-400' : style.dot}`} /> <span className={`hidden sm:inline text-[9px] font-medium ${isSelected ? 'text-[#787774]' : 'text-[#787774]'}`}> {label}
 </span> <span className={`text-xs font-bold leading-tight sm:text-sm ${isSelected ? 'text-white' : 'text-[#1A1A1A]'}`}> {room.number}
 </span> <span className={`mt-0.5 max-w-full truncate text-[9px] font-medium sm:text-[10px] ${isSelected ? 'text-[#BBBBBB]' : 'text-[#787774]'}`}> {derived.displayPricePerNight}
 </span> {hasOverduePending && (
 <> <span className="absolute -left-0.5 -top-0.5 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-[#FDEBEC]0 text-[8px] font-bold text-white shadow sm:left-0.5 sm:top-0.5 sm:h-5 sm:w-5 sm:text-[10px]"> !
 </span> <div className="pointer-events-none absolute -top-2 left-1/2 z-[2] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#1A1A1A] px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100"> This room has pending bookings
 </div> </> )}
 {dirtySince && (
 <CleanTimer dirtySince={dirtySince} className="mt-0.5 hidden sm:block text-[9px] font-medium text-orange-500" /> )}
 {dirtySince && (
 <div className="pointer-events-none absolute -top-2 left-1/2 z-[2] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#1A1A1A] px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100"> This room is being cleaned. Available in <CleanTimer dirtySince={dirtySince} /> &mdash; check-in will be pending until then.
 </div> )}
 {isSelected && (
 <span className="absolute -right-0.5 -top-0.5 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-bold text-[#1A1A1A] shadow sm:-right-1 sm:-top-1 sm:h-5 sm:w-5 sm:text-[10px]"> ✓
 </span> )}
 {!hasOverduePending && !dirtySince && (
 <div className="pointer-events-none absolute -top-2 left-1/2 z-[2] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#1A1A1A] px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100"> {tooltipText}
 </div> )}
 </button> )
 })}
 </div> )}
 </div> </> )
}
