'use client'

import { useEffect } from 'react'

import {
  authService,
  isAuthServiceErrorCode,
  type AuthServiceErrorCode,
} from '@/services/auth'
import { setAuthError, setAuthInitializing, setUser } from '@/store/authSlice'
import { useAppDispatch } from '@/store/hooks'

function getAuthErrorCode(error: unknown): AuthServiceErrorCode {
  if (
    error instanceof Error &&
    'code' in error &&
    isAuthServiceErrorCode(error.code)
  ) {
    return error.code
  }

  return 'auth/session_failed'
}

export function AuthStateSync() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(setAuthInitializing(true))

    const unsubscribe = authService.subscribeAuthSession(
      (session) => {
        dispatch(setUser(session))
        dispatch(setAuthInitializing(false))
      },
      (error) => {
        dispatch(setUser(null))
        dispatch(setAuthError(getAuthErrorCode(error)))
        dispatch(setAuthInitializing(false))
      },
    )

    return unsubscribe
  }, [dispatch])

  return null
}
