// 📁 src/shared/table/types.ts - Shared Table types

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

export interface PaginationState {
  page: number
  limit: number
  total: number
}

export interface TableColumn<T = unknown> {
  key: keyof T | string
  label: string
  sortable?: boolean
  width?: string
  render?: (value: unknown, record: T) => React.ReactNode
}

export interface TableFilters {
  search?: string
  [key: string]: unknown
}

export interface TableState<T = unknown> {
  data: T[]
  sort: SortState
  pagination: PaginationState
  filters: TableFilters
  loading?: boolean
}

export interface UseTableOptions<T = unknown> {
  data: T[]
  columns: TableColumn<T>[]
  pageSize?: number
  defaultSort?: SortState
  onRowClick?: (row: T, event?: React.MouseEvent) => void
}