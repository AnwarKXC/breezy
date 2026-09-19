import { describe, expect, it } from 'vitest'
import { buildCheckoutInvoiceDraft, mapCheckoutInvoiceForPdf } from './checkoutInvoice'

describe('checkout invoice helpers', () => {
  it('builds invoice rows without embedding line items on the invoices table payload', () => {
    const draft = buildCheckoutInvoiceDraft({
      reservation: {
        id: 'res-1',
        reservation_number: 'RSV-20260704-4FC12D',
        total_amount: 21000,
        currency: 'EGP',
        check_in_date: '2026-07-12',
        check_out_date: '2026-07-15',
        reservation_rooms: [
          { room_id: 'room-1', room: { number: 'TEMP004' }, total_amount: 15000, check_in_date: '2026-07-12', check_out_date: '2026-07-15' },
          { room_id: 'room-2', room: { number: 'TEMP005' }, total_amount: 6000, check_in_date: '2026-07-12', check_out_date: '2026-07-15' },
        ],
        pricing_items: [
          { pricing_level: 'service_charge', service_amount: 2100, total_amount: 2100 },
          { pricing_level: 'tax', tax_amount: 3234, total_amount: 3234 },
        ],
      },
      contactId: 'contact-1',
      guestName: 'Abdo Hesham',
      paymentMethod: 'cash',
      paidAmount: 26834,
      extraCharges: [{ label: 'Minibar', amount: 500 }],
      now: '2026-07-04T08:00:00.000Z',
    })

    expect(draft.invoice).not.toHaveProperty('items')
    expect(draft.invoice).toMatchObject({
      contact_id: 'contact-1',
      amount: 26834,
      subtotal: 21500,
      service_charge: 2100,
      tax_amount: 3234,
      paid_amount: 26834,
      remaining_balance: 0,
      status: 'paid',
      notes: 'Auto-generated at check-out for reservation res-1',
    })
    expect(draft.items).toHaveLength(3)
    expect(draft.reservationUpdate).toMatchObject({
      status: 'checked_out',
      paid_amount: 26834,
      balance_amount: 0,
    })
  })

  it('maps inserted invoice and items to the camelCase PDF shape', () => {
    const invoice = mapCheckoutInvoiceForPdf(
      {
        id: 'inv-1',
        contact_id: 'contact-1',
        invoice_number: 'INV-4FC12D',
        booking_id: null,
        room_id: null,
        room_number: null,
        amount: 21500,
        subtotal: 21500,
        discount: 0,
        tax_amount: 0,
        service_charge: 0,
        paid_amount: 21500,
        refunded_amount: 0,
        remaining_balance: 0,
        status: 'paid',
        issue_date: '2026-07-04',
        due_date: '2026-08-03',
        paid_at: '2026-07-04T08:00:00.000Z',
        stay_check_in: '2026-07-12',
        stay_check_out: '2026-07-15',
        notes: 'Auto-generated at check-out for reservation res-1',
        public_notes: null,
        internal_notes: null,
        guest_name: 'Abdo Hesham',
        company_name: null,
        currency: 'EGP',
        billing_address: null,
        payment_method: 'cash',
        void_reason: null,
        voided_at: null,
        voided_by: null,
        issued_at: null,
        issued_by: null,
        created_by: 'user-1',
        updated_by: null,
        created_at: '2026-07-04T08:00:00.000Z',
        updated_at: '2026-07-04T08:00:00.000Z',
      },
      [
        {
          id: 'item-1',
          invoice_id: 'inv-1',
          type: 'room_charge',
          description: 'Room TEMP004',
          quantity: 1,
          unit_price: 15000,
          discount_amount: 0,
          tax_amount: 0,
          total_price: 15000,
          sort_order: 0,
          created_at: '2026-07-04T08:00:00.000Z',
        },
      ],
      [{ id: 'pay-1', invoice_id: 'inv-1', type: 'cash', amount: 21500, description: 'Checkout payment', created_by: 'user-1', created_at: '2026-07-04T08:00:00.000Z', updated_at: null, deleted_at: null }],
      [{ room_id: 'room-1', room: { number: 'TEMP004' }, room_type: { name: 'Deluxe' }, adults: 2, children: 1 }],
    )

    expect(invoice.paidAmount).toBe(21500)
    expect(invoice.remainingBalance).toBe(0)
    expect(invoice.items?.[0]).toMatchObject({ unitPrice: 15000, totalPrice: 15000, roomTypeName: 'Deluxe', occupancy: 3 })
    expect(invoice.payments?.[0]).toMatchObject({ amount: 21500, type: 'cash' })
  })

  it('derives checkout VAT and service charge when pricing snapshots are missing', () => {
    const draft = buildCheckoutInvoiceDraft({
      reservation: {
        id: '017a066a-ddf2-435f-9eee-af75a4b404f8',
        total_amount: 1191.3,
        reservation_rooms: [
          { room_id: '1', room: { number: 'TEMP003' }, rate_per_night: 500, nights: 1, total_amount: 1000 },
          { room_id: '2', room: { number: 'TEMP002' }, rate_per_night: 150, nights: 1, total_amount: 150 },
          { room_id: '3', room: { number: 'TEMP011' }, rate_per_night: 300, nights: 1, total_amount: 300 },
        ],
      },
      contactId: 'contact-1',
      guestName: 'Guest',
      paymentMethod: 'cash',
      paidAmount: 1191.3,
      extraCharges: [],
      now: '2026-07-16T02:35:56.000Z',
    })

    expect(draft.invoice).toMatchObject({
      subtotal: 950,
      service_charge: 95,
      tax_amount: 146.3,
      amount: 1191.3,
    })
    expect(draft.items[0]).toMatchObject({ unit_price: 500, total_price: 500 })
  })

  it('preserves explicit zero service charge and VAT snapshots', () => {
    const draft = buildCheckoutInvoiceDraft({
      reservation: {
        id: 'tax-exempt',
        reservation_rooms: [{ room_id: '1', rate_per_night: 100, nights: 1 }],
        pricing_items: [{ pricing_level: 'nightly_rate', service_amount: 0, tax_amount: 0 }],
      },
      contactId: 'contact-1',
      guestName: 'Guest',
      paymentMethod: 'cash',
      paidAmount: 100,
      extraCharges: [],
      now: '2026-07-16T02:35:56.000Z',
    })

    expect(draft.invoice).toMatchObject({ subtotal: 100, service_charge: 0, tax_amount: 0, amount: 100 })
  })

  it('splits a tax-inclusive reservation total without changing its total', () => {
    const draft = buildCheckoutInvoiceDraft({
      reservation: {
        id: 'e5cb33cd-ef81-4378-bc94-b84bcdeb119b',
        total_amount: 5000,
        reservation_rooms: [{ room_id: 'room-103', room: { number: '103' }, rate_per_night: 5000, nights: 1 }],
      },
      contactId: 'contact-1',
      guestName: 'Ahmed',
      paymentMethod: 'cash',
      paidAmount: 5000,
      extraCharges: [],
      now: '2026-07-14T15:31:23.000Z',
    })

    expect(draft.invoice).toMatchObject({
      subtotal: 3987.24,
      service_charge: 398.72,
      tax_amount: 614.04,
      amount: 5000,
      remaining_balance: 0,
    })
    expect(draft.items[0]).toMatchObject({ unit_price: 3987.24, total_price: 3987.24 })
  })
})
