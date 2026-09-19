// Browser-side counterpart to `@/shared/currency/server`.
//
// `CurrencyContext` already converts every amount it renders into the system
// currency, but PDF exports are plain functions called from event handlers and
// cannot read React context. They used to print `invoice.currency` verbatim, so
// switching the system currency changed the screen and left the PDF behind.
// These helpers resolve the same system currency and FX rates the context uses,
// so a PDF matches what the user saw when they clicked download.

import type { CurrencyCode } from '@/shared/utils/types'

const STORAGE_KEY = 'hotel_currency'
const DEFAULT_CURRENCY: CurrencyCode = 'EGP'
const RATE_CACHE_TTL_MS = 5 * 60 * 1000

export interface DisplayCurrency {
  /** System currency amounts should be shown in. */
  code: CurrencyCode
  /** Rates keyed by currency, based on `code`. `null` when the fetch failed. */
  rates: Record<string, number> | null
}

let cached: { value: DisplayCurrency; ts: number } | null = null

/**
 * Drop the cached rates. Called when the system currency changes so an export
 * taken right after the switch does not print the previous currency.
 */
export function invalidateDisplayCurrency() {
  cached = null
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return value === 'USD' || value === 'EGP' || value === 'EUR'
}

function readStoredCurrency(): CurrencyCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isCurrencyCode(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * Resolve the system currency plus live FX rates. `/api/currency` is
 * authoritative for both; the localStorage value written by `CurrencyContext`
 * is only the fallback for when that request fails.
 */
export async function resolveDisplayCurrency(): Promise<DisplayCurrency> {
  if (cached && Date.now() - cached.ts < RATE_CACHE_TTL_MS) return cached.value

  const stored = readStoredCurrency() ?? DEFAULT_CURRENCY

  try {
    const res = await fetch('/api/currency')
    if (res.ok) {
      const json = await res.json()
      const base = json?.data?.base
      const rates = json?.data?.rates
      const value: DisplayCurrency = {
        code: isCurrencyCode(base) ? base : stored,
        rates: rates && typeof rates === 'object' ? (rates as Record<string, number>) : null,
      }
      if (value.rates) cached = { value, ts: Date.now() }
      return value
    }
  } catch (error) {
    console.error('[currency/client] failed to resolve display currency:', error)
  }

  return { code: stored, rates: null }
}

export interface CurrencyConverter {
  /** Currency the converted values are expressed in. */
  code: CurrencyCode
  /** True when a usable rate was found and amounts are being converted. */
  converted: boolean
  convert: (amount: number) => number
}

/**
 * Build a converter from `source` into the display currency, mirroring
 * `CurrencyContext.convert`: rates are based on the display currency, so one
 * unit of display currency costs `rates[source]` of the source currency.
 *
 * Without a usable rate the converter reports the *source* currency and leaves
 * amounts untouched, so a missing rate never relabels EGP figures as USD.
 */
export function createCurrencyConverter(
  source: CurrencyCode,
  display: DisplayCurrency,
): CurrencyConverter {
  const rate = source !== display.code ? display.rates?.[source] : undefined

  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    return { code: source, converted: false, convert: (amount) => amount }
  }

  return {
    code: display.code,
    converted: true,
    convert: (amount) => Number((amount / rate).toFixed(2)),
  }
}

/** Resolve the display currency and build a converter for `source` in one step. */
export async function getCurrencyConverter(source: CurrencyCode): Promise<CurrencyConverter> {
  return createCurrencyConverter(source, await resolveDisplayCurrency())
}
