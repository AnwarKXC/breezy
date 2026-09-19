import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayDetailPopover } from './DayDetailPopover'
import type { DayBooking } from '../utils/dayMap'

const roomNumberById = new Map([
  ['r1', '101'],
  ['r2', '204'],
  ['r3', '305'],
])

const bookings: DayBooking[] = [
  { roomId: 'r3', status: 'confirmed', code: 'RSV-C', guestName: 'Omar Diab', from: '2026-03-17', to: '2026-03-22', source: 'booking', reservationId: 'res-c', companyName: null },
  { roomId: 'r1', status: 'checked_in', code: 'RSV-A', guestName: 'John Smith', from: '2026-03-14', to: '2026-03-19', source: 'direct', reservationId: 'res-a', companyName: null },
  { roomId: 'r2', status: 'checked_out', code: 'RSV-D', guestName: null, companyName: 'Acme Corp', reservationId: 'res-co', from: '2026-03-17', to: '2026-03-18', source: 'direct' },
]

const labels = {
  confirmed: 'Confirmed',
  checkedIn: 'In-house',
  checkedOut: 'Checked-out',
  other: 'Other',
  ofRoomsOccupied: '{count} of {total} rooms occupied',
}

describe('DayDetailPopover', () => {
  it('renders a dialog with the long date and room count line', () => {
    render(
      <DayDetailPopover dateIso="2026-03-17" bookings={bookings} roomNumberById={roomNumberById} totalRooms={45} locale="en" labels={labels} />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/17.*March|March.*17/)).toBeInTheDocument()
    expect(screen.getByText(/3 of 45 rooms occupied/)).toBeInTheDocument()
  })

  it('lists bookings sorted by room number with dot, room, guest, code, status, dates', () => {
    render(
      <DayDetailPopover dateIso="2026-03-17" bookings={bookings} roomNumberById={roomNumberById} totalRooms={45} locale="en" labels={labels} />,
    )
    const rows = screen.getAllByText(/Room \d+/)
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toContain('101')
    expect(rows[0].textContent).toContain('John Smith')
    expect(rows[1].textContent).toContain('204')
    expect(rows[1].textContent).toContain('Acme Corp')
    expect(rows[2].textContent).toContain('305')
    expect(screen.getByText(/RSV-A · In-house · 2026-03-14 → 2026-03-19/)).toBeInTheDocument()
    expect(screen.getByText(/RSV-C · Confirmed · 2026-03-17 → 2026-03-22/)).toBeInTheDocument()
  })

  it('renders the display name as a link to the reservation page', () => {
    render(
      <DayDetailPopover dateIso="2026-03-17" bookings={bookings} roomNumberById={roomNumberById} totalRooms={45} locale="en" labels={labels} />,
    )
    const link = screen.getByText('Omar Diab').closest('a')
    expect(link).toHaveAttribute('href', '/en/reservations/res-c')
    const companyLink = screen.getByText('Acme Corp').closest('a')
    expect(companyLink).toHaveAttribute('href', '/en/reservations/res-co')
  })

  it('renders an em dash for missing guest names', () => {
    render(
      <DayDetailPopover
        dateIso="2026-03-17"
        bookings={[{ roomId: 'r2', status: 'checked_out', code: 'RSV-B', guestName: null, from: '2026-03-16', to: '2026-03-17', source: 'walk_in', reservationId: 'res-b', companyName: null }]}
        roomNumberById={roomNumberById}
        totalRooms={45}
        locale="en"
        labels={labels}
      />,
    )
    const row = screen.getByText(/Room 204/)
    expect(row.textContent).toContain('Room 204 · —')
  })

  it('labels unknown statuses as Other with an amber dot', () => {
    render(
      <DayDetailPopover
        dateIso="2026-03-17"
        bookings={[{ roomId: 'r2', status: 'held', code: 'RSV-H', guestName: 'Held Guest', from: '2026-03-17', to: '2026-03-18', source: 'direct', reservationId: 'res-h', companyName: null }]}
        roomNumberById={roomNumberById}
        totalRooms={45}
        locale="en"
        labels={labels}
      />,
    )
    expect(screen.getByText(/RSV-H · Other · 2026-03-17 → 2026-03-18/)).toBeInTheDocument()
    expect(document.querySelector('[style*="F59E0B"]')).toBeInTheDocument()
  })
})
