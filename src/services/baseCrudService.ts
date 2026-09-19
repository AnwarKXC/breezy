export interface ListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export const DEFAULT_LIST_LIMIT = 100
export const MAX_LIST_LIMIT = 500

export function safeListLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIST_LIMIT
  return Math.min(limit, MAX_LIST_LIMIT)
}
