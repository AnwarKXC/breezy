// Live exchange rates, used only to *preview* a mixed-currency total in one
// currency. Records are never converted. One USD-based table covers every
// pair (cross rates), cached in memory + localStorage for 2 hours.

import { isCurrencyCode } from '@/shared/static/currencies'
import type { MoneyRow } from './money'

export const FX_TTL_MS = 2 * 60 * 60 * 1000
const FX_BASE = 'USD'
const STORAGE_KEY = 'fx_rates_usd'

/** Units of each currency per 1 USD, plus when the provider was queried. */
export type FxRates = { rates: Record<string, number>; fetchedAt: number }

let memory: FxRates | null = null
let inflight: Promise<FxRates> | null = null

const isFresh = (value: FxRates | null): value is FxRates => !!value && Date.now() - value.fetchedAt < FX_TTL_MS

function readStored(): FxRates | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as FxRates | null
    return parsed && typeof parsed.fetchedAt === 'number' && parsed.rates ? parsed : null
  } catch {
    return null
  }
}

function store(value: FxRates) {
  memory = value
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) } catch { /* private mode: memory only */ }
}

/** Cached rates if still fresh, without fetching. */
export function peekExchangeRates(): FxRates | null {
  if (isFresh(memory)) return memory
  const stored = typeof window === 'undefined' ? null : readStored()
  if (isFresh(stored)) return (memory = stored)
  return null
}

/** Live rates (≤ 2 h old). Concurrent callers share one request. */
export function getExchangeRates(): Promise<FxRates> {
  const cached = peekExchangeRates()
  if (cached) return Promise.resolve(cached)
  inflight ??= fetch(`/api/currency/rates?base=${FX_BASE}`)
    .then(async (res) => {
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.data?.rates) throw new Error(json?.error?.message ?? 'Exchange rates are unavailable right now')
      const value: FxRates = { rates: json.data.rates, fetchedAt: json.data.fetchedAt ?? Date.now() }
      store(value)
      return value
    })
    .finally(() => { inflight = null })
  return inflight
}

function validRate(rate: number | undefined): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0
}

/** `amount` of `from` expressed in `to`, or null when a rate is missing. */
export function convertAmount(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return amount
  const fromRate = from === FX_BASE ? 1 : rates[from]
  const toRate = to === FX_BASE ? 1 : rates[to]
  if (!validRate(fromRate) || !validRate(toRate)) return null
  return (amount / fromRate) * toRate
}

/**
 * Sum of mixed-currency rows in `target`. Null when any row has an unknown
 * currency or no usable rate — a partial sum would be silently wrong.
 */
export function convertMoney(rows: MoneyRow[], target: string, rates: Record<string, number>): number | null {
  let total = 0
  for (const row of rows) {
    if (!isCurrencyCode(row.currency)) return null
    const value = convertAmount(row.amount, row.currency, target, rates)
    if (value === null) return null
    total += value
  }
  return Math.round(total * 100) / 100
}
