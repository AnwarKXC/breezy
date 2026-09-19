import type { LogsCursor, LogsFilters } from '../types'
import { fetchLogsPage } from '../services/logsApiClient'

interface ResolveLogsPageCursorsInput {
  cursorStack: Array<LogsCursor | undefined>
  filters: LogsFilters
  page: number
  pageSize: number
  stateNextCursor: LogsCursor | null
  targetPage: number
  totalPages: number
}

export async function resolveLogsPageCursors({
  cursorStack,
  filters,
  page,
  pageSize,
  stateNextCursor,
  targetPage,
  totalPages,
}: ResolveLogsPageCursorsInput) {
  if (targetPage < 1 || targetPage > totalPages) return null

  const nextCursors = cursorStack.slice()
  while (nextCursors.length < targetPage) {
    const lastKnownPage = nextCursors.length
    const nextCursor =
      lastKnownPage === page
        ? stateNextCursor
        : (
            await fetchLogsPage({
              cursor: nextCursors[lastKnownPage - 1],
              filters,
              limit: pageSize,
            })
          ).nextCursor

    if (!nextCursor) break
    nextCursors[lastKnownPage] = nextCursor
  }

  return targetPage > nextCursors.length ? null : nextCursors
}
