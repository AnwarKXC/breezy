'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode, useMemo } from 'react'
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

const DEFAULT_CURRENCY: CurrencyCode = 'USD'
const STORAGE_KEY = 'hotel_currency'

function getStoredCurrency(): CurrencyCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'USD' || stored === 'EGP' || stored === 'EUR') return stored
  } catch (error) { console.error('[CurrencyContext] Failed to read stored currency:', error) }
  return null
}

function storeCurrency(code: CurrencyCode) {
  try { localStorage.setItem(STORAGE_KEY, code) } catch (error) { console.error('[CurrencyContext] Failed to store currency:', error) }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY)
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [vatRate, setVatRate] = useState(0)
  const [serviceChargeRate, setServiceChargeRate] = useState(0)

  useEffect(() => {
    // Read from localStorage first to avoid hydration mismatch
    const stored = getStoredCurrency()
    if (stored && stored !== DEFAULT_CURRENCY) setCurrencyCode(stored)

    async function load() {
      try {
        const res = await fetch('/api/accounting/settings')
        if (res.ok) {
          const json = await res.json()
          const settings: Array<{ key: string; value: Record<string, unknown> }> = json.data ?? []
          const currencySetting = settings.find((s) => s.key === 'currency')
          if (currencySetting?.value?.code) {
            const code = currencySetting.value.code as CurrencyCode
            setCurrencyCode(code)
            storeCurrency(code)
          }
          const vatSetting = settings.find((s) => s.key === 'vat_rate')
          if (typeof vatSetting?.value?.rate === 'number') setVatRate(vatSetting.value.rate as number)
          const serviceSetting = settings.find((s) => s.key === 'service_charge_rate')
          if (typeof serviceSetting?.value?.rate === 'number') setServiceChargeRate(serviceSetting.value.rate as number)
        }
      } catch (error) {
        console.error('[CurrencyContext] Failed to load currency settings:', error)
      } finally {
        setLoading(false)
      }

      // Load FX rates for the resolved system currency. Failures are
      // non-fatal: formatCurrency falls back to the source symbol.
      try {
        const fxRes = await fetch('/api/currency')
        if (fxRes.ok) {
          const fxJson = await fxRes.json()
          if (fxJson?.data?.rates) setRates(fxJson.data.rates)
        }
      } catch (error) {
        console.error('[CurrencyContext] Failed to load FX rates:', error)
      }
    }
    void load()
  }, [])

  const setCurrency = useCallback(async (code: CurrencyCode) => {
    const prev = currencyCode
    setCurrencyCode(code)
    storeCurrency(code)
    // PDF exports resolve the currency through their own cached fetch; drop it
    // so a download taken right after the switch is not still in `prev`.
    invalidateDisplayCurrency()
    try {
      const symbol = CURRENCY_SYMBOLS[code]
      const res = await fetch('/api/accounting/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'currency', value: { code, symbol } }),
      })
      if (!res.ok) {
        console.error('Currency save failed:', res.status)
        setCurrencyCode(prev)
        storeCurrency(prev)
        return
      }
      // Refresh FX rates whenever the system currency changes.
      const fxRes = await fetch('/api/currency')
      if (fxRes.ok) {
        const fxJson = await fxRes.json()
        if (fxJson?.data?.rates) setRates(fxJson.data.rates)
      }
    } catch {
      setCurrencyCode(prev)
      storeCurrency(prev)
    }
  }, [currencyCode])

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
