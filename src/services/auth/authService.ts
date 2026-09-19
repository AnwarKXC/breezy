import 'client-only'

import {
  clearSession,
  createSession,
  getCurrentSession,
  subscribeAuthSession,
} from './sessionService'
import {
  type AuthSession,
  type AuthenticatedUser,
  type LoginCredentials,
  toAuthServiceError,
} from './types'

export async function login(email: LoginCredentials['email'], password: LoginCredentials['password']): Promise<AuthSession> {
  try {
    return await createSession({ email, password })
  } catch (error) {
    throw toAuthServiceError(error, 'auth/login_failed')
  }
}

export async function logout(): Promise<void> {
  try {
    await clearSession()
  } catch (error) {
    throw toAuthServiceError(error, 'auth/logout_failed')
  }
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getCurrentSession().catch(() => null)
  return session?.user ?? null
}

export { getCurrentSession, subscribeAuthSession }

export const authService = {
  login,
  logout,
  getCurrentUser,
  getCurrentSession,
  subscribeAuthSession,
}

export default authService
