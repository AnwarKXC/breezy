import 'server-only'
import { getCurrentServerSession, type VerifiedSession } from '@/services/auth/serverSession'
import { canPerformAction } from '@/config/rbac'
import { ACTIONS } from '@/config/rbac'
import { AuthAccessError } from '@/services/auth/serverSession'

export async function requireSettingsRead(): Promise<VerifiedSession> {
  const session = await getCurrentServerSession()
  if (!canPerformAction(session.role, ACTIONS.SETTINGS_READ)) {
    throw new AuthAccessError('auth/permission_denied')
  }
  return session
}

/**
 * Room types and prices are reference data every staff role needs (front desk
 * books rooms), so reading them only requires rooms:read.
 */
export async function requireCatalogRead(): Promise<VerifiedSession> {
  const session = await getCurrentServerSession()
  if (!canPerformAction(session.role, ACTIONS.ROOMS_READ)) {
    throw new AuthAccessError('auth/permission_denied')
  }
  return session
}

export async function requireSettingsWrite(): Promise<void> {
  const session = await getCurrentServerSession()
  if (!canPerformAction(session.role, ACTIONS.SETTINGS_WRITE)) {
    throw new AuthAccessError('auth/permission_denied')
  }
}

export function getSettingsUiPermissions(session: VerifiedSession) {
  return {
    canDeleteRooms: session.role === 'admin',
    canWriteSettings: canPerformAction(session.role, ACTIONS.SETTINGS_WRITE),
  }
}
