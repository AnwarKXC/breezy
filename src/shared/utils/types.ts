// 📁 src/shared/utils/types.ts - Utility types

export type DateFormat = 'short' | 'long' | 'time' | 'datetime' | 'iso'
import { CURRENCIES, type CurrencyCode } from '@/shared/static/currencies'

export type { CurrencyCode }

export const CURRENCY_LABELS = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.label])) as Record<CurrencyCode, string>

export const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol])) as Record<CurrencyCode, string>

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