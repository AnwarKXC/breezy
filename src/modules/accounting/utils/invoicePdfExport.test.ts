import { describe, expect, it, vi } from 'vitest'
import { enrichInvoiceItemsForPdf, getInvoicePdfLabels, getInvoicePdfTotals } from './invoicePdfExport'
import type { InvoiceItem } from '../types'

describe('getInvoicePdfLabels', () => {
  it('returns Arabic invoice labels for the Arabic locale', () => {
    expect(getInvoicePdfLabels('ar')).toMatchObject({
      taxInvoice: '\u0641\u0627\u062a\u0648\u0631\u0629 \u0636\u0631\u064a\u0628\u064a\u0629',
      invoiceNumber: '\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629:',
      balanceDue: '\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0645\u0633\u062a\u062d\u0642',
      thankYou: '\u0634\u0643\u0631\u064b\u0627 \u0644\u0625\u0642\u0627\u0645\u062a\u0643',
    })
  })
})

describe('getInvoicePdfTotals', () => {
  it('trusts a stored zero tax/service breakdown instead of faking a split', () => {
    expect(getInvoicePdfTotals({
      amount: 5000,
      subtotal: 5000,
      serviceCharge: 0,
      taxAmount: 0,
    })).toEqual({
      subtotal: 5000,
      tax: 0,
      vat: 0,
    })
  })

  it('splits a legacy tax-inclusive total when subtotal was never stored', () => {
    expect(getInvoicePdfTotals({
      amount: 5000,
      subtotal: 0,
      serviceCharge: 0,
      taxAmount: 0,
    })).toEqual({
      subtotal: 3987.24,
      tax: 398.72,
      vat: 614.04,
    })
  })

  it('keeps stored tax values when available', () => {
    expect(getInvoicePdfTotals({
      amount: 5000,
      subtotal: 4000,
      serviceCharge: 400,
      taxAmount: 600,
    })).toEqual({
      subtotal: 4000,
      tax: 400,
      vat: 600,
    })
  })

  it('fills room type and actual occupancy from reservation rooms', async () => {
    const item = {
      id: 'item-1',
      invoiceId: 'invoice-1',
      type: 'room_charge',
      description: 'Room TEMP003 (2026-07-16 to 2026-07-17)',
      quantity: 1,
      unitPrice: 500,
      discountAmount: 0,
      taxAmount: 0,
      totalPrice: 500,
      sortOrder: 0,
      createdAt: null,
    } satisfies InvoiceItem
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          rooms: [{
            adults: 1,
            children: 0,
            room: { number: 'TEMP003' },
            room_type: { name: 'Single' },
          }],
        },
      }),
    })

    await expect(enrichInvoiceItemsForPdf(
      { notes: 'Auto-generated at check-out for reservation 017a066a-ddf2-435f-9eee-af75a4b404f8' },
      [item],
      fetcher as unknown as typeof fetch,
    )).resolves.toEqual([expect.objectContaining({
      roomTypeName: 'Single',
      occupancy: 1,
    })])
  })
})
