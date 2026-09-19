import { describe, it, expect } from 'vitest'
import {
  getActorLabel,
  getTargetLabel,
  getActionLabel,
  getModuleLabel,
  getLogDescription,
  formatLogDate,
} from '../logDisplay'
import type { LogEntry } from '../../types'

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log1',
    action: 'login',
    module: 'auth',
    actor: { id: 'u1', name: 'John', displayName: 'John Doe' },
    target: { id: 't1' },
    createdAt: { seconds: 1705312200, nanoseconds: 0 },
    description: '',
    ...overrides,
  }
}

describe('getActionLabel', () => {
  it('returns correct label for known action', () => {
    expect(getActionLabel('login')).toBe('Login')
    expect(getActionLabel('reservation_checked_in')).toBe('Checked In Reservation')
    expect(getActionLabel('user_created')).toBe('Created User')
  })

  it('falls back to underscore-to-space for unknown action', () => {
    expect(getActionLabel('custom_action' as never)).toBe('custom action')
  })
})

describe('getModuleLabel', () => {
  it('returns correct label for known module', () => {
    expect(getModuleLabel('accounting')).toBe('Accounting')
    expect(getModuleLabel('reservations')).toBe('Reservations')
    expect(getModuleLabel('users')).toBe('Users')
  })

  it('falls back to raw string for unknown module', () => {
    expect(getModuleLabel('custom' as never)).toBe('custom')
  })
})

describe('getActorLabel', () => {
  it('prefers displayName over name over id', () => {
    expect(getActorLabel(makeLog())).toBe('John Doe')
    expect(getActorLabel(makeLog({ actor: { id: 'u1', name: 'John', displayName: undefined } }))).toBe('John')
    expect(getActorLabel(makeLog({ actor: { id: 'u1', name: undefined, displayName: undefined } }))).toBe('u1')
  })

  it('returns dash when all actor fields missing', () => {
    expect(getActorLabel(makeLog({ actor: undefined }))).toBe('-')
  })
})

describe('getTargetLabel', () => {
  it('returns target id', () => {
    expect(getTargetLabel(makeLog())).toBe('t1')
  })

  it('returns dash when target is undefined', () => {
    expect(getTargetLabel(makeLog({ target: undefined }))).toBe('-')
  })
})

describe('getLogDescription', () => {
  it('uses description lookup map for known keys', () => {
    expect(getLogDescription(makeLog({ description: 'logs.auth.login' }))).toBe('User signed in')
    expect(getLogDescription(makeLog({ description: 'logs.users.created' }))).toBe('User created')
  })

  it('falls back to composed string for unknown description', () => {
    expect(getLogDescription(makeLog({ description: 'custom.description' }))).toBe('custom.description')
  })

  it('builds actor action target string when no description', () => {
    const log = makeLog({ description: undefined, action: 'login', actor: { id: 'u1', name: 'John', displayName: 'John Doe' }, target: { id: 't1' } })
    expect(getLogDescription(log)).toBe('John Doe login t1')
  })
})

describe('formatLogDate', () => {
  it('returns formatted date for valid timestamp', () => {
    const result = formatLogDate({ seconds: 1705312200, nanoseconds: 0 })
    expect(result).not.toBe('-')
    expect(result).toBeTruthy()
  })

  it('returns dash for null input', () => {
    expect(formatLogDate(null)).toBe('-')
  })

  it('returns dash for undefined input', () => {
    expect(formatLogDate(undefined)).toBe('-')
  })

  it('returns dash for invalid Date', () => {
    expect(formatLogDate(new Date('invalid'))).toBe('-')
  })

  it('handles Date object input', () => {
    const result = formatLogDate(new Date('2024-01-15T10:30:00Z'))
    expect(result).not.toBe('-')
  })
})
