// Server-only helpers for reading the system currency and live FX rates.
// The system currency is stored as a JSON row in the `accounting_settings`
// table (key='currency', value={'code': string, 'symbol': string}). The
// `EXCHANGE_RATE_API_KEY` env var enables external rate fetching via
// https://open.er-api.com/v6/latest/{base}.

import 'server-only'
import { prisma } from '@/services/db/prisma'
import { isCurrencyCode, type CurrencyCode } from '@/shared/static/currencies'

const DEFAULT_SYSTEM_CURRENCY: CurrencyCode = 'EGP'
const RATE_CACHE_TTL_MS = 30 * 60 * 1000 // 30 min
const FALLBACK_RATES: Record<CurrencyCode, Partial<Record<CurrencyCode, number>>> = {
  USD: { USD: 1, EGP: 48, EUR: 0.92 },
  EGP: { USD: 1 / 48, EGP: 1, EUR: 1 / 52 },
  EUR: { USD: 1 / 0.92, EGP: 52, EUR: 1 },
}

let cached: { base: CurrencyCode; rates: Record<string, number>; ts: number } | null = null

// Read on nearly every pricing/invoice request but changed only from settings:
// cache briefly in-process and invalidate on write (other instances converge in TTL).
const SYSTEM_CURRENCY_TTL_MS = 60 * 1000
let systemCurrencyCache: { code: CurrencyCode; ts: number } | null = null

export function invalidateSystemCurrencyCache() {
  systemCurrencyCache = null
}

export async function getSystemCurrency(): Promise<CurrencyCode> {
  if (systemCurrencyCache && Date.now() - systemCurrencyCache.ts < SYSTEM_CURRENCY_TTL_MS) {
    return systemCurrencyCache.code
  }
  try {
    const data = await prisma.accounting_settings.findUnique({ where: { key: 'currency' }, select: { value: true } })
    const value = data?.value as { code?: unknown } | null | undefined
    const code = typeof value?.code === 'string' ? value.code.toUpperCase() : undefined
    const resolved = isCurrencyCode(code) ? code : DEFAULT_SYSTEM_CURRENCY
    systemCurrencyCache = { code: resolved, ts: Date.now() }
    return resolved
  } catch (err) {
    console.error('[currency] getSystemCurrency failed:', err)
  }
  return DEFAULT_SYSTEM_CURRENCY
}

export async function getExchangeRates(base: CurrencyCode): Promise<Record<string, number>> {
  if (cached && cached.base === base && Date.now() - cached.ts < RATE_CACHE_TTL_MS) {
    return cached.rates
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY
  if (!apiKey) {
    const fallback = FALLBACK_RATES[base] ?? {}
    return { [base]: 1, ...fallback }
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      next: { revalidate: 1800 },
    })
    if (!res.ok) throw new Error(`FX API ${res.status}`)
    const json = await res.json()
    if (!json?.rates) throw new Error('FX API missing rates')
    cached = { base, rates: json.rates as Record<string, number>, ts: Date.now() }
    return cached.rates
  } catch (err) {
    console.error('[currency] FX fetch failed, using fallback:', err)
    const fallback = FALLBACK_RATES[base] ?? {}
    return { [base]: 1, ...fallback }
  }
}

export async function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
): Promise<number> {
  if (from === to) return amount
  const rates = await getExchangeRates(from)
  const rate = rates[to]
  if (!rate || !Number.isFinite(rate)) {
    const fallback = FALLBACK_RATES[from]?.[to]
    if (!fallback) return amount
    return Number((amount * fallback).toFixed(2))
  }
  return Number((amount * rate).toFixed(2))
}

export function convertWithRates(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number>,
): number {
  if (from === to) return amount
  const rate = rates[to]
  if (!rate || !Number.isFinite(rate)) return amount
  return Number((amount * rate).toFixed(2))
}

export interface ServiceChargeTaxRates {
  serviceChargeRate: number
  vatRate: number
}

export async function getServiceChargeTaxRates(): Promise<ServiceChargeTaxRates> {
  try {
    const data = await prisma.accounting_settings.findMany({
      where: { key: { in: ['service_charge_rate', 'vat_rate'] } },
      select: { key: true, value: true },
    })
    const map = new Map<string, { rate?: number } | undefined>(
      data.map((s) => [s.key, (s.value ?? undefined) as { rate?: number } | undefined]),
    )
    return {
      serviceChargeRate: Number(map.get('service_charge_rate')?.rate ?? 10),
      vatRate: Number(map.get('vat_rate')?.rate ?? 14),
    }
  } catch (err) {
    console.error('[currency] getServiceChargeTaxRates failed:', err)
    return { serviceChargeRate: 10, vatRate: 14 }
  }
}