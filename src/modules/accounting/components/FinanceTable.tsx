'use client'

import { useMemo } from 'react'
import { Table } from '@/shared/table'
import type { TableColumn } from '@/shared/table'
import type { FinanceRow } from '../types'
import type { Money } from '@/shared/currency/money'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

interface FinanceTableProps {
  rows: FinanceRow[]
  loading: boolean
  onRowClick?: (row: FinanceRow) => void
  t: (key: string) => string
}

export function FinanceTable({ rows, loading, onRowClick, t }: FinanceTableProps) {
  const { formatTotals } = useCurrency()
  const columns: TableColumn[] = useMemo(
    () => [
      { key: 'contactName', label: t('accounting.finance.contact'), sortable: true },
      { key: 'invoiceCount', label: t('accounting.finance.invoices'), sortable: true },
      {
        key: 'totalInvoiced',
        label: t('accounting.finance.invoiced'),
        sortable: false,
        render: (v) => formatTotals(v as Money),
      },
      {
        key: 'totalPaid',
        label: t('accounting.finance.paid'),
        sortable: false,
        render: (v) => formatTotals(v as Money),
      },
      {
        key: 'balance',
        label: t('accounting.finance.balance'),
        sortable: false,
        render: (v) => {
          const balance = v as Money
          return (
            <span className={balance.some((m) => m.amount > 0) ? 'text-[#9F2F2D] font-medium' : 'text-green-600 font-medium'}>
              {formatTotals(balance)}
            </span>
          )
        },
      },
    ],
    [t, formatTotals],
  )

  return (
    <Table
      data={rows as unknown as Record<string, unknown>[]}
      columns={columns}
      loading={loading}
      onRowClick={onRowClick as ((row: Record<string, unknown>) => void) | undefined}
      emptyMessage={t('accounting.finance.noData')}
      pageSize={10}
      pageSizeOptions={[10, 20, 50, 100]}
    />
  )
}
