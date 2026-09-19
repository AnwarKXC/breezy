import { ACTIONS, canPerformAction } from '@/config/rbac'
import { AuthAccessError, getCurrentServerSession } from '@/services/auth/serverSession'
import { LogServiceError } from './logServiceError'

export async function requireLogsRead() {
  const session = await getCurrentServerSession().catch((error) => {
    if (error instanceof AuthAccessError) {
      throw new LogServiceError('logs/invalid_session')
    }
    throw error
  })
  if (!canPerformAction(session.role, ACTIONS.LOGS_READ)) {
    throw new LogServiceError('logs/permission_denied')
  }
  return session
}
