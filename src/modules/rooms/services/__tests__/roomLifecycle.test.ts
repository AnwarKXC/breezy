import { describe, it, expect } from 'vitest'
import { canTransitionRoom, getAllowedTransitions } from '../roomLifecycle'

describe('canTransitionRoom', () => {
  it.each([
    ['available', 'cleaning', true],
    ['available', 'maintenance', true],
    ['available', 'occupied', false],
    ['available', 'dirty', false],
    ['available', 'available', false],
    ['occupied', 'dirty', true],
    ['occupied', 'available', false],
    ['occupied', 'cleaning', false],
    ['occupied', 'maintenance', false],
    ['occupied', 'occupied', false],
    ['maintenance', 'available', true],
    ['maintenance', 'occupied', false],
    ['maintenance', 'cleaning', false],
    ['maintenance', 'dirty', false],
    ['maintenance', 'maintenance', false],
    ['cleaning', 'available', true],
    ['cleaning', 'occupied', false],
    ['cleaning', 'maintenance', false],
    ['cleaning', 'dirty', false],
    ['cleaning', 'cleaning', false],
    ['dirty', 'available', true],
    ['dirty', 'occupied', false],
    ['dirty', 'cleaning', false],
    ['dirty', 'maintenance', false],
    ['dirty', 'dirty', false],
  ])('from %s to %s returns %s', (from, to, expected) => {
    expect(canTransitionRoom(from as never, to as never)).toBe(expected)
  })
})

describe('getAllowedTransitions', () => {
  it('available allows cleaning and maintenance', () => {
    expect(getAllowedTransitions('available')).toEqual(['cleaning', 'maintenance'])
  })

  it('occupied allows dirty only', () => {
    expect(getAllowedTransitions('occupied')).toEqual(['dirty'])
  })

  it('maintenance allows available only', () => {
    expect(getAllowedTransitions('maintenance')).toEqual(['available'])
  })

  it('cleaning allows available only', () => {
    expect(getAllowedTransitions('cleaning')).toEqual(['available'])
  })

  it('dirty allows available only', () => {
    expect(getAllowedTransitions('dirty')).toEqual(['available'])
  })
})
