'use client'

import { BookingsSection } from './BookingsSection'
import type { Booking } from '@/modules/bookings/types'

interface ContactBookingListProps {
 bookings: Booking[]
  labels: Record<string, string>; onExportCsv: () => void
 onExportPdf: () => void
 onBook: () => void
  onDeleteBookings: (bookingIds: string[], firstBookingId: string) => Promise<void>; onPrintInvoice: (firstBookingId: string) => void
}

export function ContactBookingList({
 bookings,
 labels,
 onExportCsv,
 onExportPdf,
 onBook,
 onDeleteBookings,
 onPrintInvoice,
}: ContactBookingListProps) {
 return (
 <BookingsSection
 bookings={bookings}
 labels={labels}
 onExportCsv={onExportCsv}
 onExportPdf={onExportPdf}
 onBook={onBook}
 onDeleteBookings={onDeleteBookings}
 onPrintInvoice={onPrintInvoice}
 /> )
}
