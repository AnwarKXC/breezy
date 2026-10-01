'use client'

import { useCallback, type ReactNode } from 'react'
import { useInitialFetch } from '@/shared/hooks/useInitialFetch'
import { useAccountingOverview, useAccounting } from '../hooks'
import { MoneyTotals } from '@/shared/components/MoneyTotals'
import { isNonNegativeMoney } from '@/shared/currency/money'
import { Skeleton } from '@/shared/components/Skeleton'
import { InfoHint } from '@/shared/components/InfoHint'

interface Props {
  t: (key: string) => string
}

const cardClass = 'rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1'

export function AccountingDashboardTab({ t }: Props) {
  const { overview, loading, refresh } = useAccountingOverview()
  const { financialHealth, loadFinancialHealth } = useAccounting()

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

  const summaryCards: Array<{ label: string; hint: string; value: ReactNode; color: string }> = [
    { label: t('accounting.overview.todayRevenue'), hint: t('accounting.hints.overview.todayRevenue'), value: <MoneyTotals value={overview?.todayRevenue} />, color: 'text-green-600' },
    { label: t('accounting.overview.monthRevenue'), hint: t('accounting.hints.overview.monthRevenue'), value: <MoneyTotals value={overview?.monthToDateRevenue} />, color: 'text-[#1A1A1A]' },
    { label: t('accounting.overview.outstanding'), hint: t('accounting.hints.overview.outstanding'), value: <MoneyTotals value={overview?.outstandingBalance} />, color: 'text-amber-600' },
    { label: t('accounting.overview.netProfit'), hint: t('accounting.hints.overview.netProfit'), value: <MoneyTotals value={overview?.netProfit} />, color: isNonNegativeMoney(overview?.netProfit) ? 'text-green-600' : 'text-[#9F2F2D]' },
    { label: t('accounting.overview.paidInvoices'), hint: t('accounting.hints.overview.paidInvoices'), value: String(overview?.paidInvoices ?? 0), color: 'text-cyan-600' },
    { label: t('accounting.overview.unpaidInvoices'), hint: t('accounting.hints.overview.unpaidInvoices'), value: String(overview?.unpaidInvoices ?? 0), color: 'text-[#9F2F2D]' },
    { label: t('accounting.overview.totalExpenses'), hint: t('accounting.hints.overview.totalExpenses'), value: <MoneyTotals value={overview?.totalExpenses} />, color: 'text-purple-600' },
    { label: t('accounting.overview.totalRefunds'), hint: t('accounting.hints.overview.totalRefunds'), value: <MoneyTotals value={overview?.totalRefunds} />, color: 'text-[#9F2F2D]' },
  ]

  const paymentCards: Array<{ label: string; hint: string; value: ReactNode }> = [
    { label: t('accounting.overview.cashToday'), hint: t('accounting.hints.overview.cashToday'), value: <MoneyTotals value={overview?.cashCollectedToday} /> },
    { label: t('accounting.overview.cardToday'), hint: t('accounting.hints.overview.cardToday'), value: <MoneyTotals value={overview?.cardPaymentsToday} /> },
    { label: t('accounting.overview.bankToday'), hint: t('accounting.hints.overview.bankToday'), value: <MoneyTotals value={overview?.bankPaymentsToday} /> },
    { label: t('accounting.overview.onlineToday'), hint: t('accounting.hints.overview.onlineToday'), value: <MoneyTotals value={overview?.onlinePaymentsToday} /> },
  ]

  const financialCards: Array<{ label: string; hint: string; value: ReactNode; color: string }> = [
    { label: t('accounting.finance.totalRevenue'), hint: t('accounting.hints.finance.totalRevenue'), value: <MoneyTotals value={financialHealth?.totalRevenue} />, color: 'text-green-600' },
    { label: t('accounting.finance.totalExpenses'), hint: t('accounting.hints.finance.totalExpenses'), value: <MoneyTotals value={financialHealth?.totalExpenses} />, color: 'text-[#9F2F2D]' },
    { label: t('accounting.finance.netBalance'), hint: t('accounting.hints.finance.netBalance'), value: <MoneyTotals value={financialHealth?.netBalance} />, color: isNonNegativeMoney(financialHealth?.netBalance) ? 'text-green-600' : 'text-[#9F2F2D]' },
    { label: t('accounting.finance.outstanding'), hint: t('accounting.hints.finance.outstanding'), value: <MoneyTotals value={financialHealth?.outstanding} />, color: 'text-amber-600' },
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

function MetricCard({ label, hint, value, color }: { label: string; hint: string; value: ReactNode; color: string }) {
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
