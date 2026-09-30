import 'server-only'

import { ROLES } from '@/config/rbac'
import { prisma } from '@/services/db/prisma'
import { invalidateUserSessionCache } from '@/services/auth/sessionStore'
import type { UpdateUserInput, User } from '../types'
import { tryLogUserActivity } from './activityLogService'
import { AuthServiceError, toAuthServiceError } from './authErrors'
import type { CreateStaffUserInput } from './authTypes'
import { requireUsersCreate, requireUsersDelete, requireUsersRead, requireUsersUpdate } from './serviceSecurity'
import { createAuthUserDocument } from './userCreateStore'
import { syncAuthUser } from './userAuthSync'
import { mapProfileRow } from './userMapper'
import { guarded } from './userStore'

export { getUsers, getUsersMetrics, getUsersPage } from './userQueryService'

// Only admins may grant the admin role or change/delete an admin account;
// otherwise any role with users:* permissions could escalate to admin.
function assertCanManageAdmins(actor: { role: string }, ...roles: (string | undefined)[]) {
  if (actor.role !== ROLES.ADMIN && roles.includes(ROLES.ADMIN)) {
    throw new AuthServiceError('auth/permission_denied')
  }
}

async function findActiveProfile(id: string) {
  const profile = await prisma.profiles.findFirst({ where: { id, deleted_at: null } })
  if (!profile) throw new AuthServiceError('auth/user_not_found')
  return mapProfileRow(profile)
}

export async function createUser(input: CreateStaffUserInput): Promise<User> {
  const actor = await requireUsersCreate()
  assertCanManageAdmins(actor, input.role)
  return guarded('auth/create_staff_failed', async () => {
    const user = await createAuthUserDocument(input).catch((error) => {
      throw toAuthServiceError(error, 'auth/create_staff_failed')
    })
    await tryLogUserActivity({ action: 'user_created', actor, target: user })
    return user
  })
}

export async function getUserById(id: string): Promise<User | null> {
  await requireUsersRead()
  return guarded('auth/users_fetch_failed', () => findActiveProfile(id))
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  const actor = await requireUsersUpdate()
  return guarded('auth/user_update_failed', async () => {
    const { id, name, password, phone, role } = input

    if (actor.id === id) {
      throw new AuthServiceError('auth/cannot_modify_own_account')
    }

    if (password && password.length < 8) {
      throw new AuthServiceError('auth/invalid_form')
    }

    const target = await findActiveProfile(id)
    assertCanManageAdmins(actor, role, target.role)

    await syncAuthUser(id, { name, phone, role, password })

    const user = await findActiveProfile(id)
    await tryLogUserActivity({ action: 'user_updated', actor, target: user })
    return user
  })
}

export async function deleteUser(id: string) {
  const actor = await requireUsersDelete()
  if (actor.id === id) {
    throw new AuthServiceError('auth/cannot_delete_own_account')
  }
  await guarded('auth/user_delete_failed', async () => {
    const user = await findActiveProfile(id)
    assertCanManageAdmins(actor, user.role)

    // Soft delete: keep the rows for audit history, block sign-in, end sessions.
    await prisma.$transaction([
      prisma.profiles.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: new Date() } }),
      prisma.users.update({ where: { id }, data: { is_active: false, updated_at: new Date() } }),
      prisma.sessions.deleteMany({ where: { user_id: id } }),
    ])
    invalidateUserSessionCache(id)

    await tryLogUserActivity({ action: 'user_deleted', actor, target: user })
  })
}
