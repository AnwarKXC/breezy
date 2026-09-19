import { describe, it, expect } from 'vitest'
import { getValidContactDraft } from './contactValidation'
import type { ContactFormDraft } from './contactValidation'

function makeDraft(overrides: Partial<ContactFormDraft> = {}): ContactFormDraft {
  return {
    type: 'company',
    name: 'Acme Corp',
    phone: '+1234567890',
    email: 'info@acme.com',
    country: 'US',
    city: 'New York',
    responsiblePerson: 'John',
    idPassport: '',
    ...overrides,
  }
}

describe('getValidContactDraft', () => {
  it('returns valid draft for a company with all required fields', () => {
    const result = getValidContactDraft(makeDraft())
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.name).toBe('Acme Corp')
      expect(result.data.type).toBe('company')
    }
  })

  it('returns valid draft for an individual with all required fields', () => {
    const result = getValidContactDraft(
      makeDraft({ type: 'individual', idPassport: 'AB123456', country: '', city: '', responsiblePerson: '' }),
    )
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.type).toBe('individual')
      expect(result.data.idPassport).toBe('AB123456')
    }
  })

  it('returns error when name is missing', () => {
    const result = getValidContactDraft(makeDraft({ name: '' }))
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns error when phone is invalid', () => {
    const result = getValidContactDraft(makeDraft({ phone: '12' }))
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns valid draft when company has no country', () => {
    const result = getValidContactDraft(makeDraft({ country: '' }))
    expect('data' in result).toBe(true)
  })

  it('returns valid draft when individual has no idPassport', () => {
    const result = getValidContactDraft(
      makeDraft({ type: 'individual', idPassport: '' }),
    )
    expect('data' in result).toBe(true)
  })

  it('returns error for invalid email on company', () => {
    const result = getValidContactDraft(makeDraft({ email: 'notanemail' }))
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns valid draft when email is missing for individual', () => {
    const result = getValidContactDraft(
      makeDraft({ type: 'individual', idPassport: 'AB123', email: '' }),
    )
    expect('data' in result).toBe(true)
  })

  it('returns valid draft when email is empty for company', () => {
    const result = getValidContactDraft(makeDraft({ email: '' }))
    expect('data' in result).toBe(true)
  })

  it('returns error when all fields are empty', () => {
    const result = getValidContactDraft(makeDraft({
      name: '', phone: '', email: '', country: '', city: '', responsiblePerson: '', idPassport: '',
    }))
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns valid draft when only name is filled', () => {
    const result = getValidContactDraft(makeDraft({
      phone: '', email: '', country: '', city: '', responsiblePerson: '', idPassport: '',
    }))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.name).toBe('Acme Corp')
      expect(result.data.phone).toBeUndefined()
    }
  })
})
