import 'server-only'

import { NextResponse } from 'next/server'

import { ACTIONS, canPerformAction, type Permission } from '../roles'
import { AuthServiceError } from './authErrors'
import { getCurrentSession, type VerifiedSession } from './authSession'

export async function requirePermission(permission: Permission) {
  const session = await getCurrentSession()

  if (!canPerformAction(session.role, permission)) {
    throw new AuthServiceError('auth/permission_denied')
  }

  return session
}

export async function requireActionPermission(permission: Permission) {
  return requirePermission(permission)
}

export async function authorizeRoute(_request: Request, permission: Permission) {
  try {
    const session = await getCurrentSession()

    if (!canPerformAction(session.role, permission)) {
      return { response: NextResponse.json(null, { status: 403 }) }
    }

    return { session }
  } catch {
    return { response: NextResponse.json(null, { status: 401 }) }
  }
}

export function canAccess(session: VerifiedSession, permission: Permission) {
  return canPerformAction(session.role, permission)
}

export function getUsersUiPermissions(session: VerifiedSession) {
  return {
    canCreateUsers: canAccess(session, ACTIONS.USERS_CREATE),
    canDeleteUsers: canAccess(session, ACTIONS.USERS_DELETE),
    canUpdateUsers: canAccess(session, ACTIONS.USERS_UPDATE),
  }
}
