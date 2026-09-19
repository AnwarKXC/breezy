export interface PaginationParams {
  cursor?: string | null
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  nextCursor: string | null
  total?: number
}
