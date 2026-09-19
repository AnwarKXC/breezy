import { isUniqueViolation } from '@/services/db/errors'

export type AuthErrorCode =
  | 'auth/invalid_credentials'
  | 'auth/invalid_form'
  | 'auth/requires_authenticated_user'
  | 'auth/login_failed'
  | 'auth/logout_failed'
  | 'auth/password_change_failed'
  | 'auth/create_staff_failed'
  | 'auth/email_already_exists'
  | 'auth/users_fetch_failed'
  | 'auth/user_update_failed'
  | 'auth/user_delete_failed'
  | 'auth/user_not_found'
  | 'auth/permission_denied'
  | 'auth/invalid_session'
  | 'auth/cannot_modify_own_account'
  | 'auth/cannot_delete_own_account'

export class AuthServiceError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code)
    this.name = 'AuthServiceError'
  }
}

export function toAuthServiceError(error: unknown, fallback: AuthErrorCode) {
  if (error instanceof AuthServiceError) {
    return error
  }

  if (isUniqueViolation(error)) {
    return new AuthServiceError('auth/email_already_exists')
  }

  return new AuthServiceError(fallback)
}
