import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/modules/contacts/services/contactService', () => ({
  getContactById: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}))

vi.mock('@/services/auth/serverSession', () => ({
  getCurrentServerSession: vi.fn(),
  verifyServerToken: vi.fn(),
}))

vi.mock('@/config/rbac', () => ({
  canPerformAction: vi.fn(() => true),
  ACTIONS: {
    CONTACTS_READ: 'contacts:read',
    CONTACTS_UPDATE: 'contacts:update',
    CONTACTS_DELETE: 'contacts:delete',
  },
}))

vi.mock('@/shared/csrf', () => ({
  validateCsrf: vi.fn(() => ({ error: undefined })),
}))

import { GET, PATCH, DELETE } from './[id]/route'
import { getContactById, updateContact, deleteContact } from '@/modules/contacts/services/contactService'
import { getCurrentServerSession } from '@/services/auth/serverSession'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentServerSession).mockResolvedValue({ id: 'user1', email: 'admin@test.com', role: 'admin' })
})

function makeRequest(method = 'GET', body?: unknown): NextRequest {
  const url = 'http://localhost/api/contacts/1'
  const init: RequestInit = { method }
  if (body) init.body = JSON.stringify(body)
  // @ts-expect-error - Next.js RequestInit differs from DOM RequestInit (AbortSignal | null vs undefined)
  return new NextRequest(url, init)
}

const context = { params: Promise.resolve({ id: '1' }) }

describe('GET /api/contacts/[id]', () => {
  it('returns a contact by id', async () => {
    vi.mocked(getContactById).mockResolvedValue({
      id: '1', type: 'company', name: 'Acme', phone: '+1', email: undefined, createdAt: '', updatedAt: '',
    })

    const response = await GET(makeRequest(), context) as NextResponse
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data.name).toBe('Acme')
  })

  it('returns 404 when not found', async () => {
    vi.mocked(getContactById).mockResolvedValue(null)

    const response = await GET(makeRequest(), context) as NextResponse
    expect(response.status).toBe(404)
  })
})

describe('PATCH /api/contacts/[id]', () => {
  it('updates a contact', async () => {
    vi.mocked(updateContact).mockResolvedValue({
      id: '1', type: 'company', name: 'Updated', phone: '+1', email: undefined, createdAt: '', updatedAt: '',
    })

    const response = await PATCH(makeRequest('PATCH', { name: 'Updated' }), context) as NextResponse
    expect(response.status).toBe(200)
  })
})

describe('DELETE /api/contacts/[id]', () => {
  it('deletes a contact', async () => {
    const response = await DELETE(makeRequest('DELETE'), context) as NextResponse
    expect(response.status).toBe(200)
  })
})
