import type { Locale } from '@/i18n/config'
import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import type { Booking } from '../types'

type ExportLabels = Record<
  'guestName' | 'roomNumber' | 'checkIn' | 'checkOut' | 'status' | 'totalAmount' | 'paidAmount' | 'title',
  string
>

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

export async function exportBookingsPdf(
  bookings: Booking[],
  labels: ExportLabels,
  locale: Locale,
  fileName: string,
): Promise<void> {
  const rows = bookings.map((booking) => [
    booking.guestName,
    booking.roomNumber,
    formatDate(booking.checkIn),
    formatDate(booking.checkOut),
    booking.status,
    String(booking.totalAmount),
    String(booking.paidAmount),
  ])

  await buildAndDownloadPdf({
    title: labels.title,
    headers: [labels.guestName, labels.roomNumber, labels.checkIn, labels.checkOut, labels.status, labels.totalAmount, labels.paidAmount],
    rows,
    locale,
    fileName,
  })
}
