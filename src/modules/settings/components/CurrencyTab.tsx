'use client'

import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { CURRENCY_LABELS } from '@/shared/utils/types'
import { CURRENCY_CODES } from '@/shared/static/currencies'

export function CurrencyTab() {
  const { currencyCode, setCurrency, loading } = useCurrency()
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CURRENCY_CODES.map((code) => {
          const active = currencyCode === code
          return (
            <button
              key={code}
              type="button"
              disabled={loading}
              onClick={() => void setCurrency(code)}
              className={`
                rounded-xl border bg-white p-5 text-left transition-all duration-200
                ${active
                  ? 'border-gray-900 ring-1 ring-gray-900 '
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
