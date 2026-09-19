import type { ReactNode } from 'react'
import type { SortState, TableColumn } from '../table/types'
import { TableCheckbox } from './TableCheckbox'

interface TableDesktopViewProps<T extends Record<string, unknown>> {
  allPageRowsSelected: boolean
  columns: TableColumn<T>[]
  data: T[]
  getRowId: (row: T, index: number) => string
  isSelectable: boolean
  onPageSelectionChange: (checked: boolean) => void
  onRowClick?: (row: T, event?: React.MouseEvent) => void
  onRowSelectionChange: (rowId: string, checked: boolean) => void
  onSort: (key: string) => void
  selectedRowIdSet: Set<string>
  selectionLabel: string
  sortable: boolean
  somePageRowsSelected: boolean
  sort: SortState
}

function getSortIcon(direction: 'asc' | 'desc' | undefined) {
  if (direction === 'asc') return '^'
  if (direction === 'desc') return 'v'
  return ''
}

function renderCell<T extends Record<string, unknown>>(column: TableColumn<T>, row: T): ReactNode {
  return column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')
}

export function TableDesktopView<T extends Record<string, unknown>>({
  allPageRowsSelected,
  columns,
  data,
  getRowId,
  isSelectable,
  onPageSelectionChange,
  onRowClick,
  onRowSelectionChange,
  onSort,
  selectedRowIdSet,
  selectionLabel,
  sortable,
  somePageRowsSelected,
  sort,
}: TableDesktopViewProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="border-b border-[#EAEAEA] bg-white">
          <tr>
            {isSelectable ? (
              <th className="w-12 px-4 py-3 text-left">
                <TableCheckbox
                  checked={allPageRowsSelected}
                  indeterminate={!allPageRowsSelected && somePageRowsSelected}
                  label={`${selectionLabel}s`}
                  onChange={onPageSelectionChange}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`px-4 py-3 text-left text-xs font-medium text-[#787774] ${sortable && column.sortable ? 'cursor-pointer hover:text-[#1A1A1A]' : ''}`}
                style={{ width: column.width }}
                onClick={() => column.sortable && onSort(String(column.key))}
              >
                <div className="flex items-center gap-1">
                  {column.label}
                  {sortable && column.sortable ? (
                    <span className="text-[#787774]">
                      {getSortIcon(sort.key === column.key ? sort.direction : undefined)}
                    </span>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F5F5F5]">
          {data.map((row, rowIndex) => {
            const rowId = getRowId(row, rowIndex)

            return (
              <tr
                  key={rowId}
                  data-row-id={rowId}
                  className={`text-sm text-[#333333] transition-colors duration-150 hover:bg-[#F9F9F8] ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-ignore-row-click]')) return
                    onRowClick?.(row, e)
                  }}
                >
                  {isSelectable ? (
                    <td className="px-4 py-3.5" data-ignore-row-click onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                      <TableCheckbox
                        checked={selectedRowIdSet.has(rowId)}
                        label={selectionLabel}
                        onChange={(checked) => onRowSelectionChange(rowId, checked)}
                      />
                    </td>
                  ) : null}
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-4 py-3.5 text-sm text-[#333333]">
                    {renderCell(column, row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
