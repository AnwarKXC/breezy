'use client'

import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { CURRENCY_LABELS } from '@/shared/utils/types'
import { CURRENCY_CODES } from '@/shared/static/currencies'

export function CurrencyTab() {
  const { currencyCode, setCurrency, loading } = useCurrency()
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t('settings.currency.defaultTitle')}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t('settings.currency.defaultHint')}</p>
      </div>
      <div role="radiogroup" aria-label={t('settings.currency.defaultTitle')} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CURRENCY_CODES.map((code) => {
          const active = currencyCode === code
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={loading}
              onClick={() => void setCurrency(code)}
              className={`
                rounded-xl border bg-white p-5 text-left transition-all duration-200
                ${active
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-[#EAEAEA] hover:border-gray-400 hover:'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <p className="text-lg font-bold text-[#1A1A1A]">{CURRENCY_LABELS[code]}</p>
              <p className="mt-1 text-sm text-[#787774]">
                {t(`settings.currency.${code}`)}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
