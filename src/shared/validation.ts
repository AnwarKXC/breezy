import { z } from 'zod'
import { isCountryCode } from '@/shared/static/countries'

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
    return `${path}${issue.message}`
  }).join('; ')
}

const optionalText = (max = 500) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable().optional(),
  )

const optionalUuid = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().uuid().nullable().optional(),
)

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const nonNegativeMoney = z.coerce.number().finite().min(0)
const positiveQuantity = z.coerce.number().finite().min(0.01)

export const RoomCreateSchema = z.object({
  number: z.string().min(1).max(10),
  floor: z.number().int().min(-5).max(200),
  room_type_id: z.string().uuid(),
  status: z.enum(['available', 'occupied', 'maintenance', 'cleaning', 'dirty']).optional(),
  occupancy_status: z.enum(['vacant', 'occupied']).optional(),
  housekeeping_status: z.enum(['clean', 'dirty', 'cleaning', 'inspected']).optional(),
  operational_status: z.enum(['active', 'maintenance', 'out_of_order', 'blocked']).optional(),
  price: z.number().min(0).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  amenities: z.any().optional(),
})

export const RoomTypeCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  base_price: z.number().min(0),
  default_capacity: z.number().int().min(1).max(50),
  amenities: z.any().optional(),
})

export const ReservationCreateSchema = z.object({
  booker_name: z.string().min(1).max(200).optional(),
  booker_email: z.string().email().max(300).optional(),
  booker_phone: z.string().max(30).optional(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  company_id: z.string().uuid().optional(),
  room_count: z.number().int().min(1).max(100).optional(),
  occupancy_adults: z.number().int().min(0).max(100).default(1),
  occupancy_children: z.number().int().min(0).max(100).default(0),
  source: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
})

export const PricingCreateSchema = z.object({
  room_type_id: z.string().uuid(),
  price: z.number().min(0),
  price_single: z.number().min(0).optional(),
  price_double: z.number().min(0).optional(),
  price_triple: z.number().min(0).optional(),
  currency: z.string().length(3).default('EGP'),
  effective_from: z.string().datetime().nullable().optional(),
  effective_until: z.string().datetime().nullable().optional(),
})

export const PriceOverrideSchema = z.object({
  room_category: z.string().min(1),
  occupancy_code: z.enum(['S', 'D', 'T']),
  price: z.number().min(0),
  currency: z.string().length(3).default('EGP'),
})

export const AccountingInvoiceItemSchema = z.object({
  type: z.enum([
    'room_charge', 'extra_service', 'minibar', 'laundry', 'restaurant',
    'late_checkout', 'early_check_in', 'damage_fee', 'cleaning_fee',
    'parking', 'transportation', 'discount', 'tax', 'service_charge',
    'manual_adjustment', 'cancellation_fee', 'other',
  ]),
  description: z.string().trim().max(300).default(''),
  quantity: positiveQuantity.default(1),
  unit_price: nonNegativeMoney.default(0),
  discount_amount: nonNegativeMoney.default(0),
  tax_amount: nonNegativeMoney.default(0),
  total_price: nonNegativeMoney.optional(),
  sort_order: z.number().int().min(0).optional(),
}).transform((item) => ({
  ...item,
  total_price: item.total_price ?? (item.quantity * item.unit_price - item.discount_amount + item.tax_amount),
}))

const AccountingInvoiceBaseSchema = z.object({
  contact_id: z.string().uuid(),
  invoice_number: z.string().trim().max(40).optional(),
  reservation_id: optionalUuid,
  room_id: optionalUuid,
  room_number: optionalText(30),
  subtotal: nonNegativeMoney.optional(),
  discount: nonNegativeMoney.default(0),
  tax_amount: nonNegativeMoney.default(0),
  service_charge: nonNegativeMoney.default(0),
  amount: nonNegativeMoney.optional(),
  status: z.enum(['draft', 'issued', 'partially_paid', 'partially_refunded', 'paid', 'overdue', 'void', 'refunded']).default('draft'),
  issue_date: dateString.optional(),
  due_date: dateString,
  stay_check_in: dateString.nullable().optional(),
  stay_check_out: dateString.nullable().optional(),
  guest_name: optionalText(200),
  company_name: optionalText(200),
  public_notes: optionalText(2000),
  internal_notes: optionalText(2000),
  billing_address: optionalText(500),
  currency: z.string().trim().length(3).default('EGP'),
  payment_method: z.enum([
    'instapay', 'vodafone_cash', 'cash', 'bank_transfer',
    'visa', 'card', 'online', 'ota', 'company_credit', 'other',
  ]).nullable().optional(),
  notes: optionalText(1000),
  items: z.array(AccountingInvoiceItemSchema).min(1, 'At least one invoice item is required').max(100).optional(),
})

function validateInvoiceDates(value: { due_date?: string; issue_date?: string }, ctx: z.RefinementCtx) {
  if (value.issue_date && value.due_date && value.due_date < value.issue_date) {
    ctx.addIssue({
      code: 'custom',
      message: 'Due date must be on or after issue date',
      path: ['due_date'],
    })
  }
}

export const AccountingInvoiceCreateSchema = AccountingInvoiceBaseSchema.superRefine(validateInvoiceDates)

export const AccountingInvoiceUpdateSchema = AccountingInvoiceBaseSchema.partial().extend({
  items: z.array(AccountingInvoiceItemSchema).min(1).max(100).optional(),
}).superRefine(validateInvoiceDates)

export const AccountingPaymentCreateSchema = z.object({
  invoice_id: z.string().uuid(),
  method: z.enum(['instapay', 'vodafone_cash', 'cash', 'bank_transfer', 'visa', 'card', 'online', 'ota', 'company_credit', 'other']),
  amount: z.coerce.number().finite(),
  description: optionalText(500),
})

export const AccountingExpenseCreateSchema = z.object({
  category_id: z.string().uuid(),
  amount: nonNegativeMoney.optional(),
  tax_amount: nonNegativeMoney.default(0),
  total_amount: nonNegativeMoney.optional(),
  description: z.string().trim().min(1).max(500),
  date: dateString,
  vendor: optionalText(200),
  payment_method: optionalText(80),
  receipt_url: optionalText(500),
  cost_center: z.enum(['rooms', 'housekeeping', 'maintenance', 'salaries', 'utilities', 'marketing', 'admin', 'food_beverage', 'other']).nullable().optional(),
  status: z.enum(['draft', 'approved', 'paid', 'void']).default('draft'),
}).superRefine((value, ctx) => {
  if (value.amount === undefined && value.total_amount === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'Amount or total amount is required',
      path: ['amount'],
    })
  }
}).transform((expense) => ({
  ...expense,
  amount: expense.amount ?? expense.total_amount ?? 0,
  total_amount: expense.total_amount ?? expense.amount ?? 0,
}))

export const AccountingExpenseCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  name_ar: optionalText(120),
  description: optionalText(500),
})

export const AccountingReasonSchema = z.object({
  reason: optionalText(500),
})

export const AccountingInvoiceRefundSchema = z.object({
  amount: z.coerce.number().finite().min(0.01),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
})

// amount 0 is intentionally allowed: it is how an existing discount is removed.
export const AccountingInvoiceDiscountSchema = z.object({
  amount: nonNegativeMoney,
  reason: z.string().trim().min(1, 'Reason is required').max(500),
})

export const AccountingRequiredReasonSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
})

export const AccountingSettingsUpdateSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.record(z.string(), z.unknown()),
})

export const AccountingIdQuerySchema = z.object({
  id: z.string().uuid(),
})

// ──────────────────────────────
// Room Updates
// ──────────────────────────────

export const RoomUpdateSchema = RoomCreateSchema.partial()

// ──────────────────────────────
// Room Type Updates
// ──────────────────────────────

export const RoomTypeUpdateSchema = RoomTypeCreateSchema.partial()

// ──────────────────────────────
// Pricing Updates
// ──────────────────────────────

export const PricingUpdateSchema = PricingCreateSchema.partial()

// ──────────────────────────────
// Reservation With Rooms
// ──────────────────────────────

export const OccupancyCodeSchema = z.enum(['S', 'D', 'T'])

export const ReservationRoomTypeCountSchema = z.object({
  roomTypeId: z.string().uuid(),
  count: z.number().int().min(0),
  occupancyCode: OccupancyCodeSchema.optional(),
  overrideRatePerNight: z.number().nonnegative().max(10_000_000).nullish(),
})

export const ReservationCreateWithRoomsSchema = z.object({
  contactId: z.string().uuid().optional(),
  guestName: z.string().trim().min(1).max(200),
  guestId: z.string().uuid().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  roomTypeCounts: z.array(ReservationRoomTypeCountSchema).min(1),
}).superRefine((value, ctx) => {
  if (value.checkOut <= value.checkIn) {
    ctx.addIssue({ code: 'custom', message: 'checkOut must be after checkIn', path: ['checkOut'] })
  }
  const today = new Date(new Date().toISOString().slice(0, 10))
  if (new Date(value.checkIn) < today) {
    ctx.addIssue({ code: 'custom', message: 'Check-in date cannot be in the past', path: ['checkIn'] })
  }
}).transform((value) => ({
  ...value,
  roomTypeCounts: value.roomTypeCounts.filter((r) => r.count > 0).map((r) => ({
    roomTypeId: r.roomTypeId,
    count: r.count,
    occupancyCode: r.occupancyCode ?? null,
    overrideRatePerNight: r.overrideRatePerNight ?? null,
  })),
}))

export const ReservationRoomPriceOverrideSchema = z.object({
  reservationRoomId: z.string().uuid(),
  ratePerNight: z.number().nonnegative().max(10_000_000).nullable(),
  reason: z.string().trim().max(500).optional(),
})

export const ReservationUpdateSchema = z.object({
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  booker_name: z.string().trim().max(200).nullable().optional(),
  booker_email: z.string().email().max(300).nullable().optional(),
  booker_phone: z.string().max(30).nullable().optional(),
  roomIds: z.array(z.string().uuid()).optional(),
  roomOccupancies: z.record(z.string(), OccupancyCodeSchema).optional(),
  roomOverrides: z.record(z.string(), z.number().nonnegative().max(10_000_000).nullable()).optional(),
}).superRefine((value, ctx) => {
  if (value.check_in_date && value.check_out_date && value.check_out_date <= value.check_in_date) {
    ctx.addIssue({ code: 'custom', message: 'check_out_date must be after check_in_date', path: ['check_out_date'] })
  }
})

// ──────────────────────────────
// Reservation Lifecycle Actions
// ──────────────────────────────

export const CancelReservationSchema = z.object({
  reason: z.string().trim().max(1000).nullable().optional(),
  feeAmount: z.coerce.number().finite().min(0).nullable().optional(),
})

export const ExtendReservationSchema = z.object({
  newCheckOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  reservationRoomId: z.string().uuid().optional(),
  newRoomId: z.string().uuid().optional(),
  newRoomNumber: z.string().max(10).optional(),
})

export const ShortenReservationSchema = z.object({
  newCheckOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  reservationRoomId: z.string().uuid().optional(),
})

export const ChangeRoomSchema = z.object({
  reservationRoomId: z.string().uuid(),
  newRoomId: z.string().uuid(),
  newRoomNumber: z.string().max(10).optional(),
  occupancyCode: z.enum(['S', 'D', 'T']).optional(),
})

export const ReservationNotesSchema = z.object({
  body: z.string().trim().min(1, 'Note body is required').max(5000),
  visibility: z.enum(['internal', 'public']).default('internal'),
})

export const ReservationExtrasSchema = z.object({
  reservationRoomId: z.string().uuid().optional(),
  charges: z.array(z.object({
    dayIndex: z.number().int().min(0),
    dayLabel: z.string().max(20),
    label: z.string().trim().min(1).max(200),
    amount: z.coerce.number().finite().min(0),
  })).min(1, 'At least one charge is required'),
})

export const ReservationHoldSchema = z.object({
  roomId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
})

// ──────────────────────────────
// Checkout
// ──────────────────────────────

export const PAYMENT_METHODS = ['cash', 'visa', 'instapay', 'vodafone_cash', 'bank_transfer'] as const

export const CheckoutSchema = z.object({
  extraCharges: z.array(z.object({
    label: z.string().trim().default('Extra charge'),
    amount: z.coerce.number().finite().default(0),
  })).optional().default([]),
  paymentMethod: z.enum(PAYMENT_METHODS).default('cash'),
  paidAmount: z.coerce.number().finite().min(0).default(0),
})

// ──────────────────────────────
// Contacts
// ──────────────────────────────

const contactPhoneSchema = z.string().min(6).max(20).regex(/^[+\d\s()-]{6,20}$/)
const contactEmailSchema = z.string().email().max(300)

// ISO 3166-1 alpha-2 code ('' clears the field on update).
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value): boolean => value === '' || isCountryCode(value), 'Invalid country')

export const ContactCreateSchema = z.object({
  type: z.enum(['company', 'individual']),
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: contactPhoneSchema.optional(),
  email: contactEmailSchema.optional(),
  logo: z.string().max(500).optional(),
  country: countryCodeSchema.optional(),
  city: z.string().trim().max(100).optional(),
  responsiblePerson: z.string().trim().max(200).optional(),
  idPassport: z.string().trim().max(100).optional(),
})

export const ContactUpdateSchema = z.object({
  type: z.enum(['company', 'individual']).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  phone: contactPhoneSchema.optional(),
  email: contactEmailSchema.optional(),
  logo: z.string().max(500).optional(),
  country: countryCodeSchema.optional(),
  city: z.string().trim().max(100).optional(),
  responsiblePerson: z.string().trim().max(200).optional(),
  idPassport: z.string().trim().max(100).optional(),
})

// ──────────────────────────────
// Users
// ──────────────────────────────

export const UserCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().email().max(300),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  phone: z.string().trim().min(1).max(30),
  role: z.enum(['admin', 'accountant', 'front_desk']),
})

export const UserUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().email().max(300).optional(),
  password: z.string().min(8).max(100).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  role: z.enum(['admin', 'accountant', 'front_desk']).optional(),
})

// ──────────────────────────────
// Extra Charges (Legacy Bookings)
// ──────────────────────────────

export const ExtraChargeCreateSchema = z.object({
  charges: z.array(z.object({
    dayIndex: z.number().int().min(0),
    dayLabel: z.string().max(20),
    label: z.string().trim().min(1).max(200),
    amount: z.coerce.number().finite(),
  })).min(1, 'At least one charge is required'),
})

// ──────────────────────────────
// Login
// ──────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email().max(300),
  password: z.string().min(1, 'Password is required').max(200),
})
