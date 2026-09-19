import type { Booking, BookingStatus } from '../types'
import type { Room, RoomStatus } from '@/modules/rooms/types'

const CLEAN_DURATION_MS = 2 * 60 * 60 * 1000

export type RoomAvailabilityStatus =
  | 'available'
  | 'booked'
  | 'pending'
  | 'occupied'
  | 'checked_out'
  | 'cancelled'
  | 'dirty'
  | 'cleaning'
  | 'maintenance'
  | 'out_of_service'
  | 'late_checkout'

export interface ReservationSummary {
  id: string
  guestName: string
  checkIn: Date
  checkOut: Date
  status: BookingStatus
  totalAmount: number
}

export type RoomAction =
  | 'check_in'
  | 'check_out'
  | 'cancel'
  | 'edit'
  | 'view'
  | 'invoice'
  | 'extend'
  | 'restore'

export interface DerivedRoomAvailability {
  status: RoomAvailabilityStatus
  currentReservation?: ReservationSummary
  nextReservation?: ReservationSummary
  actions: RoomAction[]
}

export interface DeriveRoomAvailabilityInput {
  room: Pick<Room, 'id' | 'status' | 'updatedAt'>
  bookings: Booking[]
  selectedDate?: Date
}

function toSummary(booking: Booking): ReservationSummary {
  return {
    id: booking.id,
    guestName: booking.guestName,
    checkIn: new Date(booking.checkIn),
    checkOut: new Date(booking.checkOut),
    status: booking.status,
    totalAmount: booking.totalAmount,
  }
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isWithinStay(checkIn: Date, checkOut: Date, target: Date): boolean {
  const t = target.getTime()
  return t >= new Date(checkIn).getTime() && t < new Date(checkOut).getTime()
}

function actionsForStatus(status: BookingStatus): RoomAction[] {
  switch (status) {
    case 'booked':
    case 'confirmed':
      return ['check_in', 'cancel', 'edit']
    case 'checked-in':
      return ['check_out', 'extend', 'invoice']
    case 'checked-out':
      return ['view', 'invoice']
    case 'cancelled':
      return ['view']
    default:
      return ['view']
  }
}

const PHYSICAL_STATUS_MAP: Record<RoomStatus, RoomAvailabilityStatus> = {
  available: 'available',
  occupied: 'occupied',
  maintenance: 'maintenance',
  cleaning: 'cleaning',
  dirty: 'dirty',
}

export function deriveRoomAvailability(
  input: DeriveRoomAvailabilityInput,
): DerivedRoomAvailability {
  const { room, bookings, selectedDate = new Date() } = input
  const roomBookings = bookings.filter((b) => b.roomId === room.id)

  const physicalStatus = PHYSICAL_STATUS_MAP[room.status] ?? 'available'

  if (physicalStatus === 'maintenance') {
    return { status: 'maintenance', actions: [] }
  }
  if (physicalStatus === 'cleaning') {
    return { status: 'cleaning', actions: [] }
  }
  if (physicalStatus === 'dirty') {
    if (room.updatedAt) {
      const elapsed = Date.now() - new Date(room.updatedAt).getTime()
      if (elapsed >= CLEAN_DURATION_MS) {
        return { status: 'available', actions: [] }
      }
    }
    return { status: 'dirty', actions: [] }
  }

  const checkedInBooking = roomBookings.find((b) => b.status === 'checked-in')
  if (checkedInBooking) {
    const isLateCheckout = sameDay(new Date(checkedInBooking.checkOut), selectedDate)
    return {
      status: isLateCheckout ? 'late_checkout' : 'occupied',
      currentReservation: toSummary(checkedInBooking),
      actions: actionsForStatus('checked-in'),
    }
  }

  const current = roomBookings.find(
    (b) =>
      b.status === 'confirmed' &&
      isWithinStay(b.checkIn, b.checkOut, selectedDate),
  )

  // A confirmed reservation means the room is spoken for, not that anyone is in
  // it — only a checked-in booking is 'occupied'. Reporting these as occupied is
  // why cells read "Occupied" while the Occupied stat card said 0.
  if (current) {
    return {
      status: 'booked',
      currentReservation: toSummary(current),
      actions: actionsForStatus('confirmed'),
    }
  }

  const arrivingToday = roomBookings.find(
    (b) =>
      (b.status === 'booked' || b.status === 'confirmed') &&
      sameDay(new Date(b.checkIn), selectedDate),
  )

  if (arrivingToday) {
    return {
      status: 'booked',
      currentReservation: toSummary(arrivingToday),
      actions: actionsForStatus(arrivingToday.status),
    }
  }

  // Cancelling a booking releases the room, so a cancelled booking must never
  // set the room's status — it fell through to here painting the room red and
  // permanently "Cancelled". The room's own physical status decides instead.

  const future = roomBookings
    .filter(
      (b) =>
        (b.status === 'booked' || b.status === 'confirmed') &&
        new Date(b.checkIn).getTime() > selectedDate.getTime(),
    )
    .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())

  return {
    status: physicalStatus === 'occupied' ? 'available' : physicalStatus,
    nextReservation: future[0] ? toSummary(future[0]) : undefined,
    actions: [],
  }
}
