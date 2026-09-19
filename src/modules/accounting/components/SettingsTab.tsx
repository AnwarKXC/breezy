'use client'

import { useState, useCallback } from 'react'
import { useInitialFetch } from '@/shared/hooks/useInitialFetch'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

import { Skeleton } from '@/shared/components/Skeleton'

interface Props {
  t: (key: string) => string
}

interface Setting {
  key: string
  value: Record<string, unknown>
  description: string | null
}

export function SettingsTab({ t }: Props) {
  const { currencySymbol } = useCurrency()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/settings')
      if (res.ok) {
        const json = await res.json()
        setSettings(json.data ?? [])
      }
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [])

  useInitialFetch(loadSettings)

  const handleUpdate = useCallback(async (key: string, value: Record<string, unknown>) => {
    setSaving(key)
    try {
      const res = await fetch('/api/accounting/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (res.ok) {
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
      }
    } catch { /* handled */ }
    finally { setSaving(null) }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1">
        <h3 className="text-sm font-medium text-[#333333] mb-4">{t('accounting.settings.title')}</h3>
        <div className="space-y-4">
          {settings.map((setting) => (
            <div key={setting.key} className="border-b border-[#EAEAEA] pb-4 last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  {setting.description && (
                    <p className="text-xs text-[#787774]">{setting.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {setting.key === 'vat_rate' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" inputMode="decimal" step="0.01" min={0} max={100} onWheel={(event) => event.currentTarget.blur()}
                        className="w-20 rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm text-right"
                        defaultValue={Number(setting.value.rate ?? 0)}
                        onBlur={(e) => handleUpdate(setting.key, { rate: Number(e.target.value) })}
                      />
                      <span className="text-sm text-[#787774]">%</span>
                    </div>
                  )}
                  {setting.key === 'service_charge_rate' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" inputMode="decimal" step="0.01" min={0} max={100} onWheel={(event) => event.currentTarget.blur()}
                        className="w-20 rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm text-right"
                        defaultValue={Number(setting.value.rate ?? 0)}
                        onBlur={(e) => handleUpdate(setting.key, { rate: Number(e.target.value) })}
                      />
                      <span className="text-sm text-[#787774]">%</span>
                    </div>
                  )}
                  {setting.key === 'approval_threshold' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#787774]">{currencySymbol}</span>
                      <input
                        type="number" inputMode="decimal" step="0.01" min={0} onWheel={(event) => event.currentTarget.blur()}
                        className="w-24 rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm text-right"
                        defaultValue={Number(setting.value.amount ?? 0)}
                        onBlur={(e) => handleUpdate(setting.key, { amount: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {setting.key === 'currency' && (
                    <span className="text-sm text-[#787774]">
                      {String(setting.value.code ?? '')} ({String(setting.value.symbol ?? '')})
                    </span>
                  )}
                  {saving === setting.key && (
                    <span className="text-xs text-[#787774]">{t('common.saving')}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
