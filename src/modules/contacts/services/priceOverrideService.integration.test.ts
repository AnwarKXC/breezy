import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPriceOverrides, upsertPriceOverrides, deletePriceOverride } from './priceOverrideService'

vi.mock('@/services/supabase/server')
vi.mock('./serviceSecurity')

// @ts-expect-error - vitest mock redirects to __mocks__/server.ts
import { mockQuery as serverQuery } from '@/services/supabase/server'

beforeEach(() => {
  vi.clearAllMocks()
  serverQuery.select.mockImplementation(() => serverQuery)
  serverQuery.eq.mockImplementation(() => serverQuery)
  serverQuery.is = vi.fn(() => serverQuery)
  serverQuery.order.mockImplementation(() => serverQuery)
  serverQuery.limit.mockImplementation(() => serverQuery)
  serverQuery.single.mockImplementation(() => serverQuery)
  serverQuery.upsert.mockImplementation(() => serverQuery)
  serverQuery.update.mockImplementation(() => serverQuery)
  serverQuery.result = { data: null, count: 0, error: null }
})

describe('getPriceOverrides', () => {
  it('returns price overrides for a contact', async () => {
    serverQuery.result = {
      data: [
        { id: 'o1', contact_id: 'c1', room_category: 'standard', occupancy_code: 'S', price: 100, currency: 'USD', created_at: '', updated_at: '' },
        { id: 'o2', contact_id: 'c1', room_category: 'deluxe', occupancy_code: 'D', price: 200, currency: 'USD', created_at: '', updated_at: '' },
      ],
      count: 2,
      error: null,
    }

    const result = await getPriceOverrides('c1')
    expect(result).toHaveLength(2)
    expect(result[0].roomCategory).toBe('standard')
    expect(result[0].occupancyCode).toBe('S')
    expect(result[1].price).toBe(200)
  })

  it('returns empty array when no overrides exist', async () => {
    serverQuery.result = { data: [], count: 0, error: null }
    const result = await getPriceOverrides('nonexistent')
    expect(result).toEqual([])
  })

  it('throws on database error', async () => {
    serverQuery.result = { data: null, count: 0, error: { message: 'DB error', code: 'PGRST000' } }
    await expect(getPriceOverrides('c1')).rejects.toThrow()
  })
})

describe('upsertPriceOverrides', () => {
  it('upserts price overrides', async () => {
    serverQuery.result = {
      data: [
        { id: 'o1', contact_id: 'c1', room_category: 'standard', occupancy_code: 'S', price: 150, currency: 'USD', created_at: '', updated_at: '' },
      ],
      count: 1,
      error: null,
    }

    const result = await upsertPriceOverrides('c1', [
      { contactId: 'c1', roomCategory: 'standard', occupancyCode: 'S', price: 150, currency: 'USD' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(150)
  })

  it('defaults currency to USD when omitted', async () => {
    serverQuery.result = {
      data: [
        { id: 'o1', contact_id: 'c1', room_category: 'standard', occupancy_code: 'S', price: 100, currency: 'USD', created_at: '', updated_at: '' },
      ],
      count: 1,
      error: null,
    }

    const result = await upsertPriceOverrides('c1', [
      { contactId: 'c1', roomCategory: 'standard', occupancyCode: 'S', price: 100 },
    ])
    expect(result).toHaveLength(1)
  })

  it('throws on database error', async () => {
    serverQuery.result = { data: null, count: 0, error: { message: 'DB error', code: 'PGRST000' } }
    await expect(upsertPriceOverrides('c1', [
      { contactId: 'c1', roomCategory: 'standard', occupancyCode: 'S', price: 100 },
    ])).rejects.toThrow()
  })
})

describe('deletePriceOverride', () => {
  it('soft-deletes a price override', async () => {
    serverQuery.result = { data: null, count: 1, error: null }
    await expect(deletePriceOverride('o1')).resolves.not.toThrow()
  })

  it('throws on database error', async () => {
    serverQuery.result = { data: null, count: 0, error: { message: 'DB error', code: 'PGRST000' } }
    await expect(deletePriceOverride('o1')).rejects.toThrow()
  })
})
