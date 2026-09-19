import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  hydrateWizardState,
  mapInvoiceItemsToWizardItems,
} from './invoiceWizardState'
import type { Invoice, InvoiceItem, InvoiceItemType } from '../types'
import type { WizardState } from '../types'

function item(overrides: Partial<InvoiceItem> = {}) {
  const { type, ...rest } = overrides
  return {
    id: 'item-1',
    invoiceId: 'inv-1',
    type: (type ?? 'room_charge') as InvoiceItemType,
    description: 'Room charge',
    quantity: 1,
    unitPrice: 1000,
    totalPrice: 1000,
    discountAmount: 0,
    taxAmount: 0,
    sortOrder: 0,
    createdAt: null,
    ...rest,
  }
}

const baseInvoice = {
  id: 'inv-1',
  invoiceNumber: 'INV-2026-0001',
  amount: 1140,
  subtotal: 1000,
  discount: 0,
  serviceCharge: 0,
  taxAmount: 140,
  taxRate: 14,
  contactId: 'c-1',
  guestName: 'John Doe',
  companyName: '',
  bookingId: null,
  roomId: null,
  roomNumber: null,
  issueDate: '2026-08-01',
  dueDate: '2026-08-15',
  status: 'draft',
  paidAmount: 0,
  refundedAmount: 0,
  remainingBalance: 0,
  currency: 'USD',
  publicNotes: '',
  internalNotes: '',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  createdBy: 'u-1',
  items: [] as InvoiceItem[],
} as unknown as Invoice & { items?: InvoiceItem[] }

function draftPrev(overrides: Partial<WizardState> = {}): WizardState {
  return {
    ...createInitialState('manual', baseInvoice),
    ...overrides,
  }
}

describe('hydrateWizardState', () => {
  it('loads items from the invoice when they arrive (THE BUG: amount rendered as 0)', () => {
    const prev = draftPrev() // list-invoice state: items empty, stale discount/tax
    const full = {
      ...baseInvoice,
      items: [
        item({ description: 'Room 101 - 2 nights', unitPrice: 1000, taxAmount: 140 }),
      ],
    }

    const next = hydrateWizardState(prev, 'manual', full)

    expect(next.items).toHaveLength(1)
    expect(next.items[0].unitPrice).toBe(1000)
    expect(next.items[0].quantity).toBe(1)
  })

  it('prefers the invoice items over stale previous items', () => {
    const prev = draftPrev({
      items: [item({ type: 'extra_service' as const, description: 'stale', unitPrice: 999 })],
    })
    const full = {
      ...baseInvoice,
      items: [
        item({ description: 'Room 101 - 2 nights', unitPrice: 1000, taxAmount: 140 }),
      ],
    }

    const next = hydrateWizardState(prev, 'manual', full)

    expect(next.items[0].description).toBe('Room 101 - 2 nights')
    expect(next.items[0].unitPrice).toBe(1000)
  })

  it('derives discount/serviceCharge/taxRate from the loaded invoice', () => {
    const prev = draftPrev({ discount: null, serviceCharge: 0, taxRate: 0 })
    const full = {
      ...baseInvoice,
      discount: 100,
      serviceCharge: 50,
      subtotal: 1000,
      taxAmount: 133,
      items: [item({ description: 'x' })],
    }

    const next = hydrateWizardState(prev, 'manual', full)

    expect(next.discount?.value).toBe(100)
    expect(next.serviceCharge).toBe(5)
    expect(next.taxRate).toBeGreaterThan(0)
  })

  it('keeps previous items/discount/tax when the invoice has no items (e.g. list row)', () => {
    const prev = draftPrev({
      items: [item({ type: 'extra_service' as const, description: 'kept', unitPrice: 50 })],
      discount: { type: 'fixed', value: 10, reason: '', approvedBy: null },
      taxRate: 5,
    })
    const listInvoice = { ...baseInvoice } // no items

    const next = hydrateWizardState(prev, 'manual', listInvoice)

    expect(next.items[0].description).toBe('kept')
    expect(next.discount?.value).toBe(10)
    expect(next.taxRate).toBe(5)
  })

  it('preserves contact/guest/notes edits and lookups across hydration', () => {
    const prev = draftPrev({
      guestName: 'Edited Name',
      publicNotes: 'note',
      internalNotes: 'internal',
      lookups: { bookings: [{ id: 'b-1' } as never], contacts: [], rooms: [] },
      lookupsLoading: false,
    })
    const next = hydrateWizardState(prev, 'manual', baseInvoice)

    expect(next.guestName).toBe('Edited Name')
    expect(next.publicNotes).toBe('note')
    expect(next.internalNotes).toBe('internal')
    expect(next.lookupsLoading).toBe(false)
    expect(next.contactId).toBe('c-1')
  })

  it('falls back to the invoice dates when untouched', () => {
    const prev = draftPrev({ issueDate: '2026-08-01', dueDate: '2026-08-15' })
    const next = hydrateWizardState(prev, 'manual', baseInvoice)

    expect(next.issueDate).toBe('2026-08-01')
    expect(next.dueDate).toBe('2026-08-15')
  })

  it('never produces a zero-item state for a loaded invoice', () => {
    const prev = draftPrev({ items: [] })
    const full = {
      ...baseInvoice,
      items: [item({ description: 'x', quantity: 2, unitPrice: 500 })],
    }

    const next = hydrateWizardState(prev, 'manual', full)

    expect(next.items).toHaveLength(1)
  })
})

describe('mapInvoiceItemsToWizardItems', () => {
  it('maps items and tolerates missing items', () => {
    expect(mapInvoiceItemsToWizardItems()).toEqual([])
    const mapped = mapInvoiceItemsToWizardItems([
      item({ description: 'Room', quantity: 2, unitPrice: 100, totalPrice: 200, taxAmount: 14 }),
    ])
    expect(mapped[0]).toMatchObject({ type: 'room_charge', quantity: 2, unitPrice: 100, totalPrice: 200 })
  })
})

describe('createInitialState', () => {
  it('creates an edit state with empty items for an item-less invoice', () => {
    const state = createInitialState('edit-draft', baseInvoice)
    expect(state.items).toEqual([])
    expect(state.contactId).toBe('c-1')
  })
})
