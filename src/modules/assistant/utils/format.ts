import { formatMoney } from '@/shared/contexts/CurrencyContext'
import type { Money } from '@/shared/currency/money'
import { formatDate } from '@/shared/utils/date'

import type { CellValue, PeriodRange, ValueFormat } from '../types'

export type Translate = (key: string) => string

/** t() returns the key itself when missing; fall back to a readable label. */
export function label(t: Translate, key: string, fallback?: string): string {
  const value = t(key)
  return value === key ? (fallback ?? key.split('.').at(-1)!.replaceAll('_', ' ')) : value
}

export function fieldLabel(t: Translate, key: string) {
  return label(t, `assistant.fields.${key}`)
}

export function enumLabel(t: Translate, value: string) {
  return label(t, `assistant.values.${value}`, value.replaceAll('_', ' '))
}

function isMoneyList(value: CellValue): value is Money {
  return Array.isArray(value)
}

export function formatCell(value: CellValue | undefined, format: ValueFormat, options: { t: Translate; locale: string; currency?: string | null }): string {
  if (value === null || value === undefined || value === '') return '—'
  if (isMoneyList(value)) return value.length ? value.map((m) => formatMoney(m.amount, m.currency)).join(' · ') : '—'
  switch (format) {
    case 'money':
      return typeof value === 'number' ? formatMoney(value, options.currency || '') : String(value)
    case 'money_list':
      return String(value)
    case 'percent':
      return typeof value === 'number' ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : String(value)
    case 'number':
      return typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value)
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value, options.locale) : String(value)
    case 'enum':
      return enumLabel(options.t, String(value))
    default:
      return String(value)
  }
}

const ALL_TIME_FROM = '2000-01-01'

export function formatPeriod(period: PeriodRange | undefined, t: Translate, locale: string): string | null {
  if (!period) return null
  if (period.from === ALL_TIME_FROM) return label(t, 'assistant.allTime')
  if (period.from === period.to) return formatDate(period.from, locale)
  return `${formatDate(period.from, locale)} – ${formatDate(period.to, locale)}`
}

function csvEscape(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** UTF-8 BOM so Excel opens Arabic text correctly. */
export function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const content = '﻿' + [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
