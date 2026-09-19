import { MS_PER_DAY } from '@/shared/constants'

export type DateOnlyString = string

function normalizeLocale(locale: string): string {
  if (locale === 'ar') return 'ar-EG-u-nu-latn'
  return 'en-US'
}

function isDateOnly(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str)
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  const str = isDateOnly(value) ? `${value}T00:00:00` : value
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: string = 'en',
): string {
  const d = toDate(value)
  if (!d) return value as string ?? ''
  return d.toLocaleDateString(normalizeLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string = 'en',
): string {
  const d = toDate(value)
  if (!d) return value as string ?? ''
  return d.toLocaleDateString(normalizeLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateInput(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

export function getRelativeDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays === -1) return 'yesterday'
  if (diffDays > 0) return `in ${diffDays} days`
  return `${Math.abs(diffDays)} days ago`
}
