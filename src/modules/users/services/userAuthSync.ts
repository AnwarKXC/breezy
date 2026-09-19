import 'server-only'

import { prisma } from '@/services/db/prisma'
import { hashPassword } from '@/services/auth/password'
import { invalidateUserSessionCache } from '@/services/auth/sessionStore'
import type { UpdateUserInput } from '../types'
import { AuthServiceError } from './authErrors'

export async function syncAuthUser(id: string, data: Omit<UpdateUserInput, 'id'>) {
  const passwordHash = data.password ? await hashPassword(data.password) : null
  const profileData = {
    ...(data.name ? { name: data.name } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.role ? { role: data.role } : {}),
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.profiles.updateMany({
      where: { id, deleted_at: null },
      data: { ...profileData, updated_at: new Date() },
    })
    if (count === 0) throw new AuthServiceError('auth/user_not_found')

    if (passwordHash) {
      await tx.users.update({ where: { id }, data: { password_hash: passwordHash, updated_at: new Date() } })
      // A password reset signs the user out everywhere.
      await tx.sessions.deleteMany({ where: { user_id: id } })
    }
  })
  invalidateUserSessionCache(id)
}
