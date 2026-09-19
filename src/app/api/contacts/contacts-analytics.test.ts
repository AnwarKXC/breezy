import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/modules/contacts/services/contactService', () => ({
  getContactsMetrics: vi.fn(),
}))

vi.mock('@/services/auth/serverSession', () => ({
  getCurrentServerSession: vi.fn(),
  verifyServerToken: vi.fn(),
}))

vi.mock('@/config/rbac', () => ({
  canPerformAction: vi.fn(() => true),
  ACTIONS: { CONTACTS_READ: 'contacts:read' },
}))

import { GET } from './analytics/route'
import { getContactsMetrics } from '@/modules/contacts/services/contactService'
import { getCurrentServerSession } from '@/services/auth/serverSession'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentServerSession).mockResolvedValue({ id: 'user1', email: 'admin@test.com', role: 'admin' })
})

describe('GET /api/contacts/analytics', () => {
  it('returns metrics', async () => {
    vi.mocked(getContactsMetrics).mockResolvedValue({ total: 100, company: 60, individual: 40 })

    const request = new NextRequest('http://localhost/api/contacts/analytics')
    const response = await GET(request) as NextResponse
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.total).toBe(100)
    expect(body.company).toBe(60)
    expect(body.individual).toBe(40)
  })
})
