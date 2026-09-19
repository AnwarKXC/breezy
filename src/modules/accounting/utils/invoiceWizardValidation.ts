import {
  AccountingInvoiceCreateSchema,
  AccountingPaymentCreateSchema,
  zodErrorMessage,
} from '@/shared/validation'
import type { WizardItem, WizardDiscount, WizardPayment, WizardState } from '../types'

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
  warnings: string[]
}

export function computeSubtotal(items: WizardItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function computeDiscount(subtotal: number, discount: WizardDiscount | null): number {
  if (!discount || discount.value <= 0) return 0
  return discount.type === 'percentage'
    ? subtotal * (discount.value / 100)
    : discount.value
}

export function computeServiceCharge(subtotal: number, serviceCharge: number): number {
  return subtotal * (serviceCharge / 100)
}

export function computeTax(
  subtotal: number,
  totalDiscount: number,
  serviceChargeAmount: number,
  taxRate: number,
): number {
  return (subtotal - totalDiscount + serviceChargeAmount) * (taxRate / 100)
}

export function computeTotal(
  subtotal: number,
  totalDiscount: number,
  serviceChargeAmount: number,
  taxAmount: number,
): number {
  return Math.max(0, subtotal - totalDiscount + serviceChargeAmount + taxAmount)
}

export function computeTotalPayments(payments: WizardPayment[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0)
}

export function computeBalanceDue(total: number, depositApplied: number, totalPayments: number): number {
  return Math.max(0, total - depositApplied - totalPayments)
}

export function validateStep(state: WizardState, step: number): ValidationResult {
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  if (step === 0) {
    if ((state.mode === 'from-booking' || state.mode === 'checkout') && !state.selectedBooking) {
      errors.booking = 'Please select a booking'
    }
    if (state.mode === 'manual' && !state.guestName.trim() && !state.companyName.trim() && !state.contactId) {
      errors.guestName = 'Guest or company is required'
    }
  }

  if (step === 1) {
    if (state.items.length === 0) {
      errors.items = 'At least one charge item is required'
    } else {
      const invalidItems = state.items.filter(
        (item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0,
      )
      if (invalidItems.length > 0) {
        errors.items = `${invalidItems.length} item(s) have missing or invalid fields`
      }
    }
  }

  if (step === 2) {
    if (!state.issueDate) errors.issueDate = 'Issue date is required'
    if (!state.dueDate) errors.dueDate = 'Due date is required'

    if (state.recordPayment && state.payments.length === 0) {
      errors.payments = 'At least one payment entry is required'
    } else if (state.recordPayment) {
      const invalidPayments = state.payments.filter((p) => p.amount <= 0 || !p.method)
      if (invalidPayments.length > 0) {
        errors.payments = `${invalidPayments.length} payment(s) have invalid amount or method`
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, warnings }
}

export function validateSubmitPayload(state: WizardState): ValidationResult {
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  if ((state.mode === 'from-booking' || state.mode === 'checkout') && !state.selectedBooking) {
    errors.booking = 'Please select a booking'
  }

  if (state.mode === 'manual' && !state.guestName.trim() && !state.companyName.trim() && !state.contactId) {
    errors.guestName = 'Guest or company is required'
  }

  if (state.items.length === 0) {
    errors.items = 'At least one line item is required'
  } else {
    const invalidItems = state.items.filter(
      (item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0,
    )
    if (invalidItems.length > 0) {
      errors.items = `${invalidItems.length} item(s) have missing or invalid fields`
    }
  }

  if (!state.issueDate) errors.issueDate = 'Issue date is required'
  if (!state.dueDate) errors.dueDate = 'Due date is required'
  if (state.issueDate && state.dueDate && state.dueDate < state.issueDate) {
    errors.dueDate = 'Due date must be on or after issue date'
  }

  if (!state.contactId && !state.selectedBooking?.contactId) {
    errors.contactId = 'A contact must be selected'
  }

  const subtotal = computeSubtotal(state.items)
  const totalDiscount = computeDiscount(subtotal, state.discount)
  const serviceChargeAmount = computeServiceCharge(subtotal, state.serviceCharge)
  const taxAmount = computeTax(subtotal, totalDiscount, serviceChargeAmount, state.taxRate)
  const total = computeTotal(subtotal, totalDiscount, serviceChargeAmount, taxAmount)
  const totalPayments = computeTotalPayments(state.payments)

  if (total < 0) errors.total = 'Total amount cannot be negative'

  if (state.recordPayment && totalPayments > total) {
    warnings.push('Payment amount exceeds total. The difference will be recorded as outcome.')
  }

  if (state.recordPayment && state.payments.length === 0) {
    errors.payments = 'At least one payment entry is required'
  } else if (state.recordPayment) {
    const invalidPayments = state.payments.filter((p) => p.amount <= 0 || !p.method)
    if (invalidPayments.length > 0) {
      errors.payments = `${invalidPayments.length} payment(s) have invalid amount or method`
    }
  }

  const invoicePayload = buildCreatePayload(state)
  const invoicePayloadResult = AccountingInvoiceCreateSchema.safeParse(invoicePayload)
  if (!invoicePayloadResult.success) {
    errors.payload = zodErrorMessage(invoicePayloadResult.error)
  }

  if (state.recordPayment) {
    const placeholderInvoiceId = '00000000-0000-4000-8000-000000000000'
    const paymentResults = state.payments.map((payment) =>
      AccountingPaymentCreateSchema.safeParse({
        invoice_id: placeholderInvoiceId,
        amount: payment.amount,
        type: payment.method,
        description: 'Invoice payment',
      }),
    )
    const invalidPayment = paymentResults.find((result) => !result.success)
    if (invalidPayment && !invalidPayment.success) {
      errors.payments = zodErrorMessage(invalidPayment.error)
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, warnings }
}

export function buildCreatePayload(state: WizardState) {
  const subtotal = computeSubtotal(state.items)
  const totalDiscount = computeDiscount(subtotal, state.discount)
  const serviceChargeAmount = computeServiceCharge(subtotal, state.serviceCharge)
  const taxAmount = computeTax(subtotal, totalDiscount, serviceChargeAmount, state.taxRate)
  const total = computeTotal(subtotal, totalDiscount, serviceChargeAmount, taxAmount)

  return {
    contact_id: state.contactId || state.selectedBooking?.contactId || null,
    reservation_id: state.selectedBooking?.id ?? null,
    room_id: (state.selectedBooking?.roomId ?? state.roomId) || null,
    room_number: (state.selectedBooking?.roomNumber ?? state.roomNumber) || null,
    issue_date: state.issueDate,
    due_date: state.dueDate,
    status: state.status,
    subtotal,
    discount: Math.max(0, totalDiscount),
    tax_amount: Math.max(0, taxAmount),
    service_charge: Math.max(0, serviceChargeAmount),
    amount: Math.max(0, total),
    guest_name: state.guestName || state.selectedBooking?.guestName || null,
    company_name: state.companyName || state.selectedBooking?.companyName || null,
    public_notes: state.publicNotes || null,
    internal_notes: state.internalNotes || null,
    items: state.items.map((item, idx) => ({
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_amount: item.discountAmount || 0,
      tax_amount: item.taxAmount || 0,
      total_price: item.quantity * item.unitPrice,
      sort_order: idx,
    })),
  }
}

export function buildUpdatePayload(state: WizardState, invoiceId: string) {
  const createPayload = buildCreatePayload(state)
  return {
    ...createPayload,
    id: invoiceId,
  }
}
