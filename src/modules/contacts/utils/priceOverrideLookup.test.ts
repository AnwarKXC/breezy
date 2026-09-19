import { describe, it, expect } from 'vitest'
import { findOverridePrice } from './priceOverrideLookup'
import type { CompanyPriceOverride } from '../types'

const overrides: CompanyPriceOverride[] = [
  { id: '1', contactId: 'c1', roomCategory: 'standard', occupancyCode: 'S', price: 100 },
  { id: '2', contactId: 'c1', roomCategory: 'standard', occupancyCode: 'D', price: 150 },
  { id: '3', contactId: 'c1', roomCategory: 'deluxe', occupancyCode: 'S', price: 200 },
]

describe('findOverridePrice', () => {
  it('returns the price when a matching override is found', () => {
    expect(findOverridePrice(overrides, 'standard', 'S')).toBe(100)
    expect(findOverridePrice(overrides, 'deluxe', 'S')).toBe(200)
  })

  it('returns null when no override matches the room category', () => {
    expect(findOverridePrice(overrides, 'suite', 'S')).toBeNull()
  })

  it('returns null when no override matches the occupancy code', () => {
    expect(findOverridePrice(overrides, 'standard', 'T')).toBeNull()
  })

  it('returns null when overrides array is empty', () => {
    expect(findOverridePrice([], 'standard', 'S')).toBeNull()
  })
})
