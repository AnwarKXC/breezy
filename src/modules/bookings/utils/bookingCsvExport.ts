import type { Booking } from '../types'

interface ExportLabels {
  guestName: string
  roomNumber: string
  checkIn: string
  checkOut: string
  status: string
  totalAmount: string
  paidAmount: string
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function formatDate(date: Date) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date))
  } catch {
    return String(date)
  }
}

export function buildBookingsCsv(
  bookings: Booking[],
  labels: ExportLabels,
) {
  const header = [
    labels.guestName,
    labels.roomNumber,
    labels.checkIn,
    labels.checkOut,
    labels.status,
    labels.totalAmount,
    labels.paidAmount,
  ]
  const rows = bookings.map((booking) => [
    booking.guestName,
    booking.roomNumber,
    formatDate(booking.checkIn),
    formatDate(booking.checkOut),
    booking.status,
    String(booking.totalAmount),
    String(booking.paidAmount),
  ])

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n')
}
