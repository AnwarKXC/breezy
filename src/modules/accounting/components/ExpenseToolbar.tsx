'use client'

import { useCallback } from 'react'
import { FloatingInput } from '@/shared/components/FloatingField'
import { ToolbarSearch, ToolbarExportGroup } from '@/shared/components/toolbar'
import { useLocale } from '@/i18n/components/LocaleContext'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { Expense } from '../types'
import type { ExpensePeriodType } from '../utils/expensePeriod'
import { exportExpensesCsv } from '../utils/expenseCsvExport'
import { exportExpensesListPdf } from '../utils/expenseListPdfExport'

interface ExpenseToolbarProps {
  period: ExpensePeriodType | null
  periodValue: string
  fromDate: string
  toDate: string
  query: string
  expenses: Expense[]
  categoryNames: Record<string, string>
  t: (key: string) => string
  onPeriodChange: (period: ExpensePeriodType | null) => void
  onPeriodValueChange: (value: string) => void
  onFromDateChange: (date: string) => void
  onToDateChange: (date: string) => void
  onQueryChange: (query: string) => void
}

export function ExpenseToolbar({
  period,
  periodValue,
  fromDate,
  toDate,
  query,
  expenses,
  categoryNames,
  t,
  onPeriodChange,
  onPeriodValueChange,
  onFromDateChange,
  onToDateChange,
  onQueryChange,
}: ExpenseToolbarProps) {
  const locale = useLocale()
  const { currencyCode } = useCurrency()

  const handleExportCsv = useCallback(() => {
    void exportExpensesCsv(expenses, categoryNames, `expenses-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [expenses, categoryNames])

  const handleExportPdf = useCallback(() => {
    void exportExpensesListPdf(expenses, categoryNames, locale as 'en' | 'ar', `expenses-${new Date().toISOString().slice(0, 10)}.pdf`, currencyCode)
  }, [expenses, categoryNames, locale, currencyCode])

  return (
    <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="h-10 rounded-lg border border-[#D4D4D4] px-3 text-sm text-[#333333]"
          value={period ?? ''}
          onChange={(e) => onPeriodChange((e.target.value || null) as ExpensePeriodType | null)}
        >
          <option value="">{t('accounting.expenses.periodCustom')}</option>
          <option value="month">{t('accounting.expenses.periodMonthly')}</option>
          <option value="year">{t('accounting.expenses.periodYearly')}</option>
        </select>
        {period === 'month' ? (
          <input
            type="month"
            value={periodValue}
            onChange={(e) => onPeriodValueChange(e.target.value)}
            className="h-10 rounded-lg border border-[#D4D4D4] px-3 text-sm text-[#333333]"
          />
        ) : period === 'year' ? (
          <input
            type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
            min="2000"
            max="2100"
            value={periodValue}
            onChange={(e) => onPeriodValueChange(e.target.value)}
            className="h-10 w-28 rounded-lg border border-[#D4D4D4] px-3 text-sm text-[#333333]"
          />
        ) : (
          <>
            <FloatingInput
              type="date" max={toDate || undefined}
              label={t('accounting.expenses.fromDate')}
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              wrapperClassName="sm:max-w-40"
            />
            <FloatingInput
              type="date" min={fromDate || undefined}
              label={t('accounting.expenses.toDate')}
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              wrapperClassName="sm:max-w-40"
            />
          </>
        )}
        <ToolbarSearch
          value={query}
          onChange={onQueryChange}
          placeholder={t('accounting.expenses.searchPlaceholder')}
        />
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <ToolbarExportGroup
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          csvLabel="CSV"
          pdfLabel="PDF"
        />
      </div>
    </div>
  )
}
