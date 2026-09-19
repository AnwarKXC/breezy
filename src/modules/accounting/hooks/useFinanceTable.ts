'use client'

import { useEffect, useMemo } from 'react'
import { useAccounting } from './useAccounting'

export function useFinanceTable(dateParams?: { fromDate?: string; toDate?: string }) {
  const { financeTable, financialHealth, loading, loadFinanceTable, loadFinancialHealth } = useAccounting()

  const fromDate = dateParams?.fromDate
  const toDate = dateParams?.toDate
  useEffect(() => {
    const params = fromDate || toDate ? { fromDate, toDate } : undefined
    loadFinanceTable(params)
    loadFinancialHealth(params)
  }, [loadFinanceTable, loadFinancialHealth, fromDate, toDate])

  const stats = useMemo(
    () =>
      financialHealth ?? {
        totalRevenue: 0,
        totalExpenses: 0,
        netBalance: 0,
        outstanding: 0,
      },
    [financialHealth],
  )

  return { rows: financeTable, stats, loading }
}
