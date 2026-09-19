import { useState, useEffect, useCallback } from 'react'
import { bookingService } from '@/services/bookingService'
import type { Booking } from '../types'
import { toast } from '@/shared/toast/toastEvents'

interface UseBookingsOptions {
  autoFetch?: boolean
}

export function useBookings(options: UseBookingsOptions = {}) {
  const { autoFetch = true } = options

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await bookingService.getAll()
      setBookings(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch bookings'
      setError(message)
      toast.error('Network error', { description: message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoFetch) {
      const timer = setTimeout(() => {
        void fetchBookings()
      }, 0)

      return () => clearTimeout(timer)
    }
  }, [autoFetch, fetchBookings])

  return {
    bookings,
    loading,
    error,
    fetchBookings,
  }
}

export default useBookings
