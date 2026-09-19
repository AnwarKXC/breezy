'use client'

import { useCallback } from 'react'
import type { BookingWarning, InvoiceBookingLookup } from '../types'

interface UseBookingValidationOptions {
  existingInvoicesMap?: Map<string, string[]>
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function useBookingValidation(options?: UseBookingValidationOptions) {
  const { existingInvoicesMap } = options ?? {}

  const validate = useCallback((booking: InvoiceBookingLookup | null): BookingWarning[] => {
    if (!booking) return []

    const warnings: BookingWarning[] = []

    if (booking.status === 'cancelled') {
      warnings.push({
        type: 'cancelled',
        severity: 'error',
        message: 'Booking is cancelled. Only cancellation fees may be charged.',
        actions: [
          { label: 'Add cancellation fee', action: 'add_cancellation_fee', payload: { bookingId: booking.id } },
        ],
      })
    }

    if (booking.status === 'no_show') {
      warnings.push({
        type: 'no_show',
        severity: 'warning',
        message: 'This is a no-show booking. A no-show charge will be auto-filled.',
        actions: [
          { label: 'Auto-fill no-show charge', action: 'auto_fill_no_show', payload: { bookingId: booking.id } },
        ],
      })
    }

    const existingIds = existingInvoicesMap?.get(booking.id)
    if (existingIds && existingIds.length > 0) {
      warnings.push({
        type: 'existing_invoice',
        severity: 'error',
        message: `This booking already has ${existingIds.length} invoice(s). Creating another may duplicate charges.`,
        actions: [
          { label: 'View existing', action: 'view_existing', payload: { bookingId: booking.id } },
          { label: 'Create additional', action: 'create_additional', payload: { bookingId: booking.id } },
        ],
      })
    }

    if (booking.totalAmount == null || booking.totalAmount <= 0) {
      warnings.push({
        type: 'missing_price',
        severity: 'warning',
        message: 'This booking has no room price configured. You will need to set charges manually.',
        actions: [
          { label: 'Use default price', action: 'use_default_price', payload: { bookingId: booking.id } },
          { label: 'Set manually', action: 'set_manually', payload: { bookingId: booking.id } },
        ],
      })
    }

    if (!booking.contactId && !booking.contactName && !booking.guestName) {
      warnings.push({
        type: 'missing_guest_data',
        severity: 'warning',
        message: 'Guest contact information is missing. Consider updating the booking record.',
      })
    }

    if (booking.paidAmount != null && booking.paidAmount > 0) {
      warnings.push({
        type: 'has_deposit',
        severity: 'info',
        message: `Booking has a deposit of ${formatCurrency(booking.paidAmount)}. Apply to invoice?`,
        actions: [
          { label: 'Apply deposit', action: 'apply_deposit', payload: { bookingId: booking.id, amount: booking.paidAmount } },
          { label: 'Skip', action: 'skip_deposit', payload: { bookingId: booking.id } },
          { label: 'Partial', action: 'partial_deposit', payload: { bookingId: booking.id } },
        ],
      })
    }

    return warnings
  }, [existingInvoicesMap])

  return { validate }
}
