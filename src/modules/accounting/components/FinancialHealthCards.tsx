'use client'

import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { isNonNegativeMoney } from '@/shared/currency/money'
import type { FinancialHealth } from '../types'

interface FinancialHealthCardsProps {
  stats: FinancialHealth
  loading?: boolean
  t: (key: string) => string
}

const cardClass = 'rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1'

export function FinancialHealthCards({ stats, loading, t }: FinancialHealthCardsProps) {
  const { formatTotals } = useCurrency()

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-[#F5F5F5] rounded-xl" />
        ))}
      </div>
    )
  }

  const cards = [
    { label: t('accounting.finance.totalRevenue'), value: stats.totalRevenue, color: 'text-green-600' },
    { label: t('accounting.finance.totalExpenses'), value: stats.totalExpenses, color: 'text-[#9F2F2D]' },
    { label: t('accounting.finance.netBalance'), value: stats.netBalance, color: isNonNegativeMoney(stats.netBalance) ? 'text-green-600' : 'text-[#9F2F2D]' },
    { label: t('accounting.finance.outstanding'), value: stats.outstanding, color: 'text-orange-600' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={cardClass}>
          <p className="text-sm text-[#787774]">{card.label}</p>
          <p className={`break-words text-2xl font-bold ${card.color}`}>
            {formatTotals(card.value)}
          </p>
        </div>
      ))}
    </div>
  )
}
