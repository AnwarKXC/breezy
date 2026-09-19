import type { RoomAvailabilityStatus } from './deriveRoomAvailability'

export interface RoomStatusStyle {
  cell: string
  dot: string
  badge: string
  labelKey: string
}

export const ROOM_STATUS_STYLES: Record<RoomAvailabilityStatus, RoomStatusStyle> = {
  available: {
    cell: 'bg-white border-[#EAEAEA] hover:border-[#D4D4D4]',
    dot: 'bg-[#D4D4D4]',
    badge: 'bg-[#F5F5F5] text-[#555555]',
    labelKey: 'bookings.roomStatus.available',
  },
  booked: {
    cell: 'bg-green-50 border-green-200 hover:border-green-400',
    dot: 'bg-green-400',
    badge: 'bg-green-100 text-green-700',
    labelKey: 'bookings.roomStatus.booked',
  },
  pending: {
    cell: 'bg-[#FBF3DB] border-amber-200 hover:border-amber-400',
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-[#956400]',
    labelKey: 'bookings.roomStatus.pending',
  },
  occupied: {
    cell: 'bg-[#E1F3FE] border-sky-200 hover:border-sky-400',
    dot: 'bg-sky-400',
    badge: 'bg-sky-100 text-[#1F6C9F]',
    labelKey: 'bookings.roomStatus.occupied',
  },
  checked_out: {
    cell: 'bg-[#F5F5F5] border-[#D4D4D4] hover:border-gray-400',
    dot: 'bg-gray-400',
    badge: 'bg-[#EAEAEA] text-[#555555]',
    labelKey: 'bookings.roomStatus.checkedOut',
  },
  cancelled: {
    cell: 'bg-[#FDEBEC] border-red-200 hover:border-red-400',
    dot: 'bg-red-400',
    badge: 'bg-[#FDEBEC] text-[#9F2F2D]',
    labelKey: 'bookings.roomStatus.cancelled',
  },
  dirty: {
    cell: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    dot: 'bg-orange-400',
    badge: 'bg-orange-100 text-orange-700',
    labelKey: 'bookings.roomStatus.dirty',
  },
  cleaning: {
    cell: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700',
    labelKey: 'bookings.roomStatus.cleaning',
  },
  maintenance: {
    cell: 'bg-[#FDEBEC] border-red-300 hover:border-red-500',
    dot: 'bg-[#FDEBEC]0',
    badge: 'bg-[#FDEBEC] text-[#9F2F2D]',
    labelKey: 'bookings.roomStatus.maintenance',
  },
  out_of_service: {
    cell: 'bg-[#F5F5F5] border-[#D4D4D4] hover:border-gray-400',
    dot: 'bg-gray-400',
    badge: 'bg-[#EAEAEA] text-[#555555]',
    labelKey: 'bookings.roomStatus.outOfService',
  },
  late_checkout: {
    cell: 'bg-rose-50 border-rose-200 hover:border-rose-400',
    dot: 'bg-rose-400',
    badge: 'bg-rose-100 text-rose-700',
    labelKey: 'bookings.roomStatus.lateCheckout',
  },
}

export const ROOM_STATUS_LEGEND: ReadonlyArray<{
  status: RoomAvailabilityStatus
  labelKey: string
}> = [
  { status: 'available', labelKey: 'bookings.legend.available' },
  { status: 'booked', labelKey: 'bookings.legend.booked' },
  { status: 'occupied', labelKey: 'bookings.legend.occupied' },
  { status: 'dirty', labelKey: 'bookings.legend.dirty' },
  { status: 'maintenance', labelKey: 'bookings.legend.maintenance' },
]

export interface BookingStatusStyle {
  badge: string
  labelKey: string
}

export const BOOKING_STATUS_STYLES: Record<string, BookingStatusStyle> = {
  booked: {
    badge: 'bg-green-100 text-green-700',
    labelKey: 'bookings.bookingStatus.booked',
  },
  confirmed: {
    badge: 'bg-sky-100 text-[#1F6C9F]',
    labelKey: 'bookings.bookingStatus.confirmed',
  },
  'checked-in': {
    badge: 'bg-blue-100 text-blue-700',
    labelKey: 'bookings.bookingStatus.checkedIn',
  },
  'checked-out': {
    badge: 'bg-[#EAEAEA] text-[#333333]',
    labelKey: 'bookings.bookingStatus.checkedOut',
  },
  cancelled: {
    badge: 'bg-[#FDEBEC] text-[#9F2F2D]',
    labelKey: 'bookings.bookingStatus.cancelled',
  },
}
