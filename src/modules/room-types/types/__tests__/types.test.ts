import { describe, it, expect } from 'vitest'
import { mapRoomTypeRow, toRoomTypeRow } from '../../types'
import type { RoomTypeRow } from '../../types'

function makeRow(overrides: Partial<RoomTypeRow> = {}): RoomTypeRow {
  return {
    id: 'rt1',
    name: 'Standard',
    slug: 'standard',
    description: 'A standard room',
    base_price: 100,
    default_capacity: 2,
    amenities: ['wifi', 'tv'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  } as RoomTypeRow
}

describe('mapRoomTypeRow', () => {
  it('maps all fields correctly', () => {
    const row = makeRow()
    const result = mapRoomTypeRow(row)
    expect(result).toEqual({
      id: 'rt1',
      name: 'Standard',
      slug: 'standard',
      description: 'A standard room',
      basePrice: 100,
      defaultCapacity: 2,
      amenities: ['wifi', 'tv'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    })
  })

  it('converts base_price string to number', () => {
    const row = makeRow({ base_price: '250.50' as unknown as number })
    expect(mapRoomTypeRow(row).basePrice).toBe(250.5)
  })

  it('handles null description', () => {
    const row = makeRow({ description: null })
    expect(mapRoomTypeRow(row).description).toBeNull()
  })
})

describe('toRoomTypeRow', () => {
  it('includes only defined fields from CreateInput', () => {
    const input = { name: 'Deluxe', slug: 'deluxe', base_price: 200 }
    const result = toRoomTypeRow(input)
    expect(result).toEqual({ name: 'Deluxe', slug: 'deluxe', base_price: 200 })
    expect(result).not.toHaveProperty('description')
    expect(result).not.toHaveProperty('default_capacity')
  })

  it('includes only defined fields from UpdateInput', () => {
    const input = { name: 'Updated' }
    const result = toRoomTypeRow(input)
    expect(result).toEqual({ name: 'Updated' })
  })

  it('returns empty object when all fields undefined', () => {
    const result = toRoomTypeRow({})
    expect(result).toEqual({})
  })

  it('correctly maps base_price from camelCase', () => {
    const input = { base_price: 300 }
    const result = toRoomTypeRow(input)
    expect(result.base_price).toBe(300)
  })
})
