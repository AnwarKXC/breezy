import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/modules/contacts/services/priceOverrideService', () => ({
  getPriceOverrides: vi.fn(),
  upsertPriceOverrides: vi.fn(),
}))

vi.mock('@/services/auth/serverSession', () => ({
  getCurrentServerSession: vi.fn(),
  verifyServerToken: vi.fn(),
}))

vi.mock('@/config/rbac', () => ({
  canPerformAction: vi.fn(() => true),
  ACTIONS: { CONTACTS_READ: 'contacts:read', CONTACTS_PRICE_OVERRIDES_UPDATE: 'contacts:price-overrides:update' },
}))

vi.mock('@/shared/csrf', () => ({
  validateCsrf: vi.fn(() => ({ error: undefined })),
}))

import { GET, PUT } from './[id]/price-overrides/route'
import { getPriceOverrides, upsertPriceOverrides } from '@/modules/contacts/services/priceOverrideService'
import { getCurrentServerSession } from '@/services/auth/serverSession'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentServerSession).mockResolvedValue({ id: 'user1', email: 'admin@test.com', role: 'admin' })
})

const context = { params: Promise.resolve({ id: '1' }) }

describe('GET /api/contacts/[id]/price-overrides', () => {
  it('returns price overrides', async () => {
    vi.mocked(getPriceOverrides).mockResolvedValue([
      { id: 'o1', contactId: '1', roomCategory: 'standard', occupancyCode: 'S', price: 100 },
    ])

    const request = new NextRequest('http://localhost/api/contacts/1/price-overrides')
    const response = await GET(request, context) as NextResponse
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })
})

describe('PUT /api/contacts/[id]/price-overrides', () => {
  it('upserts price overrides', async () => {
    vi.mocked(upsertPriceOverrides).mockResolvedValue([
      { id: 'o1', contactId: '1', roomCategory: 'standard', occupancyCode: 'S', price: 150, currency: 'USD' },
    ])

    const request = new NextRequest('http://localhost/api/contacts/1/price-overrides', {
      method: 'PUT',
      body: JSON.stringify({ overrides: [{ roomCategory: 'standard', occupancyCode: 'S', price: 150 }] }),
    })
    const response = await PUT(request, context) as NextResponse
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })
})
