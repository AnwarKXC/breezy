import { CURRENCY_SYMBOLS } from '@/shared/utils/types'
import { isCurrencyCode } from '@/shared/static/currencies'

// Display only: the exact decimal strings stay authoritative for posting and exports.
// Accounting figures always show two decimals so columns line up.
export function journalMoney(value: string | null | undefined, currency: string) {
  if (value === null || value === undefined) return '—'
  const symbol = isCurrencyCode(currency) ? CURRENCY_SYMBOLS[currency] : currency
  const formatted = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${symbol}${symbol.length > 1 ? ' ' : ''}${formatted}`
}

export function journalCompact(value: number) {
  return value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })
}

export function isNegative(value: string) {
  return value.startsWith('-') && /[1-9]/.test(value)
}
