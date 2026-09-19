import 'server-only'

import { ACTIONS, canPerformAction } from '@/config/rbac'
import {
  AuthAccessError,
  getCurrentServerSession,
  type VerifiedSession,
} from '@/services/auth/serverSession'

async function requireActionPermission(action: (typeof ACTIONS)[keyof typeof ACTIONS]) {
  const session = await getCurrentServerSession()

  if (!canPerformAction(session.role, action)) {
    throw new AuthAccessError('auth/permission_denied')
  }

  return session
}

export function requireContactsRead() {
  return requireActionPermission(ACTIONS.CONTACTS_READ)
}

export function requireContactsCreate() {
  return requireActionPermission(ACTIONS.CONTACTS_CREATE)
}

export function requireContactsUpdate() {
  return requireActionPermission(ACTIONS.CONTACTS_UPDATE)
}

export function requireContactsDelete() {
  return requireActionPermission(ACTIONS.CONTACTS_DELETE)
}

export function requirePriceOverridesUpdate() {
  return requireActionPermission(ACTIONS.CONTACTS_PRICE_OVERRIDES_UPDATE)
}

export function getContactsUiPermissions(session: VerifiedSession) {
  return {
    canCreateContacts: canPerformAction(session.role, ACTIONS.CONTACTS_CREATE),
    canDeleteContacts: canPerformAction(session.role, ACTIONS.CONTACTS_DELETE),
    canUpdateContacts: canPerformAction(session.role, ACTIONS.CONTACTS_UPDATE),
    canUpdatePriceOverrides: canPerformAction(session.role, ACTIONS.CONTACTS_PRICE_OVERRIDES_UPDATE),
  }
}
