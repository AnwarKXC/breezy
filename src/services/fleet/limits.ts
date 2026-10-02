import 'server-only'

import { lockPlanLimit } from '@/generated/prisma/sql'
import type { DbTransaction } from '@/services/db/prisma'
import { getLicenseStatus } from './license'

// Plan limits from the signed license (max rooms / users), checked inside the same
// transaction as the insert. Unlimited when the license sets no limit or the
// instance is unmanaged.

export class PlanLimitError extends Error {
  constructor(
    readonly code: 'license/room_limit' | 'license/user_limit',
    readonly limit: number,
  ) {
    super(
      code === 'license/room_limit'
        ? `Room limit reached: your plan allows ${limit} rooms. Contact your provider to raise it.`
        : `User limit reached: your plan allows ${limit} active users. Contact your provider to raise it.`,
    )
  }
}

export async function assertRoomCapacity(tx: DbTransaction, adding = 1) {
  const { maxRooms } = (await getLicenseStatus()).limits
  if (maxRooms === null) return
  await tx.$queryRawTyped(lockPlanLimit('plan_limit:rooms'))
  const rooms = await tx.rooms.count({ where: { deleted_at: null } })
  if (rooms + adding > maxRooms) throw new PlanLimitError('license/room_limit', maxRooms)
}

export async function assertUserCapacity(tx: DbTransaction, adding = 1) {
  const { maxUsers } = (await getLicenseStatus()).limits
  if (maxUsers === null) return
  await tx.$queryRawTyped(lockPlanLimit('plan_limit:users'))
  const users = await tx.users.count({ where: { is_active: true } })
  if (users + adding > maxUsers) throw new PlanLimitError('license/user_limit', maxUsers)
}
