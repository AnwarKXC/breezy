'use client'

import { useCallback, useMemo } from 'react'
import { expenseTotals, formatExpenseTotals, formatExpenseAmount } from '../utils/expenseMoney'
import type { Expense } from '../types'
import { exportExpensesCsv } from '../utils/expenseCsvExport'

interface ExpenseReportSectionProps {
  expenses: Expense[]
  categoryNames: Record<string, string>
  periodLabel: string
  t: (key: string) => string
}

export function ExpenseReportSection({
  expenses,
  categoryNames,
  periodLabel,
  t,
}: ExpenseReportSectionProps) {

  const rows = useMemo(() => {
    const byCategory = new Map<string, { entries: number; total: number }>()
    for (const expense of expenses) {
      const key = `${expense.categoryId}|${expense.currency ?? 'UNKNOWN'}`
      const current = byCategory.get(key) ?? { entries: 0, total: 0 }
      current.entries += 1
      current.total += Number(expense.totalAmount ?? expense.amount ?? 0)
      byCategory.set(key, current)
    }
    return Array.from(byCategory.entries())
      .map(([categoryId, stats]) => ({
        categoryId,
        name: categoryNames[categoryId.split('|')[0]] ?? categoryId.split('|')[0],
        currency: categoryId.split('|')[1],
        entries: stats.entries,
        total: stats.total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses, categoryNames])

  const grandTotal = formatExpenseTotals(expenseTotals(expenses))

  const handleExportCsv = useCallback(() => {
    void exportExpensesCsv(
      expenses,
      categoryNames,
      `expenses-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }, [expenses, categoryNames])

  return (
    <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#1A1A1A]">
            {t('accounting.expenses.reportTitle')}
          </h3>
          <p className="mt-0.5 text-sm text-[#787774]">{periodLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={expenses.length === 0}
          className="h-9 rounded-lg border border-[#D4D4D4] px-4 text-sm font-medium text-[#333333] transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('accounting.expenses.reportExportCsv')}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#787774]">
          {t('accounting.expenses.reportEmpty')}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-[#EAEAEA]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#EAEAEA] bg-[#F9F9F8] text-left text-xs font-semibold uppercase tracking-wider text-[#787774]">
                <th className="px-4 py-2.5">{t('accounting.expenses.category')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.expenses.analyticsEntries')}</th>
                <th className="px-4 py-2.5 text-right">{t('accounting.expenses.analyticsTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.categoryId} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-sm font-medium text-[#333333]">{row.name}</td>
                  <td className="px-4 py-2.5 text-right text-sm text-[#555555]">{row.entries}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-medium text-[#1A1A1A]">
                    {formatExpenseAmount(row.total, row.currency)}
                  </td>
                </tr>
              ))}
              <tr className="bg-stone-50">
                <td className="px-4 py-3 text-sm font-bold text-[#1A1A1A]">
                  {t('accounting.expenses.reportGrandTotal')}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-[#555555]">
                  {expenses.length}
                </td>
                <td className="px-4 py-3 text-right text-base font-bold text-[#1A1A1A]">
                  {grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
