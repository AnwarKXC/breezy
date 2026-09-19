import 'server-only'

import { ACTIONS, canPerformAction } from '@/config/rbac'
import { AuthAccessError, getCurrentServerSession } from '@/services/auth/serverSession'
import type { Prisma } from '@/generated/prisma/client'
import type { log_action, log_module } from '@/generated/prisma/enums'
import { prisma } from '@/services/db/prisma'
import { type LogActor, type LogFilters, type LogsAnalytics, type LogModule } from '@/types/logs'
import { getActorProfileNames, publicProfileName } from './actorProfiles'
import { LogServiceError } from './logService'

const ANALYTICS_SAMPLE_LIMIT = 100

function todayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

async function requireLogsRead() {
  const session = await getCurrentServerSession().catch((error) => {
    if (error instanceof AuthAccessError) throw new LogServiceError('logs/invalid_session')
    throw error
  })
  if (!canPerformAction(session.role, ACTIONS.LOGS_READ)) throw new LogServiceError('logs/permission_denied')
}

function topValue<T extends string>(values: T[]) {
  const counts = values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>())
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function actorLabel(actor: unknown) {
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) return ''
  const value = actor as Partial<LogActor>
  return value.id ?? ''
}

export async function getLogsAnalytics(filters: LogFilters = {}): Promise<LogsAnalytics> {
  try {
    await requireLogsRead()
    const where: Prisma.audit_logsWhereInput = { created_at: { gte: new Date(todayStart()) } }
    if (filters.action) where.action = filters.action as log_action
    if (filters.module) where.module = filters.module as log_module
    if (filters.userId) where.actor = { path: ['id'], equals: filters.userId }

    const [data, count] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        select: { actor: true, module: true },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: ANALYTICS_SAMPLE_LIMIT,
      }),
      prisma.audit_logs.count({ where }),
    ])
    const actorIds = data.map((log) => actorLabel(log.actor)).filter(Boolean)
    const namesById = await getActorProfileNames(actorIds)
    const actorLabels = actorIds.map((id) => publicProfileName(namesById.get(id)) ?? id)

    return {
      mostActiveUser: topValue(actorLabels) ?? '',
      mostUsedModule: topValue(data.map((log) => log.module as LogModule)),
      totalActionsToday: count,
    }
  } catch (error) {
    if (error instanceof LogServiceError) throw error
    throw new LogServiceError('logs/fetch_failed')
  }
}
