import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildDayMap } from '../utils/dayMap'
import type { YearOverviewStay } from '../types'
import { MonthCalendarCard } from './MonthCalendarCard'

const stays: YearOverviewStay[] = [
  { roomId: 'r1', reservationId: 'a', code: 'RSV-A', status: 'confirmed', from: '2026-03-02', to: '2026-03-04', guestName: 'John Doe', source: 'booking', companyName: null },
  { roomId: 'r2', reservationId: 'b', code: 'RSV-B', status: 'checked_in', from: '2026-03-03', to: '2026-03-06', guestName: 'Sara Ali', source: 'direct', companyName: null },
]

function renderCard(overrides: Record<string, unknown> = {}) {
  const props = {
    year: 2026,
    monthIndex: 2,
    locale: 'en',
    bookingsByDate: buildDayMap(stays, 2026),
    todayIso: '',
    activeDate: null,
    stats: { stays: 2, roomNights: 5 },
    onDayEnter: vi.fn(),
    onDayLeave: vi.fn(),
    onDayClick: vi.fn(),
    ...overrides,
  }
  return render(<MonthCalendarCard {...props} />)
}

describe('MonthCalendarCard', () => {
  it('places day 1 after 6 leading pads in March 2026 (Monday start)', () => {
    renderCard()
    const cells = document.querySelectorAll('[data-cells] > *')
    expect(cells).toHaveLength(42)
    expect(cells[5].getAttribute('data-day')).toBeNull()
    expect(cells[6].getAttribute('data-day')).toBe('2026-03-01')
  })

  it('tints booked days by strongest status and renders one dot per booking', () => {
    renderCard()
    const mar3 = document.querySelector('[data-day="2026-03-03"]')!
    expect(mar3.className).toContain('bg-emerald-50')
    expect(mar3.querySelectorAll('.rounded-full')).toHaveLength(2)
    const mar2 = document.querySelector('[data-day="2026-03-02"]')!
    expect(mar2.className).toContain('bg-blue-50')
  })

  it('shows unknown statuses with amber tint and dot', () => {
    const held: YearOverviewStay[] = [
      { roomId: 'r1', reservationId: 'h1', code: 'RSV-H', status: 'held', from: '2026-03-20', to: '2026-03-21', guestName: null, source: 'direct', companyName: null },
    ]
    renderCard({ bookingsByDate: buildDayMap(held, 2026) })
    const mar20 = document.querySelector('[data-day="2026-03-20"]')!
    expect(mar20.className).toContain('bg-amber-50')
    expect(mar20.querySelector('.rounded-full')!.className).toContain('bg-amber-500')
  })

  it('caps dots at six with an overflow label', () => {
    const many: YearOverviewStay[] = Array.from({ length: 8 }, (_, i) => ({
      roomId: `r${i}`,
      reservationId: `x${i}`,
      code: `RSV-${i}`,
      status: 'confirmed' as const,
      from: '2026-03-10',
      to: '2026-03-11',
      guestName: null,
      source: 'booking',
      companyName: null,
    }))
    renderCard({ bookingsByDate: buildDayMap(many, 2026) })
    const cell = document.querySelector('[data-day="2026-03-10"]')!
    expect(cell.querySelectorAll('.rounded-full')).toHaveLength(6)
    expect(cell.textContent).toContain('+2')
  })

  it('marks today with a ring and shades unbooked Fridays', () => {
    renderCard({ todayIso: '2026-03-15' })
    expect(document.querySelector('[data-day="2026-03-15"]')!.className).toContain('ring-2')
    expect(document.querySelector('[data-day="2026-03-06"]')!.className).toContain('bg-[#FAFAF9]')
  })

  it('reports clicks with the cell rect and stops propagation', async () => {
    const onDayClick = vi.fn()
    const user = userEvent.setup()
    renderCard({ onDayClick })
    await user.click(screen.getByLabelText('1 March 2026 — 0 bookings'))
    expect(onDayClick).toHaveBeenCalledWith('2026-03-01', expect.objectContaining({ width: expect.any(Number) }))
  })
})
