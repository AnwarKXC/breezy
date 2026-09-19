import 'server-only'

import { ACTIONS } from '../roles'
import { requireActionPermission } from './authorization'

export function requireUsersRead() {
  return requireActionPermission(ACTIONS.USERS_READ)
}

export function requireUsersCreate() {
  return requireActionPermission(ACTIONS.USERS_CREATE)
}

export function requireUsersUpdate() {
  return requireActionPermission(ACTIONS.USERS_UPDATE)
}

export function requireUsersDelete() {
  return requireActionPermission(ACTIONS.USERS_DELETE)
}
