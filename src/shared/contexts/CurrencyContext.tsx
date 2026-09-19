'use client'

import { isCurrencyCode } from '@/shared/static/currencies'
import { createContext, useContext, useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useResource } from '@/shared/data/useResource'
import type { CurrencyCode } from '@/shared/utils/types'
import { CURRENCY_SYMBOLS } from '@/shared/utils/types'
import { invalidateDisplayCurrency } from '@/shared/currency/client'

interface CurrencyContextType {
  currencyCode: CurrencyCode
  currencySymbol: string
  rates: Record<string, number> | null
  /** Current system VAT rate (%), read live from accounting settings. */
  vatRate: number
  /** Current system service charge rate (%), read live from accounting settings. */
  serviceChargeRate: number
  /**
   * Format `amount` expressed in `from` currency, converted to the system
   * currency for display. Until FX rates load, the amount is shown unconverted
   * with the source symbol so the UI never shows a blank or wrong-value total.
   */
  formatCurrency: (amount: number, from?: CurrencyCode) => string
  /** Convert without formatting — used by reports/aggregations. */
  convert: (amount: number, from?: CurrencyCode) => number
  setCurrency: (code: CurrencyCode) => Promise<void>
  loading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | null>(null)

const DEFAULT_CURRENCY: CurrencyCode = 'EGP'
const STORAGE_KEY = 'hotel_currency'

function getStoredCurrency(): CurrencyCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isCurrencyCode(stored)) return stored
  } catch (error) { console.error('[CurrencyContext] Failed to read stored currency:', error) }
  return null
}

function storeCurrency(code: CurrencyCode) {
  try { localStorage.setItem(STORAGE_KEY, code) } catch (error) { console.error('[CurrencyContext] Failed to store currency:', error) }
}

type Setting = { key: string; value: Record<string, unknown> }

const SETTINGS_KEY = '/api/accounting/settings'
const RATES_KEY = '/api/currency'

// Roles without accounting access get 403 here; they simply use the defaults.
async function fetchSettings(): Promise<Setting[]> {
  const res = await fetch(SETTINGS_KEY)
  if (!res.ok) return []
  const settings = ((await res.json()).data ?? []) as Setting[]
  const code = settings.find((s) => s.key === 'currency')?.value?.code
  if (isCurrencyCode(code)) storeCurrency(code)
  return settings
}

// Failures are non-fatal: formatCurrency falls back to the source symbol.
async function fetchRates(): Promise<Record<string, number> | null> {
  const res = await fetch(RATES_KEY)
  if (!res.ok) return null
  return ((await res.json())?.data?.rates ?? null) as Record<string, number> | null
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

function readSettingRate(settings: Setting[] | undefined, key: string, fallback: number) {
  const rate = settings?.find((s) => s.key === key)?.value?.rate
  return typeof rate === 'number' ? rate : fallback
}

function withCurrency(settings: Setting[] = [], code: CurrencyCode): Setting[] {
  const value = { code, symbol: CURRENCY_SYMBOLS[code] }
  return settings.some((s) => s.key === 'currency')
    ? settings.map((s) => (s.key === 'currency' ? { ...s, value } : s))
    : [...settings, { key: 'currency', value }]
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // Settings and FX rates are independent (/api/currency resolves the system
  // currency server-side), so they load in parallel through the shared cache.
  const settings = useResource(SETTINGS_KEY, fetchSettings)
  const fx = useResource(RATES_KEY, fetchRates)
  // Last known currency: avoids a flash of the default before settings load.
  // The server snapshot is null so hydration always matches.
  const storedCurrency = useSyncExternalStore(subscribeStorage, getStoredCurrency, () => null)

  const savedCode = settings.data?.find((s) => s.key === 'currency')?.value?.code
  const currencyCode: CurrencyCode = isCurrencyCode(savedCode) ? savedCode : storedCurrency ?? DEFAULT_CURRENCY
  const rates = fx.data ?? null
  // Same fallbacks the server prices with (pricingService / currency/server) when a setting is unset.
  const vatRate = readSettingRate(settings.data, 'vat_rate', 14)
  const serviceChargeRate = readSettingRate(settings.data, 'service_charge_rate', 10)
  const loading = settings.isLoading

  const { mutate: mutateSettings } = settings
  const { refresh: refreshRates } = fx
  const setCurrency = useCallback(async (code: CurrencyCode) => {
    const prev = currencyCode
    const revert = () => {
      mutateSettings((current) => withCurrency(current, prev))
      storeCurrency(prev)
    }
    mutateSettings((current) => withCurrency(current, code))
    storeCurrency(code)
    // PDF exports resolve the currency through their own cached fetch; drop it
    // so a download taken right after the switch is not still in `prev`.
    invalidateDisplayCurrency()
    try {
      const res = await fetch(SETTINGS_KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'currency', value: { code, symbol: CURRENCY_SYMBOLS[code] } }),
      })
      if (!res.ok) {
        console.error('Currency save failed:', res.status)
        revert()
        return
      }
      // Rates are based on the system currency, so refresh them after a switch.
      await refreshRates()
    } catch {
      revert()
    }
  }, [currencyCode, mutateSettings, refreshRates])

  const convert = useCallback(
    (amount: number, from: CurrencyCode = currencyCode) => {
      if (from === currencyCode || !rates) return amount
      const rate = rates[from]
      if (!rate || !Number.isFinite(rate)) return amount
      return Number((amount / rate).toFixed(2))
    },
    [currencyCode, rates],
  )

  const formatCurrency = useCallback(
    (amount: number, from: CurrencyCode = currencyCode) => {
      const rate = from !== currencyCode ? rates?.[from] : undefined
      const converted = rate ? convert(amount, from) : amount
      // Without a rate the amount is shown unconverted with its own symbol.
      const symbol = CURRENCY_SYMBOLS[rate ? currencyCode : from]
      const formatted = converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      const spacer = symbol.length > 1 ? ' ' : ''
      return `${symbol}${spacer}${formatted}`
    },
    [convert, currencyCode, rates],
  )

  const value = useMemo<CurrencyContextType>(() => ({
    currencyCode,
    currencySymbol: CURRENCY_SYMBOLS[currencyCode],
    rates,
    vatRate,
    serviceChargeRate,
    formatCurrency,
    convert,
    setCurrency,
    loading,
  }), [currencyCode, rates, vatRate, serviceChargeRate, formatCurrency, convert, setCurrency, loading])

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return ctx
}
