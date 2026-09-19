// 📁 src/shared/utils/types.ts - Utility types

export type DateFormat = 'short' | 'long' | 'time' | 'datetime' | 'iso'
export type CurrencyCode = 'USD' | 'EGP' | 'EUR'

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: 'USD ($)',
  EGP: 'EGP (ج.م)',
  EUR: 'EUR (€)',
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EGP: 'EGP',
  EUR: '€',
}

export interface DateUtils {
  format: (date: Date, format: DateFormat, locale?: string) => string
  parse: (dateString: string, format?: DateFormat) => Date
  difference: (date1: Date, date2: Date) => number
  isValid: (date: unknown) => boolean
}

export interface CurrencyUtils {
  format: (amount: number, code: CurrencyCode, locale?: string) => string
  parse: (value: string) => number
  convert: (amount: number, from: CurrencyCode, to: CurrencyCode) => number
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface Validator {
  email: (value: string) => ValidationResult
  phone: (value: string) => ValidationResult
  required: (value: unknown) => ValidationResult
  minLength: (value: string, min: number) => ValidationResult
  maxLength: (value: string, max: number) => ValidationResult
  pattern: (value: string, pattern: RegExp) => ValidationResult
}