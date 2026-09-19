'use client'

import { useCallback } from 'react'

import {
  clearAuthError,
  login as loginThunk,
  logout as logoutThunk,
  selectAuthError,
  selectAuthInitializing,
  selectAuthLoading,
  selectAuthRole,
  selectAuthState,
  selectAuthUser,
  selectIsAuthenticated,
  setUser,
} from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { AuthSession, LoginCredentials } from '@/services/auth'

export function useAuth() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuthState)
  const user = useAppSelector(selectAuthUser)
  const role = useAppSelector(selectAuthRole)
  const loading = useAppSelector(selectAuthLoading)
  const initializing = useAppSelector(selectAuthInitializing)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const error = useAppSelector(selectAuthError)

  const login = useCallback(
    (credentials: LoginCredentials) => dispatch(loginThunk(credentials)).unwrap(),
    [dispatch],
  )

  const logout = useCallback(
    () => dispatch(logoutThunk()).unwrap(),
    [dispatch],
  )

  const setSession = useCallback(
    (session: AuthSession | null) => {
      dispatch(setUser(session))
    },
    [dispatch],
  )

  const clearError = useCallback(() => {
    dispatch(clearAuthError())
  }, [dispatch])

  return {
    auth,
    user,
    role,
    loading,
    initializing,
    isAuthenticated,
    error,
    login,
    logout,
    setSession,
    clearError,
  }
}

export default useAuth
