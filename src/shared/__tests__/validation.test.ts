import { describe, it, expect } from 'vitest'
import {
  ReservationCreateSchema,
  ReservationCreateWithRoomsSchema,
  ReservationRoomPriceOverrideSchema,
  RoomCreateSchema,
  zodErrorMessage,
} from '@/shared/validation'

describe('ReservationCreateSchema', () => {
  it('accepts valid minimal input', () => {
    const result = ReservationCreateSchema.safeParse({
      check_in_date: '2026-08-01',
      check_out_date: '2026-08-05',
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with all optional fields', () => {
    const result = ReservationCreateSchema.safeParse({
      booker_name: 'John Doe',
      booker_email: 'john@example.com',
      booker_phone: '+1234567890',
      check_in_date: '2026-08-01',
      check_out_date: '2026-08-05',
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      room_count: 2,
      occupancy_adults: 2,
      occupancy_children: 1,
      source: 'direct',
      notes: 'Some notes',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing check_in_date', () => {
    const result = ReservationCreateSchema.safeParse({
      check_out_date: '2026-08-05',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = zodErrorMessage(result.error)
      expect(msgs).toContain('check_in_date')
    }
  })

  it('rejects missing check_out_date', () => {
    const result = ReservationCreateSchema.safeParse({
      check_in_date: '2026-08-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = ReservationCreateSchema.safeParse({
      check_in_date: '01-08-2026',
      check_out_date: '2026-08-05',
    })
    expect(result.success).toBe(false)
  })

  it('applies defaults for occupancy_adults and occupancy_children', () => {
    const result = ReservationCreateSchema.parse({
      check_in_date: '2026-08-01',
      check_out_date: '2026-08-05',
    })
    expect(result.occupancy_adults).toBe(1)
    expect(result.occupancy_children).toBe(0)
  })

  it('rejects negative room_count', () => {
    const result = ReservationCreateSchema.safeParse({
      check_in_date: '2026-08-01',
      check_out_date: '2026-08-05',
      room_count: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = ReservationCreateSchema.safeParse({
      check_in_date: '2026-08-01',
      check_out_date: '2026-08-05',
      booker_email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })
})

describe('RoomCreateSchema', () => {
  it('accepts valid minimal input', () => {
    const result = RoomCreateSchema.safeParse({
      number: '101',
      floor: 1,
      room_type_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with all optional fields', () => {
    const result = RoomCreateSchema.safeParse({
      number: '101',
      floor: 1,
      room_type_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'available',
      price: 150,
      capacity: 2,
      amenities: { wifi: true, tv: true },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty room number', () => {
    const result = RoomCreateSchema.safeParse({
      number: '',
      floor: 1,
      room_type_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid room_type_id', () => {
    const result = RoomCreateSchema.safeParse({
      number: '101',
      floor: 1,
      room_type_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status enum', () => {
    const result = RoomCreateSchema.safeParse({
      number: '101',
      floor: 1,
      room_type_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'nonexistent',
    })
    expect(result.success).toBe(false)
  })
})

describe('zodErrorMessage', () => {
  it('formats a single issue without path', () => {
    const result = ReservationCreateSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = zodErrorMessage(result.error)
      expect(msg).toBeTruthy()
      expect(typeof msg).toBe('string')
    }
  })

  it('formats issues with path', () => {
    const result = ReservationCreateSchema.safeParse({
      check_in_date: 'invalid',
      check_out_date: 'also-invalid',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = zodErrorMessage(result.error)
      expect(msg).toContain('check_in_date')
      expect(msg).toContain('check_out_date')
      expect(msg).toContain(';')
    }
  })
})

describe('ReservationCreateWithRoomsSchema overrides', () => {
  const base = {
    guestName: 'John Doe',
    checkIn: '2026-09-01',
    checkOut: '2026-09-03',
    roomTypeCounts: [
      { roomTypeId: '550e8400-e29b-41d4-a716-446655440000', count: 3, occupancyCode: 'S' as const },
    ],
  }

  it('accepts and preserves a valid overrideRatePerNight', () => {
    const result = ReservationCreateWithRoomsSchema.safeParse({
      ...base,
      roomTypeCounts: [{ ...base.roomTypeCounts[0], overrideRatePerNight: 2000 }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.roomTypeCounts[0]).toMatchObject({
        roomTypeId: base.roomTypeCounts[0].roomTypeId,
        count: 3,
        occupancyCode: 'S',
        overrideRatePerNight: 2000,
      })
    }
  })

  it('defaults missing overrideRatePerNight to null after transform', () => {
    const result = ReservationCreateWithRoomsSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.roomTypeCounts[0].overrideRatePerNight).toBeNull()
    }
  })

  it('accepts an explicit null overrideRatePerNight (client sends null when no override)', () => {
    const result = ReservationCreateWithRoomsSchema.safeParse({
      ...base,
      roomTypeCounts: [{ ...base.roomTypeCounts[0], overrideRatePerNight: null }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.roomTypeCounts[0].overrideRatePerNight).toBeNull()
    }
  })

  it('accepts zero as a valid override (free room)', () => {
    const result = ReservationCreateWithRoomsSchema.safeParse({
      ...base,
      roomTypeCounts: [{ ...base.roomTypeCounts[0], overrideRatePerNight: 0 }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.roomTypeCounts[0].overrideRatePerNight).toBe(0)
    }
  })

  it('rejects negative and oversized overrides', () => {
    for (const bad of [-5, 10_000_001]) {
      const result = ReservationCreateWithRoomsSchema.safeParse({
        ...base,
        roomTypeCounts: [{ ...base.roomTypeCounts[0], overrideRatePerNight: bad }],
      })
      expect(result.success).toBe(false)
    }
  })
})

describe('ReservationRoomPriceOverrideSchema', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts a set operation', () => {
    const result = ReservationRoomPriceOverrideSchema.safeParse({
      reservationRoomId: uuid,
      ratePerNight: 2000,
      reason: 'VIP upgrade',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null ratePerNight as reset', () => {
    const result = ReservationRoomPriceOverrideSchema.safeParse({ reservationRoomId: uuid, ratePerNight: null })
    expect(result.success).toBe(true)
  })

  it('accepts zero ratePerNight (free room)', () => {
    expect(ReservationRoomPriceOverrideSchema.safeParse({ reservationRoomId: uuid, ratePerNight: 0 }).success).toBe(true)
  })

  it('rejects invalid uuid, negative rate, long reason', () => {
    expect(ReservationRoomPriceOverrideSchema.safeParse({ reservationRoomId: 'nope', ratePerNight: 100 }).success).toBe(false)
    expect(ReservationRoomPriceOverrideSchema.safeParse({ reservationRoomId: uuid, ratePerNight: -5 }).success).toBe(false)
    expect(ReservationRoomPriceOverrideSchema.safeParse({ reservationRoomId: uuid, ratePerNight: 100, reason: 'x'.repeat(501) }).success).toBe(false)
  })
})
