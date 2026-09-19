'use client'

import { useCallback, useState } from 'react'
import { bookingListQueryString, bookingService, type BookingListQuery, type BookingPage } from '@/services/bookingService'
import { useResource } from '@/shared/data/useResource'
import { toast } from '@/shared/toast/toastEvents'
import type { Booking } from '../types'

const ACTIVE_BOOKINGS_KEY = '/api/reservations/board?scope=active'

function reportLoadError(e: unknown): never {
  toast.error('Network error', { description: e instanceof Error ? e.message : 'Failed to fetch bookings' })
  throw e
}

const fetchActiveBookings = () => bookingService.getActive().catch(reportLoadError)

/** Current/upcoming stays and the last week's bookings: room grid and stats. */
export function useBookings() {
  const { data, error, isLoading, refresh } = useResource<Booking[]>(ACTIVE_BOOKINGS_KEY, fetchActiveBookings)

  return {
    bookings: data ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    fetchBookings: refresh,
  }
}

/** One server-side page of the reservations list. */
export function useBookingsPage(query: BookingListQuery) {
  const queryString = bookingListQueryString(query)
  const fetchPage = useCallback(() => bookingService.getPage(queryString).catch(reportLoadError), [queryString])
  const { data, error, isLoading, refresh } = useResource<BookingPage>(`/api/reservations/board?${queryString}`, fetchPage)

  // Keep showing the last page while the next one loads, so paging and typing
  // in search do not flash the skeleton.
  const [lastPage, setLastPage] = useState<BookingPage | undefined>(data)
  if (data && data !== lastPage) setLastPage(data)
  const page = data ?? lastPage

  return {
    bookings: page?.bookings ?? [],
    total: page?.total ?? 0,
    loading: isLoading && !page,
    error: error?.message ?? null,
    refresh,
  }
}

export default useBookings
