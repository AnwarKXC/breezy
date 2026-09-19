'use client'

import { deriveRoomPrice } from '../utils/deriveRoomPrice'
import { CleanTimer } from './CleanTimer'
import type { Room } from '@/modules/rooms/types'
import type { RoomType } from '@/modules/room-types/types'
import type { RoomTypePricing } from '@/modules/pricing/types'

interface BookingSummaryCardProps {
 selectedRooms: Room[]
 nights: number
  roomTypeMap: Map<string, RoomType>; pricingMap: Map<string, RoomTypePricing>; dirtyRoomsMap: Map<string, string>; formatCurrency: (amount: number) => string
 totalAmount: number
}

export function BookingSummaryCard({
 selectedRooms,
 nights,
 roomTypeMap,
 pricingMap,
 dirtyRoomsMap,
 formatCurrency,
 totalAmount,
}: BookingSummaryCardProps) {
 if (selectedRooms.length === 0 || nights === 0) return null

 return (
 <div className="rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] p-4"> <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">Summary</p> <div className="space-y-1.5"> {selectedRooms.map((room) => {
 const roomType = roomTypeMap.get(room.roomTypeId)
 const activePricing = pricingMap.get(room.roomTypeId)
 const derived = deriveRoomPrice({ room, roomType, pricing: activePricing, nights, formatCurrency })
 const roomDirtySince = dirtyRoomsMap.get(room.id) ?? null
 return (
 <div key={room.id}> <div className="flex items-center justify-between text-sm"> <span className="text-[#555555]"> Room {room.number} &times; {nights} {nights === 1 ? 'night' : 'nights'}
 </span> <span className="font-medium text-[#1A1A1A]">{derived.displayTotalPrice}</span> </div> {roomDirtySince && (
 <p className="mt-0.5 text-[10px] text-orange-500"> Check-in pending &mdash; room cleaning, available in <CleanTimer dirtySince={roomDirtySince} /> </p> )}
 </div> )
 })}
 <div className="border-t border-[#EAEAEA] pt-1.5"> <div className="flex items-center justify-between text-sm"> <span className="font-semibold text-[#1A1A1A]">Total</span> <span className="font-bold text-[#1A1A1A]">{formatCurrency(totalAmount)}</span> </div> </div> </div> </div> )
}
