import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildDayMap, indexByRoomAndDate } from '../utils/dayMap'
import type { YearOverviewStay } from '../types'
import { SheetView } from './SheetView'

const roomTypes = [
  { id: 't1', name: 'Double' },
  { id: 't2', name: 'Suite' },
]
const rooms = [
  { id: 'r1', number: '101', typeId: 't1' },
  { id: 'r2', number: '201', typeId: 't2' },
]
const stays: YearOverviewStay[] = [
  { roomId: 'r1', reservationId: 'a', code: 'RSV-A', status: 'confirmed', from: '2026-03-02', to: '2026-03-04', guestName: 'John Doe', source: 'booking', companyName: null },
  { roomId: 'r2', reservationId: 'b', code: 'RSV-B', status: 'checked_in', from: '2026-03-03', to: '2026-03-06', guestName: 'Sara Ali', source: 'go', companyName: null },
]

function renderSheet(overrides: Record<string, unknown> = {}) {
  return render(
    <SheetView
      year={2026}
      monthIndex={2}
      locale="en"
      rooms={rooms}
      roomTypes={roomTypes}
      bookingIndex={indexByRoomAndDate(buildDayMap(stays, 2026))}
      todayIso=""
      {...overrides}
    />,
  )
}

describe('SheetView', () => {
  it('groups room columns under type headers in order', () => {
    renderSheet()
    expect(screen.getByRole('columnheader', { name: 'Double' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Suite' })).toBeInTheDocument()
    const numbers = screen.getAllByText(/^(101|201)$/)
    expect(numbers[0].textContent).toBe('101')
    expect(numbers[1].textContent).toBe('201')
  })

  it('renders date labels in D-M-YYYY format', () => {
    renderSheet()
    expect(screen.getByText('1-3-2026')).toBeInTheDocument()
    expect(screen.getByText('31-3-2026')).toBeInTheDocument()
  })

  it('fills occupied cells with guest and type lines only (no source)', () => {
    renderSheet()
    const block = screen.getAllByText('John Doe')[0].closest('div[title]')!
    expect(block.textContent).toContain('Double')
    expect(block.textContent).not.toContain('booking')
    expect(screen.getAllByText('Sara Ali').length).toBeGreaterThan(0)
    expect(screen.queryByText('go')).not.toBeInTheDocument()
  })

  it('renders the guest line as a link to the reservation page', () => {
    renderSheet()
    const link = screen.getAllByText('John Doe')[0].closest('a')
    expect(link).toHaveAttribute('href', '/en/reservations/a')
  })

  it('leaves vacant cells empty', () => {
    renderSheet()
    const row = screen.getByText('6-3-2026').closest('tr')!
    expect(row.querySelectorAll('div[title]')).toHaveLength(0)
  })

  it('highlights weekend rows and the today date cell', () => {
    renderSheet({ todayIso: '2026-03-01' })
    expect(screen.getByText('6-3-2026').closest('tr')!.className).toContain('bg-amber-50')
    expect(screen.getByText('1-3-2026').className).toContain('bg-amber-100')
  })
})
