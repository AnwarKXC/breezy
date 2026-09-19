import { describe, it, expect } from 'vitest'
import { mapContactRow, toContactRow } from './contactService'
import type { ContactRow } from './contactService'
import type { CreateContactInput, UpdateContactInput } from '../types'

describe('mapContactRow', () => {
  it('maps a full row to a Contact object', () => {
    const row: ContactRow = {
      id: '123',
      type: 'company',
      name: 'Acme Corp',
      phone: '+1234567890',
      email: 'info@acme.com',
      logo: 'https://example.com/logo.png',
      country: 'US',
      city: 'New York',
      responsible_person: 'John Doe',
      id_passport: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }
    const result = mapContactRow(row)
    expect(result).toEqual({
      id: '123',
      type: 'company',
      name: 'Acme Corp',
      phone: '+1234567890',
      email: 'info@acme.com',
      logo: 'https://example.com/logo.png',
      country: 'US',
      city: 'New York',
      responsiblePerson: 'John Doe',
      idPassport: undefined,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    })
  })

  it('handles null fields gracefully', () => {
    const row: ContactRow = {
      id: '456',
      type: 'individual',
      name: 'Jane Smith',
      phone: '+9876543210',
      email: null,
      logo: null,
      country: null,
      city: null,
      responsible_person: null,
      id_passport: 'PP123456',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-02T00:00:00Z',
    }
    const result = mapContactRow(row)
    expect(result.email).toBeUndefined()
    expect(result.logo).toBeUndefined()
    expect(result.country).toBeUndefined()
    expect(result.city).toBeUndefined()
    expect(result.responsiblePerson).toBeUndefined()
    expect(result.idPassport).toBe('PP123456') // non-null field
  })
})

describe('toContactRow', () => {
  it('converts a CreateContactInput (company) to a DB row', () => {
    const input: CreateContactInput = {
      type: 'company',
      name: 'Acme Corp',
      phone: '+1234567890',
      email: 'info@acme.com',
      logo: 'https://example.com/logo.png',
      country: 'US',
      city: 'New York',
      responsiblePerson: 'John Doe',
    }
    const result = toContactRow(input)
    expect(result).toEqual({
      type: 'company',
      name: 'Acme Corp',
      phone: '+1234567890',
      email: 'info@acme.com',
      logo: 'https://example.com/logo.png',
      country: 'US',
      city: 'New York',
      responsible_person: 'John Doe',
    })
  })

  it('converts an UpdateContactInput with partial fields', () => {
    const input: UpdateContactInput = {
      id: '123',
      name: 'New Name',
    }
    const result = toContactRow(input)
    expect(result).toEqual({
      name: 'New Name',
    })
    expect(result).not.toHaveProperty('type')
    expect(result).not.toHaveProperty('phone')
  })

  it('sets email to null when empty string', () => {
    const input: CreateContactInput = {
      type: 'individual',
      name: 'Test',
      phone: '+1234567890',
      email: '',
      idPassport: 'AB123',
    }
    const result = toContactRow(input)
    expect(result.email).toBeNull()
  })

  it('omits fields not present in UpdateContactInput', () => {
    const input: UpdateContactInput = { id: '123' }
    const result = toContactRow(input)
    expect(Object.keys(result).length).toBe(0)
  })
})
