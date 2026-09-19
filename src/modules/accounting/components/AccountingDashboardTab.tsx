'use client'

import { useCallback } from 'react'
import { useInitialFetch } from '@/shared/hooks/useInitialFetch'
import { useAccountingOverview, useAccounting } from '../hooks'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { Skeleton } from '@/shared/components/Skeleton'
import { InfoHint } from '@/shared/components/InfoHint'

interface Props {
  t: (key: string) => string
}

const cardClass = 'rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1'

export function AccountingDashboardTab({ t }: Props) {
  const { overview, loading, refresh } = useAccountingOverview()
  const { financialHealth, loadFinancialHealth } = useAccounting()
  const { formatCurrency } = useCurrency()

  useInitialFetch(loadFinancialHealth)

  const handleRefresh = useCallback(() => {
    refresh()
    loadFinancialHealth()
  }, [refresh, loadFinancialHealth])

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const summaryCards: Array<{ label: string; hint: string; value: string; color: string }> = [
    { label: t('accounting.overview.todayRevenue'), hint: t('accounting.hints.overview.todayRevenue'), value: formatCurrency(overview?.todayRevenue ?? 0), color: 'text-green-600' },
    { label: t('accounting.overview.monthRevenue'), hint: t('accounting.hints.overview.monthRevenue'), value: formatCurrency(overview?.monthToDateRevenue ?? 0), color: 'text-[#1A1A1A]' },
    { label: t('accounting.overview.outstanding'), hint: t('accounting.hints.overview.outstanding'), value: formatCurrency(overview?.outstandingBalance ?? 0), color: 'text-amber-600' },
    { label: t('accounting.overview.netProfit'), hint: t('accounting.hints.overview.netProfit'), value: formatCurrency(overview?.netProfit ?? 0), color: (overview?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-[#9F2F2D]' },
    { label: t('accounting.overview.paidInvoices'), hint: t('accounting.hints.overview.paidInvoices'), value: String(overview?.paidInvoices ?? 0), color: 'text-cyan-600' },
    { label: t('accounting.overview.unpaidInvoices'), hint: t('accounting.hints.overview.unpaidInvoices'), value: String(overview?.unpaidInvoices ?? 0), color: 'text-[#9F2F2D]' },
    { label: t('accounting.overview.totalExpenses'), hint: t('accounting.hints.overview.totalExpenses'), value: formatCurrency(overview?.totalExpenses ?? 0), color: 'text-purple-600' },
    { label: t('accounting.overview.totalRefunds'), hint: t('accounting.hints.overview.totalRefunds'), value: formatCurrency(overview?.totalRefunds ?? 0), color: 'text-[#9F2F2D]' },
  ]

  const paymentCards: Array<{ label: string; hint: string; value: string }> = [
    { label: t('accounting.overview.cashToday'), hint: t('accounting.hints.overview.cashToday'), value: formatCurrency(overview?.cashCollectedToday ?? 0) },
    { label: t('accounting.overview.cardToday'), hint: t('accounting.hints.overview.cardToday'), value: formatCurrency(overview?.cardPaymentsToday ?? 0) },
    { label: t('accounting.overview.bankToday'), hint: t('accounting.hints.overview.bankToday'), value: formatCurrency(overview?.bankPaymentsToday ?? 0) },
    { label: t('accounting.overview.onlineToday'), hint: t('accounting.hints.overview.onlineToday'), value: formatCurrency(overview?.onlinePaymentsToday ?? 0) },
  ]

  const financialCards: Array<{ label: string; hint: string; value: string; color: string }> = [
    { label: t('accounting.finance.totalRevenue'), hint: t('accounting.hints.finance.totalRevenue'), value: formatCurrency(financialHealth?.totalRevenue ?? 0), color: 'text-green-600' },
    { label: t('accounting.finance.totalExpenses'), hint: t('accounting.hints.finance.totalExpenses'), value: formatCurrency(financialHealth?.totalExpenses ?? 0), color: 'text-[#9F2F2D]' },
    { label: t('accounting.finance.netBalance'), hint: t('accounting.hints.finance.netBalance'), value: formatCurrency(financialHealth?.netBalance ?? 0), color: (financialHealth?.netBalance ?? 0) >= 0 ? 'text-green-600' : 'text-[#9F2F2D]' },
    { label: t('accounting.finance.outstanding'), hint: t('accounting.hints.finance.outstanding'), value: formatCurrency(financialHealth?.outstanding ?? 0), color: 'text-amber-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-[#787774]">{t('accounting.hints.sections.summary')}</h3>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          data-tooltip={t('accounting.hints.refresh')}
          className="h-9 shrink-0 rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#F9F9F8] disabled:opacity-50"
        >
          {loading ? t('common.loading') : t('common.refresh')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-[#787774]">{t('accounting.hints.sections.paymentsToday')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {paymentCards.map((card) => (
            <MetricCard key={card.label} {...card} color="text-[#1A1A1A]" />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-[#787774]">
          {t('accounting.overview.financialHealth')}
          <InfoHint text={t('accounting.hints.sections.financialHealth')} />
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {financialCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, hint, value, color }: { label: string; hint: string; value: string; color: string }) {
  return (
    <div className={cardClass}>
      <p className="flex items-start gap-1.5 text-xs text-[#787774] sm:text-sm">
        <span className="min-w-0">{label}</span>
        <InfoHint text={hint} className="mt-0.5" />
      </p>
      <p className={`break-words text-lg font-bold tabular-nums sm:text-2xl ${color}`} suppressHydrationWarning>{value}</p>
    </div>
  )
}
