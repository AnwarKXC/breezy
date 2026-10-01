'use client'

import type { Money } from '@/shared/currency/money'
import { formatExpenseTotals } from '../utils/expenseMoney'

interface ExpenseAnalyticsCardsProps {
  total: Money
  averages: Money
  entriesCount: number
  categoriesCount: number
  t: (key: string) => string
}

const cardClass = 'rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1'

export function ExpenseAnalyticsCards({ total, averages, entriesCount, categoriesCount, t }: ExpenseAnalyticsCardsProps) {

  const cards = [
    { label: t('accounting.expenses.analyticsTotal'), value: total, color: 'text-[#9F2F2D]', monetary: true },
    { label: t('accounting.expenses.analyticsEntries'), value: entriesCount, color: 'text-[#1A1A1A]' },
    { label: t('accounting.expenses.analyticsCategories'), value: categoriesCount, color: 'text-purple-600' },
    { label: t('accounting.expenses.analyticsAverage'), value: averages, color: 'text-orange-600', monetary: true },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={cardClass}>
          <p className="text-sm text-[#787774]">{card.label}</p>
          <p className={`text-2xl font-bold ${card.color}`}>
            {card.monetary
              ? formatExpenseTotals(card.value as Money)
              : Number(card.value).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}
