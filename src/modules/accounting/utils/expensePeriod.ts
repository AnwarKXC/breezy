export type ExpensePeriodType = 'month' | 'year'

export interface ExpensePeriodFilter {
  month?: string
  fromDate?: string
  toDate?: string
}

// Maps a "monthly" (YYYY-MM) or "yearly" (YYYY) period selection onto the
// query params the expenses API understands. The month form uses the native
// `month` param; the year form falls back to inclusive date bounds.
export function getExpensePeriodFilter(
  period: ExpensePeriodType | null,
  value: string,
): ExpensePeriodFilter {
  if (!period || !value) return {}
  if (period === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    const month = match ? Number(match[2]) : 0
    if (match && month >= 1 && month <= 12) return { month: value }
    return {}
  }
  if (period === 'year' && /^\d{4}$/.test(value)) {
    return { fromDate: `${value}-01-01`, toDate: `${value}-12-31` }
  }
  return {}
}

export function defaultPeriodValue(period: ExpensePeriodType): string {
  const now = new Date()
  if (period === 'year') return String(now.getFullYear())
  return now.toISOString().slice(0, 7)
}

export function currentYearValue(): string {
  return String(new Date().getFullYear())
}