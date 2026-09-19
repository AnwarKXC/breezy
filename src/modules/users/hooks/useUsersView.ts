'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { USER_ROLES, USERS_PAGE_SIZE, USERS_PAGE_SIZE_OPTIONS } from '../utils/userUi'
import type { CreateStaffUserInput } from '../services/authTypes'
import type { UpdateUserInput, UserRole } from '../types'
import { fetchUsers as fetchUsersPage, fetchUsersMetrics } from '../services/usersApiClient'
import { useUsers } from './useUsers'
import { fetchUsers as fetchUsersThunk } from '../store'
import { useAppDispatch } from '@/store/hooks'
import type { UsersPage } from '../types'

type UsersViewMode = 'row' | 'grid'
type RoleFilter = UserRole | 'all'

export function useUsersView(initialData?: UsersPage) {
  const dispatch = useAppDispatch()
  const usersState = useUsers({ autoFetch: false })
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')
  const [view, setView] = useState<UsersViewMode>('row')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(USERS_PAGE_SIZE)
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined])
  const [metrics, setMetrics] = useState(() => {
    const counts = { total: 0 } as Record<UserRole | 'total', number>
    USER_ROLES.forEach((userRole) => {
      counts[userRole] = 0
    })
    return counts
  })
  const cursor = cursorStack[page - 1]
  const { createUser: createUserThunk, deleteUser: deleteUserThunk, fetchUsers, hasMore, nextCursor, total, updateUser: updateUserThunk, users } = usersState
  const debouncedQuery = useDebounce(query.trim(), 300)
  const totalPages = Math.max(1, Math.ceil((total ?? users.length) / pageSize))
  const [mutationVersion, setMutationVersion] = useState(0)
  const hasInitialData = useRef(!!initialData)

  useEffect(() => {
    if (initialData) {
      dispatch(fetchUsersThunk.fulfilled(initialData, '', undefined))
    }
  }, [dispatch, initialData])

  useEffect(() => {
    if (hasInitialData.current) {
      hasInitialData.current = false
      return
    }
    void fetchUsers({
      cursor,
      limit: pageSize,
      role,
      search: debouncedQuery || undefined,
    }).catch(() => undefined)
  }, [cursor, debouncedQuery, fetchUsers, pageSize, role])

  const refreshMetrics = useCallback(() => {
    void fetchUsersMetrics()
      .then(setMetrics)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshMetrics()
  }, [mutationVersion, refreshMetrics])

  const createUser = useCallback(async (input: CreateStaffUserInput) => {
    const result = await createUserThunk(input)
    setMutationVersion((v) => v + 1)
    return result
  }, [createUserThunk])

  const updateUser = useCallback(async (input: UpdateUserInput) => {
    const result = await updateUserThunk(input)
    setMutationVersion((v) => v + 1)
    return result
  }, [updateUserThunk])

  const deleteUser = useCallback(async (id: string) => {
    const result = await deleteUserThunk(id)
    setMutationVersion((v) => v + 1)
    return result
  }, [deleteUserThunk])

  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    setCursorStack([undefined])
    setPage(1)
  }, [])

  const updateRole = useCallback((value: RoleFilter) => {
    setRole(value)
    setCursorStack([undefined])
    setPage(1)
  }, [])

  const updatePageSize = useCallback((value: number) => {
    const safeValue = USERS_PAGE_SIZE_OPTIONS.includes(
      value as (typeof USERS_PAGE_SIZE_OPTIONS)[number],
    )
      ? value
      : USERS_PAGE_SIZE

    setPageSize(safeValue)
    setCursorStack([undefined])
    setPage(1)
  }, [])

  const nextPage = useCallback(() => {
    if (!hasMore || !nextCursor) return
    setCursorStack((current) => {
      const next = current.slice(0, page)
      next[page] = nextCursor ?? undefined
      return next
    })
    setPage((current) => current + 1)
  }, [hasMore, nextCursor, page])

  const previousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1))
  }, [])

  const goToPage = useCallback(async (nextPageNumber: number) => {
    if (nextPageNumber < 1 || nextPageNumber > totalPages) return

    const nextCursors = cursorStack.slice()
    while (nextCursors.length < nextPageNumber) {
      const lastKnownPage = nextCursors.length
      const cursorForNextPage =
        lastKnownPage === page
          ? nextCursor
          : (
              await fetchUsersPage({
                cursor: nextCursors[lastKnownPage - 1],
                limit: pageSize,
                role,
                search: debouncedQuery || undefined,
              })
            ).nextCursor

      if (!cursorForNextPage) return
      nextCursors[lastKnownPage] = cursorForNextPage
    }

    setCursorStack(nextCursors)
    setPage(nextPageNumber)
  }, [cursorStack, debouncedQuery, nextCursor, page, pageSize, role, totalPages])

  return {
    ...usersState,
    createUser,
    deleteUser,
    updateUser,
    query,
    role,
    view,
    page,
    pageSize,
    pageSizeOptions: USERS_PAGE_SIZE_OPTIONS,
    totalPages,
    knownPages: cursorStack.length,
    metrics,
    canNext: hasMore && Boolean(nextCursor),
    canPrevious: page > 1,
    pageUsers: users,
    nextPage,
    previousPage,
    goToPage,
    setQuery: updateQuery,
    setRole: updateRole,
    setPageSize: updatePageSize,
    setView,
  }
}
