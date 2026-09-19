import { describe, expect, it } from 'vitest'

import {
  PaginationCursorError,
  decodeCursor,
  encodeCursor,
  getPageLimit,
  requireNumberCursorValue,
  requireStringCursorValue,
  requireTimestampCursorValue,
} from './cursor'

describe('pagination cursors', () => {
  it('round-trips an encoded cursor', () => {
    const cursor = encodeCursor({ id: 'doc-1', value: { nanoseconds: 123, seconds: 456 } })

    expect(decodeCursor(cursor)).toEqual({
      id: 'doc-1',
      value: { nanoseconds: 123, seconds: 456 },
    })
  })

  it('rejects invalid cursor text', () => {
    expect(() => decodeCursor('not-a-json-cursor')).toThrow(PaginationCursorError)
  })

  it('rejects missing cursor fields', () => {
    const cursor = Buffer.from(JSON.stringify({ id: 'doc-1' }), 'utf8').toString('base64url')

    expect(() => decodeCursor(cursor)).toThrow(PaginationCursorError)
  })

  it('validates cursor value kinds', () => {
    expect(requireTimestampCursorValue({ nanoseconds: 1, seconds: 2 })).toEqual({
      nanoseconds: 1,
      seconds: 2,
    })
    expect(requireNumberCursorValue(123)).toBe(123)
    expect(requireStringCursorValue('abc')).toBe('abc')
    expect(() => requireNumberCursorValue('abc')).toThrow(PaginationCursorError)
  })
})

describe('pagination limits', () => {
  it('uses defaults and clamps max values', () => {
    expect(getPageLimit(undefined, 20, 50)).toBe(20)
    expect(getPageLimit(25, 20, 50)).toBe(25)
    expect(getPageLimit(500, 20, 50)).toBe(50)
  })

  it('rejects invalid limit values', () => {
    expect(() => getPageLimit(0, 20, 50)).toThrow('pagination/invalid_limit')
    expect(() => getPageLimit(1.5, 20, 50)).toThrow('pagination/invalid_limit')
  })
})
