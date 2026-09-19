import { useMemo, useState } from 'react'
import type { SortState, TableColumn } from '../table/types'

interface UseTableStateInput<T extends Record<string, unknown>> {
  columns: TableColumn<T>[]
  data: T[]
  getRowId?: (row: T, index: number) => string
  onSelectedRowIdsChange?: (ids: string[]) => void
  pageSize: number
  paginate: boolean
  selectable: boolean
  selectedRowIds: readonly string[]
  sortable: boolean
}

export function useTableState<T extends Record<string, unknown>>({
  data,
  getRowId,
  onSelectedRowIdsChange,
  pageSize,
  paginate,
  selectable,
  selectedRowIds,
  sortable,
}: UseTableStateInput<T>) {
  const [sort, setSort] = useState<SortState>({ key: '', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [activePageSize, setActivePageSize] = useState(pageSize)
  const sortedData = useMemo(() => {
    if (!sortable) return data
    if (!sort.key) return data
    return [...data].sort((a, b) => {
      const aVal = a[sort.key]
      const bVal = b[sort.key]
      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      const comparison = aVal < bVal ? -1 : 1
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [data, sort, sortable])
  const totalPages = paginate ? Math.max(1, Math.ceil(sortedData.length / activePageSize)) : 1
  const currentPage = paginate ? Math.min(page, totalPages) : 1
  const paginatedData = useMemo(() => {
    if (!paginate) return sortedData
    const start = (currentPage - 1) * activePageSize
    return sortedData.slice(start, start + activePageSize)
  }, [paginate, sortedData, currentPage, activePageSize])
  const isSelectable = selectable && Boolean(onSelectedRowIdsChange)
  const selectedRowIdSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds])
  const getResolvedRowId = (row: T, index: number) => getRowId?.(row, index) ?? String(row.id ?? index)
  const pageRowIds = paginatedData.map((row, index) => getResolvedRowId(row, index))
  const allPageRowsSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedRowIdSet.has(id))
  const somePageRowsSelected = pageRowIds.some((id) => selectedRowIdSet.has(id))

  const handleSort = (key: string) => {
    if (!sortable) return
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }
  const handlePageSizeChange = (nextPageSize: number) => {
    setActivePageSize(nextPageSize)
    setPage(1)
  }
  const handleRowSelectionChange = (rowId: string, checked: boolean) => {
    if (!onSelectedRowIdsChange) return
    const nextIds = new Set(selectedRowIds)
    if (checked) nextIds.add(rowId)
    else nextIds.delete(rowId)
    onSelectedRowIdsChange(Array.from(nextIds))
  }
  const handlePageSelectionChange = (checked: boolean) => {
    if (!onSelectedRowIdsChange) return
    const nextIds = new Set(selectedRowIds)
    pageRowIds.forEach((rowId) => (checked ? nextIds.add(rowId) : nextIds.delete(rowId)))
    onSelectedRowIdsChange(Array.from(nextIds))
  }

  return {
    activePageSize,
    allPageRowsSelected,
    currentPage,
    getResolvedRowId,
    handlePageSelectionChange,
    handlePageSizeChange,
    handleRowSelectionChange,
    handleSort,
    isSelectable,
    paginatedData,
    selectedRowIdSet,
    somePageRowsSelected,
    sort,
    sortedData,
    totalPages,
    setPage,
  }
}
