import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContactsView } from './useContactsView'
import type { Contact } from '../types'

vi.mock('../services/contactsApiClient', () => ({
  fetchContacts: vi.fn(),
  fetchContactsMetrics: vi.fn(),
  deleteContact: vi.fn(),
}))

import { fetchContacts, fetchContactsMetrics, deleteContact } from '../services/contactsApiClient'

const mockContact: Contact = {
  id: '1', type: 'company', name: 'Test', phone: '+1',
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchContacts).mockResolvedValue({
    data: [mockContact],
    hasMore: false,
    total: 1,
    nextCursor: null,
  })
  vi.mocked(fetchContactsMetrics).mockResolvedValue({ total: 1, company: 1, individual: 0 })
})

describe('useContactsView', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useContactsView())
    expect(result.current.loading).toBe(true)
    expect(result.current.contacts).toEqual([])
    expect(result.current.page).toBe(1)
  })

  it('fetches contacts on mount', async () => {
    const { result } = renderHook(() => useContactsView())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.contacts).toHaveLength(1)
    expect(result.current.contacts[0].name).toBe('Test')
  })

  it('setQuery resets pagination', async () => {
    const { result } = renderHook(() => useContactsView())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setQuery('Acme')
    })
    expect(result.current.page).toBe(1)
    expect(result.current.query).toBe('Acme')
  })

  it('nextPage updates page when hasMore is true', async () => {
    vi.mocked(fetchContacts).mockResolvedValue({
      data: [mockContact],
      hasMore: true,
      total: 5,
      nextCursor: 'next-cursor',
    })

    const { result } = renderHook(() => useContactsView())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.canNext).toBe(true)

    act(() => {
      result.current.nextPage()
    })
    expect(result.current.page).toBe(2)
  })

  it('previousPage decrements page', async () => {
    vi.mocked(fetchContacts).mockResolvedValue({
      data: [mockContact],
      hasMore: true,
      total: 5,
      nextCursor: 'next-cursor',
    })

    const { result } = renderHook(() => useContactsView())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.nextPage())
    expect(result.current.page).toBe(2)

    act(() => {
      result.current.previousPage()
    })
    expect(result.current.page).toBe(1)
  })
})
