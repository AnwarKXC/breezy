'use client'

import { useEffect, useMemo } from 'react'
import { useAccounting } from './useAccounting'

export function useFinanceTable(dateParams?: { fromDate?: string; toDate?: string }) {
  const { financeTable, financialHealth, loading, loadFinanceTable, loadFinancialHealth } = useAccounting()

  useEffect(() => {
    loadFinanceTable(dateParams)
    loadFinancialHealth(dateParams)
  }, [loadFinanceTable, loadFinancialHealth, dateParams?.fromDate, dateParams?.toDate])

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
