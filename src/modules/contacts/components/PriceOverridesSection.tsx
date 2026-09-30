'use client'

import { useCallback, useMemo, useState } from 'react'
import type { CompanyPriceOverride, CreatePriceOverrideInput, OccupancyCode } from '../types'
import { OCCUPANCY_CODES } from '../constants'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { CURRENCY_CODES, type CurrencyCode } from '@/shared/static/currencies'
import { CURRENCY_LABELS } from '@/shared/utils/types'

interface PriceOverridesSectionProps {
  overrides: CompanyPriceOverride[]
  roomTypes: { slug: string; name: string; basePrice: number }[]
  canEdit: boolean
  onSave: (overrides: CreatePriceOverrideInput[]) => Promise<void>
  labels: Record<string, string>
  seasonalPrices?: Record<string, { price: number; priceSingle: number | null; priceDouble: number | null; priceTriple: number | null }>
}

function overrideKey(category: string, occupancy: OccupancyCode) {
  return `${category}:${occupancy}`
}

export function PriceOverridesSection({ overrides, roomTypes, canEdit, onSave, labels, seasonalPrices }: PriceOverridesSectionProps) {
  const { formatCurrency, currencyCode: systemCurrency } = useCurrency()
  // Company rates are kept per currency; a reservation uses the ones in its own currency.
  const [currencyChoice, setCurrencyChoice] = useState<CurrencyCode | null>(null)
  const currency = currencyChoice ?? systemCurrency
  const overrideMap = useMemo(
    () => new Map(overrides.filter((o) => o.currency === currency).map((o) => [overrideKey(o.roomCategory, o.occupancyCode), o])),
    [overrides, currency],
  )
  const basePriceMap = useMemo(
    () => new Map(roomTypes.map((rt) => [rt.slug, rt.basePrice])),
    [roomTypes],
  )

  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savingCategory, setSavingCategory] = useState<string | null>(null)

  const getPrice = useCallback(
    (category: string, occupancy: OccupancyCode) => {
      const existing = overrideMap.get(overrideKey(category, occupancy))
      const key = overrideKey(category, occupancy)
      if (draft[key] !== undefined) return draft[key]
      if (existing) return String(existing.price)
      return ''
    },
    [overrideMap, draft],
  )

  const getDisplayPrice = useCallback(
    (category: string, occupancy: OccupancyCode) => {
      const priceStr = getPrice(category, occupancy)
      if (priceStr) return { value: priceStr, isOverride: true }
      // Standard/seasonal hints are system-currency prices; never show them under another currency.
      if (currency !== systemCurrency) return null
      const seasonal = seasonalPrices?.[category]
      if (seasonal) {
        switch (occupancy) {
          case 'S': return { value: seasonal.priceSingle != null ? String(seasonal.priceSingle) : String(seasonal.price), isOverride: false }
          case 'D': return { value: seasonal.priceDouble != null ? String(seasonal.priceDouble) : String(seasonal.price), isOverride: false }
          case 'T': return { value: seasonal.priceTriple != null ? String(seasonal.priceTriple) : String(seasonal.price), isOverride: false }
        }
      }
      const base = basePriceMap.get(category)
      if (base) return { value: String(base), isOverride: false }
      return null
    },
    [getPrice, seasonalPrices, basePriceMap, currency, systemCurrency],
  )

  const updateDraft = useCallback((category: string, occupancy: OccupancyCode, value: string) => {
    const key = overrideKey(category, occupancy)
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const hasRowChanges = useCallback(
    (category: string) => OCCUPANCY_CODES.some((oc) => draft[overrideKey(category, oc)] !== undefined),
    [draft],
  )

  const handleSaveRow = useCallback(
    async (category: string) => {
      setSavingCategory(category)
      try {
        const inputs: CreatePriceOverrideInput[] = []
        for (const occupancy of OCCUPANCY_CODES) {
          const key = overrideKey(category, occupancy)
          const priceStr = draft[key] ?? overrideMap.get(key)?.price
          if (priceStr !== undefined && priceStr !== '') {
            inputs.push({
              roomCategory: category,
              occupancyCode: occupancy,
              price: Number(priceStr),
              currency,
            } as CreatePriceOverrideInput)
          }
        }
        await onSave(inputs)
        setDraft((prev) => {
          const next = { ...prev }
          for (const occupancy of OCCUPANCY_CODES) {
            delete next[overrideKey(category, occupancy)]
          }
          return next
        })
      } finally {
        setSavingCategory(null)
      }
    },
    [draft, overrideMap, onSave, currency],
  )

  return (
    <div className="rounded-xl bg-white p-6 ">
      <h3 className="mb-4 text-base font-bold text-[#1A1A1A]">{labels.priceOverridesTitle}</h3>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs text-[#787774]">
          {labels.priceOverridesDescription}
        </p>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-[#787774]">
          {labels.currency}
          <select
            value={currency}
            onChange={(e) => {
              setCurrencyChoice(e.target.value as CurrencyCode)
              setDraft({})
            }}
            className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-2 text-sm text-[#1A1A1A]"
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>{CURRENCY_LABELS[code]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#EAEAEA]">
              <th className="pb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.roomCategory}</th>
              {OCCUPANCY_CODES.map((oc) => (
                <th key={oc} className="pb-2 px-3 text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{oc}</th>
              ))}
              {canEdit && <th className="pb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.actions}</th>}
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt) => (
              <tr key={rt.slug} className="border-b border-gray-50">
                <td className="py-2 text-sm font-medium text-[#333333] capitalize">{rt.name}</td>
                {OCCUPANCY_CODES.map((oc) => {
                  const display = getDisplayPrice(rt.slug, oc)
                  return (
                    <td key={oc} className="px-3 py-2">
                      {canEdit ? (
                        <input
                          type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
                          min={0}
                          step="0.01"
                          value={getPrice(rt.slug, oc)}
                          onChange={(e) => updateDraft(rt.slug, oc, e.target.value)}
                          className={`w-24 rounded-lg border px-2 py-1 text-sm ${
                            display && !display.isOverride
                              ? 'border-[#EAEAEA] text-[#787774]'
                              : 'border-[#EAEAEA] text-[#1A1A1A]'
                          }`}
                          placeholder={display && !display.isOverride ? String(display.value) : '—'}
                        />
                      ) : (
                        <span className={`text-sm ${display && !display.isOverride ? 'text-[#787774]' : 'text-[#1A1A1A]'}`}>
                          {display ? formatCurrency(Number(display.value), currency) : '—'}
                        </span>
                      )}
                    </td>
                  )
                })}
                {canEdit ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={savingCategory === rt.slug || !hasRowChanges(rt.slug)}
                      onClick={() => handleSaveRow(rt.slug)}
                      className="rounded-lg bg-[#1A1A1A] px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {savingCategory === rt.slug ? labels.savingOverrides : labels.saveOverrides}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
