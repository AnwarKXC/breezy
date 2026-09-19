'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { toast } from '@/shared/toast/toastEvents'

interface AccountingSetting {
  key: string
  value: { rate?: number }
}

export function PricingTab() {
  const { t } = useTranslation()
  const [serviceCharge, setServiceCharge] = useState('10')
  const [vatRate, setVatRate] = useState('14')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/accounting/settings')
      .then((r) => r.json())
      .then((res: { data?: AccountingSetting[] }) => {
        const data = res.data ?? []
        const sc = data.find((s) => s.key === 'service_charge_rate')
        const vr = data.find((s) => s.key === 'vat_rate')
        if (sc?.value?.rate != null) setServiceCharge(String(sc.value.rate))
        if (vr?.value?.rate != null) setVatRate(String(vr.value.rate))
      })
      .catch(() => toast.error(t('settingsPricing.loadFailed')))
      .finally(() => setLoading(false))
  }, [])

  const save = useCallback(async () => {
    const sc = Number(serviceCharge)
    const vat = Number(vatRate)
    if (Number.isNaN(sc) || sc < 0 || sc > 100 || Number.isNaN(vat) || vat < 0 || vat > 100) {
      toast.error(t('settingsPricing.rangeError'))
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        fetch('/api/accounting/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'service_charge_rate', value: { rate: sc } }),
        }),
        fetch('/api/accounting/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'vat_rate', value: { rate: vat } }),
        }),
      ])
      toast.success(t('settingsPricing.saveSuccess'))
    } catch {
      toast.error(t('settingsPricing.saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [serviceCharge, vatRate])

  if (loading) {
    return <div className="text-sm text-[#787774]">{t('settingsPricing.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#1A1A1A]">
          {t('settings.pricing.title')}
        </h2>
        <p className="mt-1 text-sm font-medium text-[#787774]">
          {t('settings.pricing.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
            {t('accounting.settings.serviceCharge')} (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={serviceCharge}
            onChange={(e) => setServiceCharge(e.target.value)}
            className="block w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
            {t('accounting.settings.vatRate')} (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            className="block w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {saving ? t('settingsPricing.saving') : t('settingsPricing.save')}
      </button>
    </div>
  )
}
