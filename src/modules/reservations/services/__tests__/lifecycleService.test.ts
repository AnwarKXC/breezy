import { describe, it, expect } from 'vitest'
import { canTransition, isTerminalStatus } from '../lifecycleService'

describe('canTransition', () => {
  it.each([
    ['draft', 'held', true],
    ['draft', 'confirmed', true],
    ['draft', 'cancelled', true],
    ['draft', 'checked_in', false],
    ['held', 'confirmed', true],
    ['held', 'expired', true],
    ['held', 'cancelled', true],
    ['held', 'checked_in', false],
    ['confirmed', 'checked_in', true],
    ['confirmed', 'cancelled', true],
    ['confirmed', 'no_show', true],
    ['confirmed', 'checked_out', false],
    ['checked_in', 'checked_out', true],
    ['checked_in', 'cancelled', false],
    ['checked_out', 'checked_in', false],
    ['cancelled', 'draft', false],
    ['no_show', 'checked_in', false],
    ['expired', 'confirmed', false],
  ])('from %s to %s returns %s', (from, to, expected) => {
    expect(canTransition(from as never, to as never)).toBe(expected)
  })
})

describe('isTerminalStatus', () => {
  it.each([
    ['checked_out', true],
    ['cancelled', true],
    ['no_show', true],
    ['expired', true],
    ['draft', false],
    ['held', false],
    ['confirmed', false],
    ['checked_in', false],
  ])('%s returns %s', (status, expected) => {
    expect(isTerminalStatus(status as never)).toBe(expected)
  })
})
