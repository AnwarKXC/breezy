import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/modules/contacts/services/contactService', () => ({
  getContactsPage: vi.fn(),
  createContact: vi.fn(),
}))

vi.mock('@/services/auth/serverSession', () => ({
  getCurrentServerSession: vi.fn(),
  verifyServerToken: vi.fn(),
}))

vi.mock('@/config/rbac', () => ({
  canPerformAction: vi.fn(() => true),
  ACTIONS: { CONTACTS_READ: 'contacts:read', CONTACTS_CREATE: 'contacts:create' },
}))

vi.mock('@/shared/csrf', () => ({
  validateCsrf: vi.fn(() => ({ error: undefined })),
}))

import { GET, POST } from './route'
import { getContactsPage, createContact } from '@/modules/contacts/services/contactService'
import { getCurrentServerSession } from '@/services/auth/serverSession'
import { canPerformAction } from '@/config/rbac'
import { validateCsrf } from '@/shared/csrf'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentServerSession).mockResolvedValue({ id: 'user1', email: 'admin@test.com', role: 'admin' })
})

describe('GET /api/contacts', () => {
  it('returns paginated contacts list', async () => {
    vi.mocked(getContactsPage).mockResolvedValue({
      data: [{ id: '1', type: 'company', name: 'Acme', phone: '+1', email: undefined, createdAt: '', updatedAt: '' }],
      hasMore: false,
      total: 1,
      nextCursor: null,
    })

    const request = new NextRequest('http://localhost/api/contacts')
    const response = await GET(request) as NextResponse
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
  })
})

describe('POST /api/contacts', () => {
  it('creates a contact successfully', async () => {
    vi.mocked(createContact).mockResolvedValue({
      id: 'new-1', type: 'company', name: 'New Corp', phone: '+1', email: undefined, createdAt: '', updatedAt: '',
    })

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({ type: 'company', name: 'New Corp', phone: '+1' }),
    })
    const response = await POST(request) as NextResponse
    expect(response.status).toBe(201)
  })

  it('returns 403 when unauthorized', async () => {
    vi.mocked(canPerformAction).mockReturnValue(false)

    const request = new NextRequest('http://localhost/api/contacts', {
      method: 'POST',
      body: JSON.stringify({ type: 'company', name: 'New Corp', phone: '+1' }),
    })
    const response = await POST(request) as NextResponse
    expect(response.status).toBe(403)
  })
})
