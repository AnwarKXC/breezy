import 'client-only'

import {
  AuthServiceError,
  type AuthServiceErrorCode,
  type AuthSession,
  type LoginCredentials,
  toAuthServiceError,
} from './types'

type SessionListener = (session: AuthSession | null) => void

const listeners = new Set<SessionListener>()

function notify(session: AuthSession | null) {
  for (const listener of listeners) listener(session)
}

async function readError(response: Response, fallback: AuthServiceErrorCode): Promise<AuthServiceError> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  return new AuthServiceError(body?.error === 'auth/invalid_credentials' ? 'auth/invalid_credentials' : fallback)
}

export async function createSession({ email, password }: LoginCredentials): Promise<AuthSession> {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) throw await readError(response, 'auth/login_failed')

  const { session } = (await response.json()) as { session: AuthSession }
  notify(session)
  return session
}

export async function clearSession() {
  const response = await fetch('/api/auth/session', { method: 'DELETE' })
  if (!response.ok) throw new AuthServiceError('auth/logout_failed')
  notify(null)
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const response = await fetch('/api/auth/session', { cache: 'no-store' })
  if (!response.ok) throw new AuthServiceError('auth/session_failed')

  const { session } = (await response.json()) as { session: AuthSession | null }
  return session
}

export function subscribeAuthSession(
  onSession: SessionListener,
  onError: (error: AuthServiceError) => void,
) {
  listeners.add(onSession)

  void getCurrentSession()
    .then(onSession)
    .catch((error) => onError(toAuthServiceError(error, 'auth/session_failed')))

  return () => {
    listeners.delete(onSession)
  }
}
