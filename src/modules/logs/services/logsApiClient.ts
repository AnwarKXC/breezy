import { createCrudApiClient } from '@/shared/crud'
import type { LogsAnalytics, LogsCursor, LogsFilters, LogsResponse } from '../types'

const logsApi = createCrudApiClient<unknown, never, never, LogsResponse>({
  endpoint: '/api/logs',
  defaultError: 'Failed to load logs',
})

function appendCursor(params: URLSearchParams, cursor: LogsCursor) {
  params.set('cursor', cursor)
}

export async function fetchLogsPage(input: {
  cursor?: LogsCursor
  filters?: LogsFilters
  limit?: number
}): Promise<LogsResponse> {
  const params = new URLSearchParams()
  if (input.limit) params.set('limit', String(input.limit))
  if (input.cursor) appendCursor(params, input.cursor)
  if (input.filters?.action) params.set('action', input.filters.action)
  if (input.filters?.fromDate) params.set('fromDate', input.filters.fromDate)
  if (input.filters?.module) params.set('module', input.filters.module)
  if (input.filters?.toDate) params.set('toDate', input.filters.toDate)
  if (input.filters?.userId) params.set('userId', input.filters.userId)

  return logsApi.request<LogsResponse>('', {
    cache: 'no-store',
    query: Object.fromEntries(params),
  })
}

export async function fetchLogsAnalytics(filters: LogsFilters = {}): Promise<LogsAnalytics> {
  const params = new URLSearchParams()
  if (filters.action) params.set('action', filters.action)
  if (filters.module) params.set('module', filters.module)
  if (filters.userId) params.set('userId', filters.userId)

  return logsApi.request<LogsAnalytics>('/analytics', {
    cache: 'no-store',
    query: Object.fromEntries(params),
  })
}
