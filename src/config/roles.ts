export const ROLES = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  FRONT_DESK: 'front_desk',
} as const

export const USER_ROLES = [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.FRONT_DESK] as const

export type UserRole = (typeof USER_ROLES)[number]

export const DEFAULT_ROLE: UserRole = ROLES.FRONT_DESK

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && USER_ROLES.includes(role as UserRole)
}
