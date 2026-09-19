import 'server-only'

import { prisma } from '@/services/db/prisma'
import { hashPassword } from '@/services/auth/password'
import type { User } from '../types'
import type { CreateStaffUserInput } from './authTypes'
import { mapProfileRow } from './userMapper'

export async function createAuthUserDocument(input: CreateStaffUserInput): Promise<User> {
  const email = input.email.trim().toLowerCase()
  const passwordHash = await hashPassword(input.password)

  const profile = await prisma.$transaction(async (tx) => {
    const user = await tx.users.create({ data: { email, password_hash: passwordHash } })
    return tx.profiles.create({
      data: {
        id: user.id,
        name: input.name,
        email,
        phone: input.phone,
        role: input.role,
      },
    })
  })

  return mapProfileRow(profile)
}
