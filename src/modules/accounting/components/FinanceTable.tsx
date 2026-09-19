'use client'

import { useMemo } from 'react'
import { Table } from '@/shared/table'
import type { TableColumn } from '@/shared/table'
import type { FinanceRow } from '../types'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

interface FinanceTableProps {
  rows: FinanceRow[]
  loading: boolean
  onRowClick?: (row: FinanceRow) => void
  t: (key: string) => string
}

export function FinanceTable({ rows, loading, onRowClick, t }: FinanceTableProps) {
  const { formatCurrency } = useCurrency()
  const columns: TableColumn[] = useMemo(
    () => [
      { key: 'contactName', label: t('accounting.finance.contact'), sortable: true },
      { key: 'invoiceCount', label: t('accounting.finance.invoices'), sortable: true },
      {
        key: 'totalInvoiced',
        label: t('accounting.finance.invoiced'),
        sortable: true,
        render: (v) => formatCurrency(Number(v)),
      },
      {
        key: 'totalPaid',
        label: t('accounting.finance.paid'),
        sortable: true,
        render: (v) => formatCurrency(Number(v)),
      },
      {
        key: 'balance',
        label: t('accounting.finance.balance'),
        sortable: true,
        render: (v) => {
          const balance = Number(v)
          return (
            <span className={balance > 0 ? 'text-[#9F2F2D] font-medium' : 'text-green-600 font-medium'}>
              {formatCurrency(balance)}
            </span>
          )
        },
      },
    ],
    [t, formatCurrency],
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
