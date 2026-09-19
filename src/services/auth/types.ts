import type { UserRole } from '@/types/auth'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthenticatedUser {
  id: string
  email: string | null
  displayName: string | null
}

export interface AuthSession {
  user: AuthenticatedUser
  role: UserRole
}

export type AuthServiceErrorCode =
  | 'auth/invalid_credentials'
  | 'auth/invalid_role'
  | 'auth/login_failed'
  | 'auth/logout_failed'
  | 'auth/role_fetch_failed'
  | 'auth/session_failed'
  | 'auth/user_not_found'

export const AUTH_SERVICE_ERROR_CODES = [
  'auth/invalid_credentials',
  'auth/invalid_role',
  'auth/login_failed',
  'auth/logout_failed',
  'auth/role_fetch_failed',
  'auth/session_failed',
  'auth/user_not_found',
] as const satisfies readonly AuthServiceErrorCode[]

export function isAuthServiceErrorCode(code: unknown): code is AuthServiceErrorCode {
  return (
    typeof code === 'string' &&
    AUTH_SERVICE_ERROR_CODES.includes(code as AuthServiceErrorCode)
  )
}

export class AuthServiceError extends Error {
  constructor(readonly code: AuthServiceErrorCode) {
    super(code)
    this.name = 'AuthServiceError'
  }
}

export function toAuthServiceError(error: unknown, fallback: AuthServiceErrorCode) {
  if (error instanceof AuthServiceError) return error
  return new AuthServiceError(fallback)
}
