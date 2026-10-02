'use client'

import type { TableColumn } from '../table/types'
import { TableCheckbox } from './TableCheckbox'

interface TableMobileViewProps<T extends Record<string, unknown>> {
  data: T[]
  columns: TableColumn<T>[]
  onRowClick?: (row: T, event?: React.MouseEvent) => void
  selectable?: boolean
  isRowSelected?: (row: T, index: number) => boolean
  onToggleRow?: (row: T, index: number, checked: boolean) => void
  selectionLabel?: string
}

export function TableMobileView<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  selectable = false,
  isRowSelected,
  onToggleRow,
  selectionLabel = 'Select row',
}: TableMobileViewProps<T>) {
  const primaryColumn = columns[0]
  const actionColumn = columns.find(
    (column) => String(column.key) === 'id' && Boolean(column.render),
  )
  const detailColumns = columns.filter(
    (column) => column !== primaryColumn && column !== actionColumn,
  )

  return (
    <div className="grid gap-2 bg-white">
      {data.map((row, rowIndex) => (
        <article
          key={String(row.id ?? rowIndex)}
          data-row-id={String(row.id ?? rowIndex)}
          data-row-clickable={onRowClick ? true : undefined}
          className={`min-w-0 border-b border-line px-4 py-4 text-sm text-[#333333] last:border-b-0 ${selectable && isRowSelected?.(row, rowIndex) ? 'bg-accent/10' : 'bg-white'} ${onRowClick ? "cursor-pointer transition-colors duration-150 active:bg-accent/10" : ""}`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[data-ignore-row-click]')) return
            onRowClick?.(row, e)
          }}
        >
          <div className="flex min-w-0 items-start gap-3">
            {selectable ? (
              <div className="shrink-0 pt-2" data-ignore-row-click onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                <TableCheckbox
                  checked={Boolean(isRowSelected?.(row, rowIndex))}
                  label={selectionLabel}
                  onChange={(checked) => onToggleRow?.(row, rowIndex, checked)}
                />
              </div>
            ) : null}
            {primaryColumn ? (
              <div className="min-w-0 flex-1">
                {primaryColumn.render
                  ? primaryColumn.render(row[primaryColumn.key], row)
                  : String(row[primaryColumn.key] ?? "")}
              </div>
            ) : null}
            {actionColumn ? (
              <div className="shrink-0">
                {actionColumn.render?.(row[actionColumn.key], row)}
              </div>
            ) : null}
          </div>

          <dl className={`mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 ${selectable ? 'ps-8' : ''}`}>
            {detailColumns.map((col) => (
              <div key={String(col.key)} className="min-w-0 border-s border-[#EAEAEA] ps-3">
                <dt className="truncate text-[11px] font-medium text-[#787774]">
                  {col.label}
                </dt>
                <dd className="mt-1 min-w-0 break-words text-sm font-semibold text-[#1A1A1A]">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  )
}
