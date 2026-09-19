'use client'

import { useCallback } from 'react'
import { useInitialFetch } from '@/shared/hooks/useInitialFetch'
import { useAccountingOverview, useAccounting } from '../hooks'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { Skeleton } from '@/shared/components/Skeleton'

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

  const summaryCards: Array<{ label: string; value: string; color: string }> = [
    { label: t('accounting.overview.todayRevenue'), value: formatCurrency(overview?.todayRevenue ?? 0), color: 'text-green-600' },
    { label: t('accounting.overview.monthRevenue'), value: formatCurrency(overview?.monthToDateRevenue ?? 0), color: 'text-[#1A1A1A]' },
    { label: t('accounting.overview.outstanding'), value: formatCurrency(overview?.outstandingBalance ?? 0), color: 'text-amber-600' },
    { label: t('accounting.overview.netProfit'), value: formatCurrency(overview?.netProfit ?? 0), color: (overview?.netProfit ?? 0) >= 0 ? 'text-green-600' : 'text-[#9F2F2D]' },
    { label: t('accounting.overview.paidInvoices'), value: String(overview?.paidInvoices ?? 0), color: 'text-cyan-600' },
    { label: t('accounting.overview.unpaidInvoices'), value: String(overview?.unpaidInvoices ?? 0), color: 'text-[#9F2F2D]' },
    { label: t('accounting.overview.totalExpenses'), value: formatCurrency(overview?.totalExpenses ?? 0), color: 'text-purple-600' },
    { label: t('accounting.overview.totalRefunds'), value: formatCurrency(overview?.totalRefunds ?? 0), color: 'text-[#9F2F2D]' },
  ]

  const paymentCards: Array<{ label: string; value: string }> = [
    { label: t('accounting.overview.cashToday'), value: formatCurrency(overview?.cashCollectedToday ?? 0) },
    { label: t('accounting.overview.cardToday'), value: formatCurrency(overview?.cardPaymentsToday ?? 0) },
    { label: t('accounting.overview.bankToday'), value: formatCurrency(overview?.bankPaymentsToday ?? 0) },
    { label: t('accounting.overview.onlineToday'), value: formatCurrency(overview?.onlinePaymentsToday ?? 0) },
  ]

  const financialCards: Array<{ label: string; value: string; color: string }> = [
    { label: t('accounting.finance.totalRevenue'), value: formatCurrency(financialHealth?.totalRevenue ?? 0), color: 'text-green-600' },
    { label: t('accounting.finance.totalExpenses'), value: formatCurrency(financialHealth?.totalExpenses ?? 0), color: 'text-[#9F2F2D]' },
    { label: t('accounting.finance.netBalance'), value: formatCurrency(financialHealth?.netBalance ?? 0), color: (financialHealth?.netBalance ?? 0) >= 0 ? 'text-green-600' : 'text-[#9F2F2D]' },
    { label: t('accounting.finance.outstanding'), value: formatCurrency(financialHealth?.outstanding ?? 0), color: 'text-amber-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {summaryCards.map((card, i) => (
          <div key={i} className={cardClass}>
            <p className="text-sm text-[#787774]">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`} suppressHydrationWarning>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {paymentCards.map((card, i) => (
          <div key={i} className={cardClass}>
            <p className="text-sm text-[#787774]">{card.label}</p>
            <p className="text-2xl font-bold text-[#1A1A1A]" suppressHydrationWarning>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-medium text-[#787774] mb-3">{t('accounting.overview.financialHealth')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {financialCards.map((card, i) => (
            <div key={i} className={cardClass}>
              <p className="text-sm text-[#787774]">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`} suppressHydrationWarning>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleRefresh}
        className="h-9 rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white transition-all hover:bg-[#333333]"
      >
        {t('common.refresh')}
      </button>
    </div>
  )
}
