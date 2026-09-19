import 'server-only'

import { USER_ROLES } from '@/config/rbac'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { decodeCursor, encodeCursor, getPageLimit, requireStringCursorValue } from '@/shared/pagination/cursor'
import type { User, UserRole, UsersListParams, UsersMetrics, UsersPage } from '../types'
import { AuthServiceError } from './authErrors'
import { requireUsersRead } from './serviceSecurity'
import { mapProfileRow } from './userMapper'
import { guarded } from './userStore'

const DEFAULT_USERS_LIMIT = 20
const MAX_USERS_LIMIT = 50

function pageLimit(limit?: number) {
  try {
    return getPageLimit(limit, DEFAULT_USERS_LIMIT, MAX_USERS_LIMIT)
  } catch {
    throw new AuthServiceError('auth/invalid_form')
  }
}

function timestampIso(user: User) {
  return new Date(user.createdAt.seconds * 1000 + Math.floor(user.createdAt.nanoseconds / 1000000)).toISOString()
}

export async function getUsersPage(params: UsersListParams = {}): Promise<UsersPage> {
  await requireUsersRead()
  return guarded('auth/users_fetch_failed', async () => {
    const limit = pageLimit(params.limit)
    const search = params.search?.trim()

    const filter: Prisma.profilesWhereInput = { deleted_at: null }
    if (params.role && params.role !== 'all') filter.role = params.role
    if (search) {
      filter.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    let cursorFilter: Prisma.profilesWhereInput | undefined
    if (params.cursor) {
      const cursor = decodeCursor(params.cursor)
      const cursorValue = requireStringCursorValue(cursor.value)
      cursorFilter = search
        ? { OR: [{ name: { gt: cursorValue } }, { name: cursorValue, id: { gt: cursor.id } }] }
        : {
            OR: [
              { created_at: { lt: new Date(cursorValue) } },
              { created_at: new Date(cursorValue), id: { lt: cursor.id } },
            ],
          }
    }

    const orderBy: Prisma.profilesOrderByWithRelationInput[] = search
      ? [{ name: 'asc' }, { id: 'asc' }]
      : [{ created_at: 'desc' }, { id: 'desc' }]

    const [rows, total] = await Promise.all([
      prisma.profiles.findMany({
        where: cursorFilter ? { AND: [filter, cursorFilter] } : filter,
        orderBy,
        take: limit + 1,
      }),
      prisma.profiles.count({ where: filter }),
    ])

    const users = rows.slice(0, limit).map(mapProfileRow)
    const lastUser = users.at(-1)
    const hasMore = rows.length > limit

    return {
      data: users,
      hasMore,
      total,
      nextCursor:
        hasMore && lastUser
          ? encodeCursor({
              id: lastUser.id,
              value: search ? String(lastUser.name ?? '') : timestampIso(lastUser),
            })
          : null,
    }
  })
}

export async function getUsersMetrics(): Promise<UsersMetrics> {
  await requireUsersRead()
  return guarded('auth/users_fetch_failed', async () => {
    const metrics = { total: 0 } as UsersMetrics
    USER_ROLES.forEach((role) => {
      metrics[role] = 0
    })

    const groups = await prisma.profiles.groupBy({
      by: ['role'],
      where: { deleted_at: null },
      _count: { _all: true },
    })

    for (const group of groups) {
      metrics[group.role as UserRole] = group._count._all
      metrics.total += group._count._all
    }

    return metrics
  })
}

export async function getUsers(): Promise<User[]> {
  const page = await getUsersPage()
  return page.data
}
