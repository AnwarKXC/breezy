'use client'

import { isCurrencyCode } from '@/shared/static/currencies'
import { createContext, useContext, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { loadResource, useResource } from '@/shared/data/useResource'
import type { CurrencyCode } from '@/shared/utils/types'
import { CURRENCY_SYMBOLS } from '@/shared/utils/types'

interface CurrencyContextType {
  /** System (default) currency: preselected for new reservations, invoices and rates. */
  currencyCode: CurrencyCode
  currencySymbol: string
  /** Current system VAT rate (%), read live from accounting settings. */
  vatRate: number
  /** Current system service charge rate (%), read live from accounting settings. */
  serviceChargeRate: number
  /**
   * Format `amount` in `code` (the record's own currency; defaults to the
   * system currency). Amounts are never converted between currencies.
   */
  formatCurrency: (amount: number, code?: CurrencyCode | string | null) => string
  /**
   * Total of mixed-currency rows. Normally one figure per currency
   * (`EGP 10,000 · $500`); while "view in default currency" is on and live
   * rates are loaded, one approximate figure in the system currency.
   */
  formatTotals: (rows: MoneyRow[]) => string
  /** On-demand view: convert totals into the system currency with live rates. */
  viewInDefault: boolean
  setViewInDefault: (on: boolean) => void
  fx: { loading: boolean; error: string | null; fetchedAt: number | null }
  setCurrency: (code: CurrencyCode) => Promise<void>
  loading: boolean
}

import type { MoneyRow } from '@/shared/currency/money'

export type { MoneyRow }

const CurrencyContext = createContext<CurrencyContextType | null>(null)

const DEFAULT_CURRENCY: CurrencyCode = 'EGP'
const STORAGE_KEY = 'hotel_currency'

function getStoredCurrency(): CurrencyCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isCurrencyCode(stored)) return stored
  } catch {
    // Storage unavailable (private mode): fall back to the default. Runs on every
    // render as a store snapshot, so it must stay silent.
  }
  return null
}

function storeCurrency(code: CurrencyCode) {
  try { localStorage.setItem(STORAGE_KEY, code) } catch (error) { console.error('[CurrencyContext] Failed to store currency:', error) }
}

type Setting = { key: string; value: Record<string, unknown> }

const SETTINGS_KEY = '/api/accounting/settings'

// Roles without accounting access get 403 here; they simply use the defaults.
async function fetchSettings(): Promise<Setting[]> {
  const res = await fetch(SETTINGS_KEY)
  if (!res.ok) return []
  const settings = ((await res.json()).data ?? []) as Setting[]
  const code = settings.find((s) => s.key === 'currency')?.value?.code
  if (isCurrencyCode(code)) storeCurrency(code)
  return settings
}

type FxRates = { rates: Record<string, number>; fetchedAt: number }

async function fetchFxRates(base: CurrencyCode): Promise<FxRates> {
  const res = await fetch(`/api/currency/rates?base=${base}`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.data?.rates) throw new Error(json?.error?.message ?? 'Exchange rates are unavailable right now')
  return { rates: json.data.rates, fetchedAt: json.data.fetchedAt }
}

/** Re-reads system settings (currency, VAT, service charge) after they are edited. */
export function refreshAccountingSettings() {
  return loadResource(SETTINGS_KEY, fetchSettings, { force: true })
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
  const settings = useResource(SETTINGS_KEY, fetchSettings)
  // Last known currency: avoids a flash of the default before settings load.
  // The server snapshot is null so hydration always matches.
  const storedCurrency = useSyncExternalStore(subscribeStorage, getStoredCurrency, () => null)

  const savedCode = settings.data?.find((s) => s.key === 'currency')?.value?.code
  const currencyCode: CurrencyCode = isCurrencyCode(savedCode) ? savedCode : storedCurrency ?? DEFAULT_CURRENCY
  // Same fallbacks the server prices with (pricingService / currency/server) when a setting is unset.
  const vatRate = readSettingRate(settings.data, 'vat_rate', 14)
  const serviceChargeRate = readSettingRate(settings.data, 'service_charge_rate', 10)
  const loading = settings.isLoading

  const { mutate: mutateSettings } = settings
  const setCurrency = useCallback(async (code: CurrencyCode) => {
    const prev = currencyCode
    const revert = () => {
      mutateSettings((current) => withCurrency(current, prev))
      storeCurrency(prev)
    }
    mutateSettings((current) => withCurrency(current, code))
    storeCurrency(code)
    try {
      const res = await fetch(SETTINGS_KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'currency', value: { code, symbol: CURRENCY_SYMBOLS[code] } }),
      })
      if (!res.ok) {
        console.error('Currency save failed:', res.status)
        revert()
      }
    } catch {
      revert()
    }
  }, [currencyCode, mutateSettings])

  const formatCurrency = useCallback(
    (amount: number, code?: CurrencyCode | string | null) => formatMoney(amount, isCurrencyCode(code) ? code : currencyCode),
    [currencyCode],
  )

  // Live rates load only after the user asks for the converted view.
  const [viewInDefault, setViewInDefault] = useState(false)
  const fxResource = useResource(viewInDefault ? `/api/currency/rates?base=${currencyCode}` : null, () => fetchFxRates(currencyCode))
  const rates = viewInDefault ? fxResource.data?.rates ?? null : null
  const fx = useMemo(() => ({
    loading: viewInDefault && fxResource.isLoading,
    error: viewInDefault && fxResource.error ? fxResource.error.message : null,
    fetchedAt: viewInDefault ? fxResource.data?.fetchedAt ?? null : null,
  }), [viewInDefault, fxResource.isLoading, fxResource.error, fxResource.data])

  const formatTotals = useCallback((rows: MoneyRow[]) => {
    if (rates) {
      let total = 0
      for (const row of rows) {
        const code = isCurrencyCode(row.currency) ? row.currency : currencyCode
        const rate = code === currencyCode ? 1 : rates[code]
        // A currency without a rate can't be folded in: keep the split view.
        if (!rate || !Number.isFinite(rate)) return formatMoneyTotals(rows, currencyCode)
        total += row.amount / rate
      }
      return `≈ ${formatMoney(Math.round(total * 100) / 100, currencyCode)}`
    }
    return formatMoneyTotals(rows, currencyCode)
  }, [rates, currencyCode])

  const value = useMemo<CurrencyContextType>(() => ({
    currencyCode,
    currencySymbol: CURRENCY_SYMBOLS[currencyCode],
    vatRate,
    serviceChargeRate,
    formatCurrency,
    formatTotals,
    viewInDefault,
    setViewInDefault,
    fx,
    setCurrency,
    loading,
  }), [currencyCode, vatRate, serviceChargeRate, formatCurrency, formatTotals, viewInDefault, fx, setCurrency, loading])

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

/** `EGP 1,250` / `$1,250.5`: the currency's own symbol, no conversion. */
export function formatMoney(amount: number, code: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[code]
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${symbol}${symbol.length > 1 ? ' ' : ''}${formatted}`
}

/**
 * Totals of mixed-currency rows, one per currency (`EGP 10,000 · $500`): amounts
 * in different currencies are never added together.
 */
export function formatMoneyTotals(rows: MoneyRow[], fallback: CurrencyCode): string {
  const totals = new Map<CurrencyCode, number>()
  for (const row of rows) {
    const code = isCurrencyCode(row.currency) ? row.currency : fallback
    totals.set(code, (totals.get(code) ?? 0) + row.amount)
  }
  if (totals.size === 0) return formatMoney(0, fallback)
  return [...totals].map(([code, amount]) => formatMoney(amount, code)).join(' · ')
}

/**
 * Shows everything inside in `code` (e.g. one reservation's or invoice's
 * currency): `formatCurrency(amount)` without an explicit code uses it.
 */
export function CurrencyScope({ code, children }: { code: string | null | undefined; children: ReactNode }) {
  const parent = useCurrency()
  const scoped = isCurrencyCode(code) ? code : null
  const value = useMemo<CurrencyContextType>(() => (scoped
    ? {
        ...parent,
        currencySymbol: CURRENCY_SYMBOLS[scoped],
        formatCurrency: (amount, from) => parent.formatCurrency(amount, from ?? scoped),
      }
    : parent), [parent, scoped])
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return ctx
}
