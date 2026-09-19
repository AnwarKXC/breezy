'use client'

import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { CreateStaffUserInput } from '../services/authTypes'
import {
  clearUsersError,
  createUser as createUserThunk,
  deleteUser as deleteUserThunk,
  fetchUsers as fetchUsersThunk,
  selectUsers,
  selectUsersError,
  selectUsersHasMore,
  selectUsersLastFetchedAt,
  selectUsersLoading,
  selectUsersNextCursor,
  selectUsersTotal,
  updateUser as updateUserThunk,
} from '../store'
import type { UpdateUserInput, UsersListParams } from '../types'

interface UseUsersOptions {
  autoFetch?: boolean
}

export function useUsers(options: UseUsersOptions = {}) {
  const { autoFetch = true } = options
  const dispatch = useAppDispatch()
  const users = useAppSelector(selectUsers)
  const loading = useAppSelector(selectUsersLoading)
  const error = useAppSelector(selectUsersError)
  const hasMore = useAppSelector(selectUsersHasMore)
  const lastFetchedAt = useAppSelector(selectUsersLastFetchedAt)
  const nextCursor = useAppSelector(selectUsersNextCursor)
  const total = useAppSelector(selectUsersTotal)

  const fetchUsers = useCallback((input?: UsersListParams) => {
    return dispatch(fetchUsersThunk(input ?? {})).unwrap()
  }, [dispatch])

  const createUser = useCallback(
    (input: CreateStaffUserInput) => dispatch(createUserThunk(input)).unwrap(),
    [dispatch],
  )

  const updateUser = useCallback(
    (input: UpdateUserInput) => dispatch(updateUserThunk(input)).unwrap(),
    [dispatch],
  )

  const deleteUser = useCallback(
    (id: string) => dispatch(deleteUserThunk(id)).unwrap(),
    [dispatch],
  )

  const clearError = useCallback(() => {
    dispatch(clearUsersError())
  }, [dispatch])

  useEffect(() => {
    if (!autoFetch) return

    void fetchUsers().catch(() => undefined)
  }, [autoFetch, fetchUsers])

  return {
    users,
    loading,
    error,
    hasMore,
    lastFetchedAt,
    nextCursor,
    total,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    clearError,
  }
}

export default useUsers
