import type { Tables } from '@/services/db/rowTypes'
import type { Invoice, InvoiceItem, Payment } from '@/modules/accounting/types'

type MoneyValue = number | string | null | undefined

interface CheckoutRoomDraft {
  room_id: string | null
  room?: { number?: string | null } | null
  room_type?: { name?: string | null } | null
  adults?: number | null
  children?: number | null
  rate_per_night?: MoneyValue
  nights?: number | null
  total_amount?: MoneyValue
  check_in_date?: string | null
  check_out_date?: string | null
}

interface CheckoutReservationDraft {
  id: string
  reservation_number?: string | null
  total_amount?: MoneyValue
  currency?: string | null
  check_in_date?: string | null
  check_out_date?: string | null
  reservation_rooms?: CheckoutRoomDraft[] | null
  pricing_items?: Array<{
    pricing_level?: string | null
    service_amount?: MoneyValue
    tax_amount?: MoneyValue
    total_amount?: MoneyValue
  }> | null
}

interface ExtraChargeDraft {
  label: string
  amount: number
}

export interface CheckoutInvoiceDraftInput {
  reservation: CheckoutReservationDraft
  contactId: string
  guestName: string
  companyName?: string | null
  paymentMethod: string
  paidAmount: number
  extraCharges: ExtraChargeDraft[]
  now: string
  currency?: string
  // ponytail: settings-derived rates drive the fallback path; pricing_items
  // path is unaffected (it copies stored service_amount/tax_amount).
  serviceChargeRate?: number
  vatRate?: number
}

export interface CheckoutInvoiceDraft {
  invoice: Record<string, unknown>
  items: Record<string, unknown>[]
  reservationUpdate: Record<string, unknown>
}

function money(value: MoneyValue) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function buildCheckoutInvoiceDraft(input: CheckoutInvoiceDraftInput): CheckoutInvoiceDraft {
  const rooms = input.reservation.reservation_rooms ?? []
  const totalExtra = input.extraCharges.reduce((sum, charge) => sum + money(charge.amount), 0)
  const pricingItems = input.reservation.pricing_items ?? []
  // ponytail: read rates from accounting_settings (caller passes them in).
  // Defaults stay 10/14 only when the caller can't supply values — same as
  // the prior hardcoded behaviour so legacy callers don't regress.
  const serviceChargePercent = Number(input.serviceChargeRate ?? 10)
  const vatPercent = Number(input.vatRate ?? 14)
  const roomChargeSubtotal = rooms.length > 0
    ? rooms.reduce((sum, room) => sum + money(room.rate_per_night ?? room.total_amount) * Math.max(1, Number(room.nights ?? 1)), 0)
    : money(input.reservation.total_amount)
  const reservationGross = money(input.reservation.total_amount)
  const storedServiceCharge = pricingItems.reduce(
    (sum, item) => sum + money(item.service_amount)
      + (item.pricing_level === 'service_charge' && item.service_amount == null ? money(item.total_amount) : 0),
    0,
  )
  // ponytail: inclusiveSubtotal extracts net from a tax-inclusive gross using
  // the active rates instead of the legacy 1.254 (= 1.10 * 1.14) divisor.
  const inclusiveDivisor = 1 + serviceChargePercent / 100 + (vatPercent / 100) * (1 + serviceChargePercent / 100)
  const inclusiveSubtotal = money(reservationGross / inclusiveDivisor)
  const serviceCharge = money(pricingItems.length > 0 ? storedServiceCharge : inclusiveSubtotal * (serviceChargePercent / 100))
  const storedTaxAmount = pricingItems.reduce(
    (sum, item) => sum + money(item.tax_amount)
      + (item.pricing_level === 'tax' && item.tax_amount == null ? money(item.total_amount) : 0),
    0,
  )
  // ponytail: when no pricing_items, derive tax as (subtotal + serviceCharge) * vat%,
  // matching the same formula used by pricingService.calculatePricing.
  const taxAmount = money(pricingItems.length > 0
    ? storedTaxAmount
    : (inclusiveSubtotal + serviceCharge) * (vatPercent / 100))
  const subtotal = money((pricingItems.length > 0 ? roomChargeSubtotal : inclusiveSubtotal) + totalExtra)
  const totalAmount = money((pricingItems.length > 0 ? subtotal + serviceCharge + taxAmount : reservationGross + totalExtra))
  const paidAmount = Math.min(Math.max(0, money(input.paidAmount)), totalAmount)
  const remainingBalance = Math.max(0, totalAmount - paidAmount)
  const nowDate = new Date(input.now)
  const status = remainingBalance <= 0 && totalAmount > 0
    ? 'paid'
    : paidAmount > 0
      ? 'partially_paid'
      : 'issued'

  const roomItems = rooms.map((room, index) => {
    const nights = Math.max(1, Number(room.nights ?? 1))
    const grossUnitPrice = money(room.rate_per_night ?? room.total_amount)
    const allocation = roomChargeSubtotal > 0 ? grossUnitPrice * nights / roomChargeSubtotal : 0
    const amount = money((pricingItems.length > 0 ? roomChargeSubtotal : inclusiveSubtotal) * allocation)
    const unitPrice = money(amount / nights)
    return {
      type: 'room_charge',
      description: `Room ${room.room?.number ?? '—'} (${room.check_in_date ?? input.reservation.check_in_date ?? ''} to ${room.check_out_date ?? input.reservation.check_out_date ?? ''})`,
      quantity: nights,
      unit_price: unitPrice,
      discount_amount: 0,
      tax_amount: 0,
      total_price: amount,
      sort_order: index,
    }
  })

  const extraItems = input.extraCharges.map((charge, index) => {
    const amount = money(charge.amount)
    return {
      type: 'extra_service',
      description: charge.label,
      quantity: 1,
      unit_price: amount,
      discount_amount: 0,
      tax_amount: 0,
      total_price: amount,
      sort_order: roomItems.length + index,
    }
  })

  // Generate a unique invoice number using reservation ref + short timestamp suffix
  const invBase = `INV-${String(input.reservation.reservation_number ?? input.reservation.id).slice(0, 8).toUpperCase()}`
  const timestampSuffix = Date.now().toString(36).toUpperCase().slice(-4)
  const invoiceNumber = `${invBase}-${timestampSuffix}`

  return {
    invoice: {
      contact_id: input.contactId,
      invoice_number: invoiceNumber,
      amount: totalAmount,
      subtotal,
      discount: 0,
      tax_amount: taxAmount,
      service_charge: serviceCharge,
      paid_amount: paidAmount,
      remaining_balance: remainingBalance,
      paid_at: paidAmount > 0 && remainingBalance <= 0 ? input.now : null,
      status,
      currency: input.currency ?? input.reservation.currency ?? 'EGP',
      issue_date: input.now.slice(0, 10),
      due_date: addDays(nowDate, 30).toISOString().slice(0, 10),
      stay_check_in: input.reservation.check_in_date ?? null,
      stay_check_out: input.reservation.check_out_date ?? null,
      guest_name: input.guestName,
      company_name: input.companyName ?? null,
      payment_method: input.paymentMethod,
      notes: `Auto-generated at check-out for reservation ${input.reservation.id}`,
      refunded_amount: 0,
    },
    items: [...roomItems, ...extraItems],
    reservationUpdate: {
      status: 'checked_out',
      checked_out_at: input.now,
      paid_amount: paidAmount,
      balance_amount: remainingBalance,
      // ponytail: keep reservation currency aligned with the new invoice
      // total (system currency). Otherwise ReservationDetailHeader would
      // still read the legacy 'EGP' set by the RPC and convert the USD
      // total a second time, shrinking the displayed amount by ~50x.
      currency: input.currency ?? input.reservation.currency ?? 'EGP',
    },
  }
}

export function mapCheckoutInvoiceForPdf(
  row: Tables<'invoices'>,
  itemRows: Tables<'invoice_items'>[] = [],
  paymentRows: Tables<'payments'>[] = [],
  rooms: CheckoutRoomDraft[] = [],
): Invoice & { payments?: Payment[] } {
  const roomDetails = new Map(rooms.map((room) => [room.room?.number, room]))
  const invoice: Invoice & { payments?: Payment[] } = {
    id: row.id,
    contactId: row.contact_id,
    invoiceNumber: row.invoice_number,
    reservationId: row.reservation_id ?? null,
    roomId: row.room_id ?? null,
    roomNumber: row.room_number ?? null,
    amount: money(row.amount),
    subtotal: money(row.subtotal),
    discount: money(row.discount),
    discountReason: row.discount_reason ?? null,
    taxAmount: money(row.tax_amount),
    serviceCharge: money(row.service_charge),
    paidAmount: money(row.paid_amount),
    refundedAmount: money(row.refunded_amount),
    remainingBalance: money(row.remaining_balance),
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    paidAt: row.paid_at ?? null,
    stayCheckIn: row.stay_check_in ?? null,
    stayCheckOut: row.stay_check_out ?? null,
    notes: row.notes ?? null,
    publicNotes: row.public_notes ?? null,
    internalNotes: row.internal_notes ?? null,
    guestName: row.guest_name ?? null,
    companyName: row.company_name ?? null,
    currency: row.currency ?? 'EGP',
    billingAddress: row.billing_address ?? null,
    paymentMethod: row.payment_method ?? null,
    voidReason: row.void_reason ?? null,
    voidedAt: row.voided_at ?? null,
    voidedBy: row.voided_by ?? null,
    issuedAt: row.issued_at ?? null,
    issuedBy: row.issued_by ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    items: itemRows.map((item): InvoiceItem => {
      const roomNumber = String(item.description ?? '').match(/Room\s+(\S+)/)?.[1]
      const room = roomNumber ? roomDetails.get(roomNumber) : undefined
      return {
        id: item.id,
        invoiceId: item.invoice_id,
        type: item.type,
        description: item.description,
        quantity: money(item.quantity),
        unitPrice: money(item.unit_price),
        discountAmount: money(item.discount_amount),
        taxAmount: money(item.tax_amount),
        totalPrice: money(item.total_price),
        sortOrder: Number(item.sort_order ?? 0),
        createdAt: item.created_at ?? null,
        roomTypeName: room?.room_type?.name ?? undefined,
        occupancy: room ? Number(room.adults ?? 0) + Number(room.children ?? 0) : undefined,
      }
    }),
  }

  invoice.payments = paymentRows.map((payment): Payment => ({
    id: payment.id,
    invoiceId: payment.invoice_id,
    invoiceNumber: null,
    method: payment.method,
    amount: money(payment.amount),
    currency: payment.currency as Payment['currency'],
    description: payment.description ?? null,
    createdBy: payment.created_by ?? null,
    createdAt: payment.created_at ?? null,
    updatedAt: payment.updated_at ?? null,
  }))

  return invoice
}
