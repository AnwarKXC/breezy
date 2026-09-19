import {
  PERMISSIONS,
  type PermissionModule,
} from './permissions'
import {
  ROLE_PERMISSIONS,
  type ActionPermission,
} from './actionPermissions'
import type { UserRole } from './roles'

export function isPermissionModule(module: unknown): module is PermissionModule {
  return typeof module === 'string' && module in PERMISSIONS
}

export function canAccessModule(role: UserRole, module: PermissionModule) {
  const allowedRoles: readonly UserRole[] = PERMISSIONS[module]

  return allowedRoles.includes(role)
}

export function getRolePermissions(role: UserRole) {
  return ROLE_PERMISSIONS[role]
}

export function canPerformAction(role: UserRole, action: ActionPermission) {
  return getRolePermissions(role).includes(action)
}

export function hasPermission(role: UserRole, permission: ActionPermission) {
  return canPerformAction(role, permission)
}

export function assertPermission(role: UserRole, permission: ActionPermission) {
  if (!canPerformAction(role, permission)) {
    throw new Error(`Permission denied: ${permission}`)
  }
}
