'use client'

import { memo } from 'react'
import { TableActionsMenu } from '@/shared/table'
import { formatExpenseAmount } from '../utils/expenseMoney'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate } from '@/shared/utils/date'
import type { Expense } from '../types'

interface ExpenseGridCardProps {
  expense: Expense
  categoryName: string
  t: (key: string) => string
  onDelete?: (id: string) => void
  onCategoryClick?: (categoryId: string) => void
}

export const ExpenseGridCard = memo(function ExpenseGridCard({
  expense,
  categoryName,
  t,
  onDelete,
  onCategoryClick,
}: ExpenseGridCardProps) {
  const locale = useLocale()

  return (
    <article className="min-w-0 rounded-xl border border-[#EAEAEA] bg-white p-5  transition duration-200 hover:">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {onCategoryClick ? (
            <button
              onClick={() => onCategoryClick(expense.categoryId)}
              className="rounded-md border border-[#EAEAEA] bg-[#F9F9F8] px-2.5 py-1 text-xs font-medium text-[#333333] hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
              {categoryName}
            </button>
          ) : (
            <span className="rounded-md border border-[#EAEAEA] bg-[#F9F9F8] px-2.5 py-1 text-xs font-medium text-[#333333]">
              {categoryName}
            </span>
          )}
          <p className="mt-2 text-sm text-[#1A1A1A] line-clamp-2">{expense.description}</p>
        </div>
        {onDelete ? (
          <TableActionsMenu
            actions={[
              { destructive: true as const, label: t('common.delete'), onSelect: () => onDelete(expense.id) },
            ]}
            ariaLabel={t('common.actions')}
          />
        ) : null}
      </div>

      <dl className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.expenses.amount')}
          </dt>
          <dd className="text-sm font-semibold text-[#1A1A1A]">
            {formatExpenseAmount(expense.totalAmount, expense.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.expenses.date')}
          </dt>
          <dd className="text-sm text-[#787774]">{formatDate(expense.date, locale)}</dd>
        </div>
      </dl>
    </article>
  )
})
