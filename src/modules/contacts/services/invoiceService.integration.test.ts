import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getInvoicesByContact } from './invoiceService'

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
  serverQuery.result = { data: null, count: 0, error: null }
})

describe('getInvoicesByContact', () => {
  it('returns invoices for a contact', async () => {
    serverQuery.result = {
      data: [
        { id: 'inv1', contact_id: 'c1', invoice_number: 'INV-001', amount: 500, status: 'paid', issue_date: '2024-01-01', due_date: '2024-02-01', paid_at: '2024-01-15', notes: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-15T00:00:00Z' },
      ],
      count: 1,
      error: null,
    }

    const result = await getInvoicesByContact('c1')
    expect(result).toHaveLength(1)
    expect(result[0].invoiceNumber).toBe('INV-001')
    expect(result[0].amount).toBe(500)
  })

  it('returns empty array when no invoices exist', async () => {
    serverQuery.result = { data: [], count: 0, error: null }
    const result = await getInvoicesByContact('nonexistent')
    expect(result).toEqual([])
  })

  it('throws on database error', async () => {
    serverQuery.result = { data: null, count: 0, error: { message: 'DB error', code: 'PGRST000' } }
    await expect(getInvoicesByContact('c1')).rejects.toThrow()
  })
})
