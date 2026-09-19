import { describe, it, expect } from 'vitest'
import { mapPricingRow } from '../../types'
import type { PricingRow } from '../../types'

function makeRow(overrides: Partial<PricingRow> = {}): PricingRow {
  return {
    id: 'p1',
    room_type_id: 'rt1',
    price: 150,
    price_single: 100,
    price_double: 150,
    price_triple: 200,
    currency: 'USD',
    effective_from: '2024-01-01',
    effective_until: '2024-12-31',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  } as PricingRow
}

describe('mapPricingRow', () => {
  it('maps all fields correctly', () => {
    const row = makeRow()
    const result = mapPricingRow(row)
    expect(result).toEqual({
      id: 'p1',
      roomTypeId: 'rt1',
      price: 150,
      priceSingle: 100,
      priceDouble: 150,
      priceTriple: 200,
      currency: 'USD',
      effectiveFrom: '2024-01-01',
      effectiveUntil: '2024-12-31',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    })
  })

  it('converts price to Number', () => {
    const row = makeRow({ price: '250.50' as unknown as number })
    expect(mapPricingRow(row).price).toBe(250.5)
  })

  it('handles null price_single as null', () => {
    const row = makeRow({ price_single: null })
    expect(mapPricingRow(row).priceSingle).toBeNull()
  })

  it('converts non-null price_double to Number', () => {
    const row = makeRow({ price_double: '175.25' as unknown as number })
    expect(mapPricingRow(row).priceDouble).toBe(175.25)
  })

  it('handles null price_triple', () => {
    const row = makeRow({ price_triple: null })
    expect(mapPricingRow(row).priceTriple).toBeNull()
  })

  it('passes through effectiveFrom and effectiveUntil', () => {
    const row = makeRow({ effective_from: '2024-06-01', effective_until: '2024-12-31' })
    const result = mapPricingRow(row)
    expect(result.effectiveFrom).toBe('2024-06-01')
    expect(result.effectiveUntil).toBe('2024-12-31')
  })
})
