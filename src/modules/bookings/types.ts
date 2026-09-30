// 📁 src/modules/bookings/types.ts - Bookings module types

import type { PaginatedResponse, PaginationParams } from '@/shared/pagination/types'

export type BookingStatus = 'booked' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled'

export interface Booking {
  id: string
  contactId?: string
  guestId: string
  guestName: string
  roomId: string
  roomNumber: string
  checkIn: Date
  checkOut: Date
  status: BookingStatus
  totalAmount: number
  paidAmount: number
  /** The reservation's own currency (amounts are never converted). */
  currency: string
  createdAt: Date
  updatedAt: Date
  reservationId?: string    // original reservation id when expanded from reservation_rooms
  roomCount?: number        // total rooms in the reservation (>1 means multi-room)
  isSubBooking?: boolean     // expanded individual room entry (hidden from table, used for status grid)
  guestType?: string         // 'individual' | 'company' - from contact type
  occupancyLabel?: string    // 'Single' | 'Double' | 'Triple' for display
  nightlyRate?: number       // per-night rate for the room
  capacity?: number          // max guest capacity for occupancy display
}

export interface BookingFilters {
  status?: BookingStatus
  dateFrom?: Date
  dateTo?: Date
  guestName?: string
  roomNumber?: string
}

export interface CreateBookingInput {
  guestId: string
  roomId: string
  checkIn: Date
  checkOut: Date
}

export interface UpdateBookingInput {
  id: string
  status?: BookingStatus
  checkIn?: Date
  checkOut?: Date
}

export type BookingPageParams = PaginationParams
export type BookingPage = PaginatedResponse<Booking>
