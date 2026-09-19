'use client'

import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { InvoiceBookingLookup } from '../types'

interface Props {
  booking: InvoiceBookingLookup
}

export function InvoiceWizardBookingSummary({ booking }: Props) {
  const { formatCurrency } = useCurrency()

  return (
    <div className="rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/60 p-3 text-xs text-[#555555]">
      <p className="font-medium text-[#333333]">{booking.guestName}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {booking.roomNumber && <span>Room {booking.roomNumber}</span>}
        <span>{booking.checkIn.slice(0, 10)} → {booking.checkOut.slice(0, 10)}</span>
        {booking.nights > 0 && <span>{booking.nights} night(s)</span>}
        {booking.totalAmount != null && (
          <span className="font-medium text-[#333333]">{formatCurrency(booking.totalAmount)}</span>
        )}
        {booking.status && (
          <span className="rounded bg-[#EAEAEA] px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#555555]">
            {booking.status}
          </span>
        )}
      </div>
    </div>
  )
}
