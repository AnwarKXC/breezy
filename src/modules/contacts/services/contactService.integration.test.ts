import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getContactById, createContact, updateContact, deleteContact, getContactsPage, getContactsMetrics } from './contactService'
import type { ContactRow } from './contactService'

vi.mock('@/services/supabase/server')
vi.mock('@/services/supabase/admin')
vi.mock('./serviceSecurity')
vi.mock('./activityLogService')

// @ts-expect-error - vitest mock redirects to __mocks__/server.ts
import { mockQuery as serverQuery, createThenableQuery } from '@/services/supabase/server'
// @ts-expect-error - vitest mock redirects to __mocks__/admin.ts
import { mockQuery as adminQuery } from '@/services/supabase/admin'

function contactRow(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: '1',
    type: 'company',
    name: 'Test',
    phone: '+1',
    email: null,
    logo: null,
    country: null,
    city: null,
    responsible_person: null,
    id_passport: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset all query builder methods to return-this
  for (const q of [serverQuery, adminQuery]) {
    q.select.mockImplementation(() => q)
    q.eq.mockImplementation(() => q)
    q.in.mockImplementation(() => q)
    q.or.mockImplementation(() => q)
    q.order.mockImplementation(() => q)
    q.limit.mockImplementation(() => q)
    q.gte.mockImplementation(() => q)
    q.single.mockImplementation(() => q)
    q.insert.mockImplementation(() => q)
    q.update.mockImplementation(() => q)
    q.delete.mockImplementation(() => q)
    q.upsert.mockImplementation(() => q)
  }
  // Reset result to default
  serverQuery.result = { data: null, count: 0, error: null }
  adminQuery.result = { data: null, count: 0, error: null }
})

describe('getContactById', () => {
  it('returns a contact when found', async () => {
    vi.mocked(serverQuery.single).mockResolvedValue({
      data: contactRow({ id: '1', name: 'Acme Corp', type: 'company' }),
      error: null,
    })

    const result = await getContactById('1')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Acme Corp')
  })

  it('returns null when not found', async () => {
    const result = await getContactById('nonexistent')
    expect(result).toBeNull()
  })

  it('returns null on error', async () => {
    vi.mocked(serverQuery.single).mockResolvedValue({ data: null, error: { message: 'DB error', details: '', hint: '', code: 'ERROR' } })

    const result = await getContactById('1')
    expect(result).toBeNull()
  })
})

describe('createContact', () => {
  it('creates a contact and logs activity', async () => {
    vi.mocked(adminQuery.single).mockResolvedValue({
      data: contactRow({ id: 'new-1', name: 'New Corp' }),
      error: null,
    })

    const result = await createContact({ type: 'company', name: 'New Corp', phone: '+1111111111' })
    expect(result.name).toBe('New Corp')

    const { logContactCreated } = await import('./activityLogService')
    expect(logContactCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-1', name: 'New Corp' }))
  })
})

describe('updateContact', () => {
  it('updates a contact', async () => {
    vi.mocked(adminQuery.single).mockResolvedValue({
      data: contactRow({ id: '1', name: 'Updated Corp' }),
      error: null,
    })

    const result = await updateContact('1', { id: '1', name: 'Updated Corp' })
    expect(result.name).toBe('Updated Corp')
  })
})

describe('deleteContact', () => {
  it('deletes a contact', async () => {
    vi.mocked(adminQuery.single).mockResolvedValue({
      data: { id: '1', name: 'Acme Corp', type: 'company' },
      error: null,
    })

    await expect(deleteContact('1')).resolves.toBeUndefined()
  })
})

describe('getContactsPage', () => {
  it('returns paginated contacts ordered by creation date', async () => {
    vi.mocked(serverQuery.limit).mockResolvedValue({
      data: [
        contactRow({ id: '1', name: 'A Corp' }),
        contactRow({ id: '2', name: 'B Person', type: 'individual', id_passport: 'PP1' }),
      ],
      count: 2,
      error: null,
    })

    const page = await getContactsPage()
    expect(page.data).toHaveLength(2)
    expect(page.total).toBe(2)
  })

  it('filters by type', async () => {
    vi.mocked(serverQuery.limit).mockResolvedValue({
      data: [contactRow({ id: '1', name: 'A Corp' })],
      count: 1,
      error: null,
    })

    const page = await getContactsPage({ type: 'company' })
    expect(page.data).toHaveLength(1)
    expect(page.data[0].type).toBe('company')
  })

  it('searches by name', async () => {
    vi.mocked(serverQuery.limit).mockResolvedValue({
      data: [contactRow({ id: '1', name: 'Acme Corp' })],
      count: 1,
      error: null,
    })

    const page = await getContactsPage({ search: 'Acme' })
    expect(page.data).toHaveLength(1)
  })

  it('handles cursor-based pagination', async () => {
    vi.mocked(serverQuery.limit).mockResolvedValue({
      data: [contactRow({ id: '2', name: 'B Corp', created_at: '2023-12-01T00:00:00Z' })],
      count: 5,
      error: null,
    })

    const page = await getContactsPage({ cursor: 'eyJpZCI6IjEiLCJ2YWx1ZSI6IjIwMjQtMDEtMDFUMDA6MDA6MDBaIn0' })
    expect(page.data).toHaveLength(1)
  })
})

describe('getContactsMetrics', () => {
  it('returns total, company, and individual counts', async () => {
    vi.mocked(serverQuery.select)
      .mockImplementationOnce(() => {
        const q = createThenableQuery({ count: 10, error: null, data: null })
        return q
      })
      .mockImplementationOnce(() => {
        const q = createThenableQuery({ count: 6, error: null, data: null })
        return q
      })
      .mockImplementationOnce(() => {
        const q = createThenableQuery({ count: 4, error: null, data: null })
        return q
      })

    const metrics = await getContactsMetrics()
    expect(metrics.total).toBe(10)
    expect(metrics.company).toBe(6)
    expect(metrics.individual).toBe(4)
  })
})
