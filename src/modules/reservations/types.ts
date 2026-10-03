import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/services/db/rowTypes'

export type ReservationStatus = Enums<'reservation_status'>
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
export type BillingType = Enums<'billing_type'>
export type GuestRole = Enums<'reservation_guest_role'>
export type RoomAssignmentState = Enums<'reservation_room_status'>
export type HoldAction = 'created' | 'released' | 'expired'
export type OccupancyCode = 'S' | 'D' | 'T'

export type Reservation = Tables<'reservations'>
export type ReservationInsert = TablesInsert<'reservations'>
export type ReservationUpdate = TablesUpdate<'reservations'>

export type ReservationRoom = Tables<'reservation_rooms'>
export type ReservationRoomInsert = TablesInsert<'reservation_rooms'>
export type ReservationRoomUpdate = TablesUpdate<'reservation_rooms'>

export type ReservationGuest = Tables<'reservation_guests'>
export type ReservationGuestInsert = TablesInsert<'reservation_guests'>
export type ReservationGuestUpdate = TablesUpdate<'reservation_guests'>

export type ReservationCompanyInfo = Tables<'reservation_company_info'>
export type ReservationCompanyInfoInsert = TablesInsert<'reservation_company_info'>
export type ReservationCompanyInfoUpdate = TablesUpdate<'reservation_company_info'>

export type ReservationPricingItem = Tables<'reservation_pricing_items'>
export type ReservationPricingItemInsert = TablesInsert<'reservation_pricing_items'>

export type ReservationHold = Tables<'reservation_holds'>
export type ReservationHoldInsert = TablesInsert<'reservation_holds'>

export type ReservationNote = Tables<'reservation_notes'>
export type ReservationNoteInsert = TablesInsert<'reservation_notes'>

export type ReservationStatusHistory = Tables<'reservation_status_history'>

export type RoomStatusHistory = Tables<'room_status_history'>

export type PriceOverrideAuditLog = Tables<'price_override_audit_log'>

/** Live contact the reservation is booked under, resolved server-side. */
export interface ReservationContact {
  id: string
  name: string
  type: string
  phone: string | null
  email: string | null
}

export interface ReservationDetail extends Reservation {
  rooms: ReservationRoom[]
  guests: ReservationGuest[]
  companyInfo?: ReservationCompanyInfo | null
  contact?: ReservationContact | null
  pricingItems: ReservationPricingItem[]
  notes: ReservationNote[]
}

/** One admin-facing entry in a reservation's activity trail. */
export interface ReservationActivityEvent {
  id: string
  at: string
  kind: 'created' | 'status' | 'stay_change' | 'price_change' | 'extra_charge' | 'note' | 'edited' | 'guest_added' | 'guest_updated' | 'guest_removed'
  /** Status the reservation moved to (created / status events). */
  status?: string
  /** Human-readable detail: cancellation reason, stay change, price, charge. */
  detail?: string | null
  actor: { name: string; role: string } | null
}

export interface AvailabilityQuery {
  checkIn: string
  checkOut: string
  roomTypeId?: string
  capacity?: number
  contactId?: string
}

export interface AvailableRoom {
  roomId: string
  roomNumber: string
  roomTypeId: string
  roomTypeName: string
  floor: number
  capacity: number
  status: 'available' | 'unavailable'
  reason?: string
  price: number
  currency: string
  priceSource: string
}

export interface ConflictDetails {
  reason: string
  code: string
  conflictingReservationId?: string
  dates?: { checkIn: string; checkOut: string }
}

export interface CreateReservationWithRoomsInput {
  contactId?: string
  guestName: string
  guestId?: string
  checkIn: string
  checkOut: string
  roomTypeCounts: Array<{
    roomTypeId: string
    count: number
    occupancyCode: OccupancyCode
    overrideRatePerNight?: number | null
  }>
}

export interface CreateReservationWithRoomsResponse {
  reservationId: string
  rooms: Array<{
    roomId: string
    roomNumber: string
    roomTypeId: string
    occupancyCode?: string
    nightlyRate: number
  }>
}

export interface RoomTypeAvailability {
  roomTypeId: string
  requested: number
  got: number
}

export type ReservationErrorCode =
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'ROOM_UNAVAILABLE'
  | 'HOLD_CONFLICT'
  | 'EXTENSION_CONFLICT'
  | 'RESERVATION_CONFLICT'
  | 'OCCUPANCY_EXCEEDED'
  | 'OVERPAYMENT_NOT_ALLOWED'
  | 'REFUND_EXCEEDS_PAID'
  | 'INVALID_STATUS_TRANSITION'
  | 'TERMINAL_STATUS'
  | 'IDEMPOTENCY_MISMATCH'
  | 'OVERRIDE_THRESHOLD_EXCEEDED'

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: {
    code: ReservationErrorCode
    message: string
    details?: unknown
  }
  meta?: unknown
}

// ── Year overview ──

export type YearViewStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'other'

export interface YearOverviewStay {
  roomId: string
  reservationId: string
  code: string
  status: string
  /** Room stay start, ISO date (reservation_rooms.check_in_date) */
  from: string
  /** Room stay end, exclusive ISO date (reservation_rooms.check_out_date) */
  to: string
  /** Raw reservation source (e.g. "booking", "direct") */
  source: string
  guestName: string | null
  /** Company contact name when booked by a company, else null */
  companyName: string | null
  details: YearOverviewStayDetails
}

/** Hover-card facts for one room stay. Money is in the reservation's own currency. */
export interface YearOverviewStayDetails {
  currency: string
  /** This room's nightly rate and total */
  ratePerNight: number
  roomTotal: number
  /** Whole reservation (all rooms) */
  reservationTotal: number
  paid: number
  balance: number
  reservationNights: number
  adults: number
  children: number
  /** Primary guest */
  phone: string | null
  isVip: boolean
  /** Special requests, trimmed server-side */
  note: string | null
}

export interface YearOverviewRoom {
  id: string
  number: string
  typeId: string
}

export interface YearOverviewRoomType {
  id: string
  name: string
}

export interface YearOverviewPayload {
  year: number
  roomTypes: YearOverviewRoomType[]
  rooms: YearOverviewRoom[]
  stays: YearOverviewStay[]
}

export interface OccupancyCell {
  status: YearViewStatus
  code: string
  guestName: string | null
  /** Stay start, ISO date */
  from: string
  /** Stay end, exclusive ISO date */
  to: string
}
