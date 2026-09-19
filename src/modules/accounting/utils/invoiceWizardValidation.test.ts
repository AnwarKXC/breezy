import { describe, expect, it } from 'vitest'
import {
  buildCreatePayload,
  computeDiscount,
  computeServiceCharge,
  computeSubtotal,
  computeTax,
  computeTotal,
  validateSubmitPayload,
} from './invoiceWizardValidation'
import type { WizardState } from '../types'

const baseState: WizardState = {
  mode: 'manual',
  step: 1,
  selectedBooking: null,
  contactId: '11111111-1111-4111-8111-111111111111',
  guestName: 'Mona Hassan',
  companyName: '',
  roomId: '',
  roomNumber: '',
  bookingId: '',
  items: [
    {
      type: 'room_charge',
      description: 'Room 203 - 2 nights',
      quantity: 2,
      unitPrice: 1200,
      totalPrice: 2400,
      discountAmount: 0,
      taxAmount: 0,
    },
  ],
  issueDate: '2026-06-03',
  dueDate: '2026-06-04',
  status: 'draft',
  recordPayment: false,
  payments: [],
  applyDeposit: false,
  depositAmount: 0,
  discount: { type: 'fixed', value: 100, reason: 'Manager approved', approvedBy: null },
  serviceCharge: 10,
  taxRate: 14,
  publicNotes: '',
  internalNotes: '',
  warnings: [],
  errors: {},
  saving: false,
  lookups: { bookings: [], contacts: [], rooms: [] },
  lookupsLoading: false,
  hasExistingInvoices: false,
  existingInvoiceIds: [],
  priceOverrides: [],
}

describe('invoice composer calculations', () => {
  it('builds a server payload from validated line items and totals', () => {
    const subtotal = computeSubtotal(baseState.items)
    const discount = computeDiscount(subtotal, baseState.discount)
    const serviceCharge = computeServiceCharge(subtotal, baseState.serviceCharge)
    const tax = computeTax(subtotal, discount, serviceCharge, baseState.taxRate)

    expect(computeTotal(subtotal, discount, serviceCharge, tax)).toBe(2895.6)
    expect(buildCreatePayload(baseState)).toMatchObject({
      contact_id: baseState.contactId,
      subtotal: 2400,
      discount: 100,
      service_charge: 240,
      tax_amount: 355.6,
      amount: 2895.6,
      items: [
        expect.objectContaining({
          description: 'Room 203 - 2 nights',
          quantity: 2,
          unit_price: 1200,
          sort_order: 0,
        }),
      ],
    })
  })

  it('requires contact, dates, items, and valid payment rows before submit', () => {
    const invalidState: WizardState = {
      ...baseState,
      contactId: '',
      guestName: '',
      issueDate: '2026-06-05',
      dueDate: '2026-06-04',
      items: [{ ...baseState.items[0], description: '' }],
      recordPayment: true,
      payments: [{ amount: 0, method: 'cash' }],
    }

    expect(validateSubmitPayload(invalidState)).toMatchObject({
      valid: false,
      errors: {
        contactId: 'A contact must be selected',
        dueDate: 'Due date must be on or after issue date',
        guestName: 'Guest or company is required',
        items: '1 item(s) have missing or invalid fields',
        payments: '1 payment(s) have invalid amount or method',
      },
    })
  })
})
