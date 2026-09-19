'use client'

import { bookingService } from '@/services/bookingService'
import { useResource } from '@/shared/data/useResource'
import { toast } from '@/shared/toast/toastEvents'
import type { Booking } from '../types'

export const BOOKINGS_KEY = '/api/reservations/board'

function fetchBookings() {
  return bookingService.getAll().catch((e: unknown) => {
    toast.error('Network error', { description: e instanceof Error ? e.message : 'Failed to fetch bookings' })
    throw e
  })
}

export function useBookings() {
  const { data, error, isLoading, refresh } = useResource<Booking[]>(BOOKINGS_KEY, fetchBookings)

  return {
    bookings: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    fetchBookings: refresh,
  }
}

export default useBookings
