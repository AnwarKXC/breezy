'use client'

import { useEffect } from 'react'
import type { LogsAnalytics, LogsCursor, LogsFilters, LogsResponse } from '../types'
import { fetchLogsAnalytics, fetchLogsPage } from '../services/logsApiClient'

interface UseLogsRequestStateInput {
  cursor?: LogsCursor
  filters: LogsFilters
  pageSize: number
  setAnalytics: (analytics: LogsAnalytics | null) => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  setState: (state: LogsResponse) => void
}

export function useLogsRequestState({
  cursor,
  filters,
  pageSize,
  setAnalytics,
  setError,
  setLoading,
  setState,
}: UseLogsRequestStateInput) {
  useEffect(() => {
    let active = true

    fetchLogsPage({ cursor, filters, limit: pageSize })
      .then((result) => {
        if (!active) return
        setError(null)
        setState(result)
      })
      .catch((fetchError) => {
        if (active) setError(fetchError instanceof Error ? fetchError.message : 'logs/request_failed')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [cursor, filters, pageSize, setError, setLoading, setState])

  useEffect(() => {
    let active = true

    fetchLogsAnalytics(filters)
      .then((result) => {
        if (active) setAnalytics(result)
      })
      .catch(() => {
        if (active) setAnalytics(null)
      })

    return () => {
      active = false
    }
  }, [filters, setAnalytics])
}
