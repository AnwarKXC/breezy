'use client'

import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useTranslation } from '@/i18n/hooks/useTranslation'

/**
 * Totals are shown per currency; this toggle converts them into the system
 * currency with live rates, on demand only. Records themselves never change.
 */
export function ViewInCurrencyToggle({ className = '' }: { className?: string }) {
  const { currencyCode, viewInDefault, setViewInDefault, fx } = useCurrency()
  const { t } = useTranslation()

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        aria-pressed={viewInDefault}
        onClick={() => setViewInDefault(!viewInDefault)}
        className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
          viewInDefault
            ? 'border-accent bg-accent text-accent-foreground hover:bg-accent-hover'
            : 'border-[#EAEAEA] bg-white text-ink hover:bg-[#F9F9F8]'
        }`}
      >
        {viewInDefault ? t('settings.currency.byCurrency') : t('settings.currency.viewIn').replace('{currency}', currencyCode)}
      </button>
      {viewInDefault && (
        <span className={`text-xs ${fx.error ? 'text-[#9F2F2D]' : 'text-ink-muted'}`} role="status">
          {fx.error
            ? t('settings.currency.fxError')
            : fx.loading
              ? t('settings.currency.fxLoading')
              : t('settings.currency.fxNote')}
        </span>
      )}
    </div>
  )
}
