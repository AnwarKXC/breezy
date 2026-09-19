import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContactForm } from './useContactForm'
import type { Contact } from '../types'

vi.mock('../services/contactsApiClient', () => ({
  createContact: vi.fn(),
  updateContact: vi.fn(),
}))

import { createContact, updateContact } from '../services/contactsApiClient'

const mockContact: Contact = {
  id: '1', type: 'company', name: 'Test Corp', phone: '+1234567890',
  email: 'test@corp.com', country: 'US', city: 'NY',
  responsiblePerson: 'John', createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useContactForm', () => {
  it('openCreateForm sets mode to create', () => {
    const triggerMutation = vi.fn()
    const { result } = renderHook(() => useContactForm({ triggerMutation }))

    act(() => {
      result.current.openCreateForm()
    })

    expect(result.current.mode).toBe('create')
    expect(result.current.open).toBe(true)
  })

  it('openEditForm populates draft from contact', () => {
    const triggerMutation = vi.fn()
    const { result } = renderHook(() => useContactForm({ triggerMutation }))

    act(() => {
      result.current.openEditForm(mockContact)
    })

    expect(result.current.mode).toBe('edit')
    expect(result.current.open).toBe(true)
    expect(result.current.draft.name).toBe('Test Corp')
    expect(result.current.draft.id).toBe('1')
  })

  it('submitForm calls createContact on create mode', async () => {
    vi.mocked(createContact).mockResolvedValue(mockContact)
    const triggerMutation = vi.fn()
    const { result } = renderHook(() => useContactForm({ triggerMutation }))

    act(() => {
      result.current.openCreateForm()
      result.current.updateDraft('type', 'individual')
      result.current.updateDraft('name', 'Jane')
      result.current.updateDraft('phone', '+1111111111')
      result.current.updateDraft('email', 'jane@test.com')
      result.current.updateDraft('idPassport', 'PP123')
    })

    await act(async () => {
      await result.current.submitForm()
    })

    expect(createContact).toHaveBeenCalled()
    expect(triggerMutation).toHaveBeenCalled()
  })

  it('submitForm calls updateContact on edit mode', async () => {
    vi.mocked(updateContact).mockResolvedValue(mockContact)
    const triggerMutation = vi.fn()
    const { result } = renderHook(() => useContactForm({ triggerMutation }))

    act(() => {
      result.current.openEditForm(mockContact)
    })

    await act(async () => {
      await result.current.submitForm()
    })

    expect(updateContact).toHaveBeenCalled()
    expect(triggerMutation).toHaveBeenCalled()
  })
})
