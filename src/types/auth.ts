export const USERS_COLLECTION = 'users'

export { isUserRole, USER_ROLES } from '@/config/rbac'
export type { UserRole } from '@/config/rbac'

import {
  canAccessModule,
  isPermissionModule,
  PERMISSIONS,
  type PermissionModule,
  type UserRole,
} from '@/config/rbac'

export const ROUTE_ROLE_ACCESS = PERMISSIONS

export type ProtectedRouteKey = PermissionModule

export function isProtectedRouteKey(route: unknown): route is ProtectedRouteKey {
  return isPermissionModule(route)
}

export function canRoleAccessRoute(role: UserRole, route: ProtectedRouteKey) {
  return canAccessModule(role, route)
}
