import { describe, it, expect } from 'vitest'
import { getContactErrorDescription } from './contactErrors'

const labels = {
  invalidForm: 'Form is invalid',
  notFound: 'Contact not found',
  requestFailed: 'Request failed',
  permissionDenied: 'Permission denied',
  invalidSession: 'Session expired',
  genericError: 'Something went wrong',
}

describe('getContactErrorDescription', () => {
  it('returns invalidForm label for contacts/invalid_form', () => {
    expect(getContactErrorDescription('contacts/invalid_form', labels)).toBe('Form is invalid')
  })

  it('returns notFound label for contacts/not_found', () => {
    expect(getContactErrorDescription('contacts/not_found', labels)).toBe('Contact not found')
  })

  it('returns requestFailed label for contacts/request_failed', () => {
    expect(getContactErrorDescription('contacts/request_failed', labels)).toBe('Request failed')
  })

  it('returns permissionDenied label for auth/permission_denied', () => {
    expect(getContactErrorDescription('auth/permission_denied', labels)).toBe('Permission denied')
  })

  it('returns invalidSession label for auth/invalid_session', () => {
    expect(getContactErrorDescription('auth/invalid_session', labels)).toBe('Session expired')
  })

  it('returns genericError label for unknown error', () => {
    expect(getContactErrorDescription('unknown/error', labels)).toBe('Something went wrong')
  })

  it('returns genericError label for null error', () => {
    expect(getContactErrorDescription(null, labels)).toBe('Something went wrong')
  })
})
