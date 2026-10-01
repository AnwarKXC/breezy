import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildInvoiceLineRows, enrichInvoiceItemsForPdf, type PdfInvoiceItem } from './invoicePdfExport'

const item = (over: Partial<PdfInvoiceItem>): PdfInvoiceItem => ({
  id: Math.random().toString(36),
  invoiceId: 'inv',
  type: 'room_charge',
  description: 'Room charge',
  quantity: 1,
  unitPrice: 30000,
  discountAmount: 0,
  taxAmount: 0,
  totalPrice: 30000,
  sortOrder: 0,
  createdAt: null,
  ...over,
})

const opts = { stayNights: 6, isRTL: false, itemLabel: (t: string) => (t === 'room_charge' ? 'Room Charge' : t) }

describe('buildInvoiceLineRows', () => {
  it('collapses identical rooms into one row and drops service/tax lines', () => {
    const rows = buildInvoiceLineRows(
      [
        ...['TEMP024', 'TEMP022', 'TEMP023'].map((n) =>
          item({ roomNumber: n, roomTypeName: 'Deluxe', occupancyCode: 'D', nights: 6, ratePerNight: 5000 }),
        ),
        item({ type: 'service_charge', description: 'Service charge (10%)', totalPrice: 9000 }),
        item({ type: 'tax', description: 'VAT (14%)', totalPrice: 13860 }),
      ],
      opts,
    )
    assert.deepEqual(rows, [
      { title: 'Deluxe · Double', details: ['3 rooms × 6 nights', 'TEMP022, TEMP023, TEMP024'], qty: 3, nights: 6, unitPrice: 5000, total: 90000 },
    ])
  })

  it('falls back to stay nights for unenriched generic lines', () => {
    const rows = buildInvoiceLineRows([item({}), item({})], opts)
    assert.deepEqual(rows, [{ title: 'Room Charge', details: ['2 rooms × 6 nights'], qty: 2, nights: 6, unitPrice: 5000, total: 60000 }])
  })

  it('keeps rooms with different rates on separate rows', () => {
    const rows = buildInvoiceLineRows(
      [item({ roomNumber: '101', nights: 6, ratePerNight: 5000 }), item({ roomNumber: '102', nights: 6, ratePerNight: 4000, totalPrice: 24000 })],
      opts,
    )
    assert.deepEqual(rows.map((r) => r.details), [['1 room × 6 nights', '101'], ['1 room × 6 nights', '102']])
  })
})

describe('extended rooms', () => {
  it('splits a room whose own dates differ from the stay and prints them', () => {
    const base = { roomTypeName: 'Deluxe', occupancyCode: 'D', ratePerNight: 5000, checkIn: '2026-09-24' }
    const rows = buildInvoiceLineRows(
      [
        item({ ...base, roomNumber: '101', nights: 6, checkOut: '2026-09-30' }),
        item({ ...base, roomNumber: '102', nights: 6, checkOut: '2026-09-30' }),
        item({ ...base, roomNumber: '103', nights: 8, checkOut: '2026-10-02', totalPrice: 40000 }),
      ],
      { ...opts, stay: { checkIn: '2026-09-24', checkOut: '2026-09-30' } },
    )
    assert.deepEqual(rows.map((r) => r.details), [
      ['2 rooms × 6 nights', '101, 102'],
      ['1 room × 8 nights · 2026-09-24 – 2026-10-02', '103'],
    ])
  })
})

describe('enrichInvoiceItemsForPdf', () => {
  it('matches generic room lines to reservation rooms by total', async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({
          data: {
            rooms: [
              { room_number: 'A', occupancy_code: 'S', nights: 6, rate_per_night: 4000, room_type: { name: 'Std' } },
              { room_number: 'B', occupancy_code: 'D', nights: 6, rate_per_night: 5000, room_type: { name: 'Dlx' } },
            ],
          },
        }),
      )) as typeof fetch
    const out = await enrichInvoiceItemsForPdf({ notes: null, reservationId: 'r1' }, [item({})], fetcher)
    const { roomNumber, roomTypeName, occupancyCode, nights, ratePerNight } = out[0]
    assert.deepEqual({ roomNumber, roomTypeName, occupancyCode, nights, ratePerNight }, { roomNumber: 'B', roomTypeName: 'Dlx', occupancyCode: 'D', nights: 6, ratePerNight: 5000 })
  })
})
