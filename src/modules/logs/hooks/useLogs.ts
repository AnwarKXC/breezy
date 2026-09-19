'use client'

import { useCallback, useMemo, useState } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import type { LogsAnalytics, LogsCursor, LogsFilters, LogsResponse } from '../types'
import { getSafeLogsPageSize, initialLogsFilters, LOGS_PAGE_SIZE, LOGS_PAGE_SIZE_OPTIONS } from './useLogsConfig'
import { resolveLogsPageCursors } from './logsPagination'
import { useLogsRequestState } from './useLogsRequestState'

export function useLogs() {
  const [filters, setFilters] = useState<LogsFilters>(initialLogsFilters)
  const [cursorStack, setCursorStack] = useState<Array<LogsCursor | undefined>>([undefined])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(LOGS_PAGE_SIZE)
  const [state, setState] = useState<LogsResponse>({ data: [], hasMore: false, nextCursor: null })
  const [analytics, setAnalytics] = useState<LogsAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debouncedUserId = useDebounce(filters.userId ?? '', 300)
  const requestFilters = useMemo(
    () => ({
      action: filters.action,
      fromDate: filters.fromDate,
      module: filters.module,
      toDate: filters.toDate,
      userId: debouncedUserId.trim() || undefined,
    }),
    [debouncedUserId, filters.action, filters.fromDate, filters.module, filters.toDate],
  )
  const cursor = cursorStack[page - 1]

  useLogsRequestState({ cursor, filters: requestFilters, pageSize, setAnalytics, setError, setLoading, setState })

  const resetPage = useCallback(() => {
    setLoading(true)
    setError(null)
    setCursorStack([undefined])
    setPage(1)
  }, [])
  const updateFilters = useCallback((nextFilters: LogsFilters) => {
    setFilters(nextFilters)
    resetPage()
  }, [resetPage])
  const updatePageSize = useCallback((value: number) => {
    setPageSize(getSafeLogsPageSize(value))
    resetPage()
  }, [resetPage])
  const nextPage = useCallback(() => {
    if (!state.nextCursor) return
    setLoading(true)
    setError(null)
    setCursorStack((current) => {
      const next = current.slice(0, page)
      next[page] = state.nextCursor ?? undefined
      return next
    })
    setPage((current) => current + 1)
  }, [page, state.nextCursor])
  const previousPage = useCallback(() => {
    setLoading(true)
    setError(null)
    setPage((current) => Math.max(1, current - 1))
  }, [])

  const totalPages = Math.max(1, Math.ceil((state.total ?? state.data.length) / pageSize))
  const goToPage = useCallback(async (targetPage: number) => {
    try {
      setLoading(true)
      setError(null)
      const nextCursors = await resolveLogsPageCursors({
        cursorStack, filters: requestFilters, page, pageSize, stateNextCursor: state.nextCursor, targetPage, totalPages,
      })
      if (!nextCursors) return setLoading(false)
      setCursorStack(nextCursors)
      setPage(targetPage)
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'logs/request_failed')
      setLoading(false)
    }
  }, [cursorStack, page, pageSize, requestFilters, state.nextCursor, totalPages])

  return {
    analytics, canNext: state.hasMore && Boolean(state.nextCursor), canPrevious: page > 1, error, filters, goToPage,
    knownPages: cursorStack.length, loading, logs: state.data, nextPage, page, pageSize,
    pageSizeOptions: LOGS_PAGE_SIZE_OPTIONS, previousPage, totalPages, updateFilters, updatePageSize,
  }
}
