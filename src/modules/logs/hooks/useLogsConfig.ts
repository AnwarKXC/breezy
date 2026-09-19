import type { LogsFilters } from '../types'

export const LOGS_PAGE_SIZE = 25
export const LOGS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export function todayInputDate() {
  const today = new Date()
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function initialLogsFilters(): LogsFilters {
  return { toDate: todayInputDate() }
}

export function getSafeLogsPageSize(value: number) {
  return LOGS_PAGE_SIZE_OPTIONS.includes(value as (typeof LOGS_PAGE_SIZE_OPTIONS)[number])
    ? value
    : LOGS_PAGE_SIZE
}
