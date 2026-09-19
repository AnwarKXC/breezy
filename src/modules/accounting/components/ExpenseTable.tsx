'use client'

import { memo, useMemo } from 'react'
import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import type { Expense } from '../types'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate } from '@/shared/utils/date'

type ExpenseRow = Expense & Record<string, unknown>

interface ExpenseTableProps {
  expenses: Expense[]
  categoryNames: Record<string, string>
  loading: boolean
  t: (key: string) => string
  onDelete?: (id: string) => void
  onCategoryClick?: (categoryId: string) => void
  hideCategory?: boolean
}

export const ExpenseTable = memo(function ExpenseTable({
  expenses,
  categoryNames,
  loading,
  t,
  onDelete,
  onCategoryClick,
  hideCategory,
}: ExpenseTableProps) {
  const { formatCurrency } = useCurrency()
  const locale = useLocale()
  const hasActions = Boolean(onDelete)
  const columns = useMemo(() => {
    const cols: TableColumn<ExpenseRow>[] = [
      ...(!hideCategory ? [{
        key: 'categoryId' as const,
        label: t('accounting.expenses.category'),
        render: (_value: unknown, expense: ExpenseRow) => (
          onCategoryClick ? (
            <button
              onClick={() => onCategoryClick(expense.categoryId)}
              className="rounded-md border border-[#EAEAEA] bg-[#F9F9F8] px-2.5 py-1 text-xs font-medium text-[#333333] hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
            >
              {categoryNames[expense.categoryId] ?? expense.categoryId}
            </button>
          ) : (
            <span className="rounded-md border border-[#EAEAEA] bg-[#F9F9F8] px-2.5 py-1 text-xs font-medium text-[#333333]">
              {categoryNames[expense.categoryId] ?? expense.categoryId}
            </span>
          )
        ),
      }] : []),
      { key: 'description', label: t('accounting.expenses.description') },
      {
        key: 'amount',
        label: t('accounting.expenses.amount'),
        render: (_value, expense) => (
          <span className="font-medium">{formatCurrency(Number(expense.amount))}</span>
        ),
      },
      {
        key: 'date',
        label: t('accounting.expenses.date'),
        render: (_value, expense) => (
          <span className="text-[#787774]">{formatDate(expense.date, locale)}</span>
        ),
      },
    ]

    if (hasActions) {
      cols.push({
        key: 'id',
        label: t('common.actions'),
        render: (_value, expense) => (
          <TableActionsMenu
            actions={[
              ...(onDelete
                ? [{ destructive: true, label: t('common.delete'), onSelect: () => onDelete(expense.id) }]
                : []),
            ]}
            ariaLabel={t('common.actions')}
          />
        ),
      })
    }

    return cols
  }, [categoryNames, t, hasActions, onDelete, formatCurrency, locale])

  return (
    <Table
      columns={columns}
      data={expenses as ExpenseRow[]}
      pageSize={10}
      pageSizeOptions={[10, 20, 50, 100]}
      sortable={false}
      loading={loading}
      emptyMessage={t('accounting.expenses.noExpenses')}
    />
  )
})
