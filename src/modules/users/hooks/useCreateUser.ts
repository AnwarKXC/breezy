'use client'

import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { CreateStaffUserInput } from '../services/authTypes'
import {
  createUser as createUserThunk,
  selectUsersError,
  selectUsersLoading,
} from '../store'

export function useCreateUser() {
  const dispatch = useAppDispatch()
  const loading = useAppSelector(selectUsersLoading)
  const error = useAppSelector(selectUsersError)

  const createUser = useCallback(
    (input: CreateStaffUserInput) => dispatch(createUserThunk(input)).unwrap(),
    [dispatch],
  )

  return { createUser, loading, error }
}

export default useCreateUser
