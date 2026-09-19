import 'server-only'

import { getCurrentServerSession, type VerifiedSession } from '@/services/auth/serverSession'
import { AuthServiceError } from './authErrors'

export async function getCurrentSession() {
  try {
    return await getCurrentServerSession()
  } catch {
    throw new AuthServiceError('auth/invalid_session')
  }
}

export type { VerifiedSession }
