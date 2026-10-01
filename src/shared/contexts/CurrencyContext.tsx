'use client'

import { isCurrencyCode } from '@/shared/static/currencies'
import { createContext, useContext, useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react'
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
  /** Currency set by the nearest `CurrencyScope` (a record's own currency), if any. */
  scopeCurrency: string | null
  /**
   * Plain-text total of mixed-currency rows, one figure per currency
   * (`EGP 10,000 · $500`). For UI prefer `<MoneyTotals>`, which adds the
   * live-rate convert button.
   */
  formatTotals: (rows: MoneyRow[]) => string
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
    (amount: number, code?: CurrencyCode | string | null) => formatMoney(amount, code === undefined ? currencyCode : code || 'UNKNOWN'),
    [currencyCode],
  )

  const formatTotals = useCallback((rows: MoneyRow[]) => formatMoneyTotals(rows, currencyCode), [currencyCode])

  const value = useMemo<CurrencyContextType>(() => ({
    currencyCode,
    currencySymbol: CURRENCY_SYMBOLS[currencyCode],
    vatRate,
    serviceChargeRate,
    formatCurrency,
    scopeCurrency: null,
    formatTotals,
    setCurrency,
    loading,
  }), [currencyCode, vatRate, serviceChargeRate, formatCurrency, formatTotals, setCurrency, loading])

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

/** `EGP 1,250` / `$1,250.5`: the currency's own symbol, no conversion. */
export function formatMoney(amount: number, code: CurrencyCode | string): string {
  const symbol = isCurrencyCode(code) ? CURRENCY_SYMBOLS[code] : code || 'UNKNOWN'
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${symbol}${symbol.length > 1 ? ' ' : ''}${formatted}`
}

/**
 * Totals of mixed-currency rows, one per currency (`EGP 10,000 · $500`): amounts
 * in different currencies are never added together.
 */
export function formatMoneyTotals(rows: MoneyRow[], fallback: CurrencyCode): string {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const code = row.currency || 'UNKNOWN'
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
  const scoped = code === undefined ? null : code || 'UNKNOWN'
  const value = useMemo<CurrencyContextType>(() => (scoped
    ? {
        ...parent,
        currencySymbol: isCurrencyCode(scoped) ? CURRENCY_SYMBOLS[scoped] : scoped,
        formatCurrency: (amount, from) => parent.formatCurrency(amount, from ?? scoped),
        scopeCurrency: scoped,
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
