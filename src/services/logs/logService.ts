import 'server-only'

import { after } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import type { log_action, log_module } from '@/generated/prisma/enums'
import { prisma } from '@/services/db/prisma'
import { dbTimestamp, toRows } from '@/services/db/rows'
import {
  decodeCursor,
  encodeCursor,
  getPageLimit,
  requireTimestampCursorValue,
} from '@/shared/pagination/cursor'
import {
  type CreateLogDocumentInput,
  type LogFilters,
  type LogsPage,
} from '@/types/logs'
import { withActorProfileNames } from './logActorNames'
import { jsonObject, mapLogRow } from './logRows'
import { sanitizeLogData } from './logSanitizer'
import { requireLogsRead } from './logAccess'
import { LogServiceError } from './logServiceError'
import { createdAtToIso, timestampToIso } from './logTime'

const DEFAULT_LOGS_LIMIT = 25
const MAX_LOGS_LIMIT = 100
export { LogServiceError } from './logServiceError'

function pageLimit(limit?: number) {
  try {
    return getPageLimit(limit, DEFAULT_LOGS_LIMIT, MAX_LOGS_LIMIT)
  } catch {
    throw new Error('logs/invalid_limit')
  }
}

export async function createLog(logData: CreateLogDocumentInput): Promise<void> {
  after(async () => {
    try {
      await prisma.audit_logs.create({
        data: {
          action: logData.action as log_action,
          actor: jsonObject(sanitizeLogData(logData.actor)) as Prisma.InputJsonValue,
          created_at: dbTimestamp(createdAtToIso(logData.createdAt)) ?? undefined,
          description: logData.description,
          metadata: logData.metadata ? (jsonObject(sanitizeLogData(logData.metadata)) as Prisma.InputJsonValue) : undefined,
          module: logData.module as log_module,
          target: logData.target ? (jsonObject(sanitizeLogData(logData.target)) as Prisma.InputJsonValue) : undefined,
        },
      })
    } catch (error) {
      console.error('[logs/createLog] unexpected error:', error)
    }
  })
}

export async function getLogs(filters: LogFilters = {}): Promise<LogsPage> {
  try {
    await requireLogsRead()
    const limit = pageLimit(filters.limit)

    const where: Prisma.audit_logsWhereInput = {}
    if (filters.action) where.action = filters.action as log_action
    if (filters.module) where.module = filters.module as log_module
    if (filters.userId) where.actor = { path: ['id'], equals: filters.userId }
    if (filters.fromDate || filters.toDate) {
      where.created_at = {
        ...(filters.fromDate ? { gte: filters.fromDate } : {}),
        ...(filters.toDate ? { lte: filters.toDate } : {}),
      }
    }

    let cursorWhere: Prisma.audit_logsWhereInput | undefined
    if (filters.cursor) {
      const cursor = decodeCursor(filters.cursor)
      const cursorAt = new Date(timestampToIso(requireTimestampCursorValue(cursor.value)))
      cursorWhere = { OR: [{ created_at: { lt: cursorAt } }, { created_at: cursorAt, id: { lt: cursor.id } }] }
    }

    const [data, count] = await Promise.all([
      prisma.audit_logs.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      prisma.audit_logs.count({ where }),
    ])

    const rows = toRows('audit_logs', data)
    const logs = await withActorProfileNames(rows.slice(0, limit).map(mapLogRow))
    const lastLog = logs.at(-1)
    const hasMore = rows.length > limit

    return {
      data: logs,
      hasMore,
      total: count,
      nextCursor:
        hasMore && lastLog
          ? encodeCursor({
              id: lastLog.id,
              value: {
                nanoseconds: lastLog.createdAt.nanoseconds,
                seconds: lastLog.createdAt.seconds,
              },
            })
          : null,
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('logs/invalid_')) throw error
    if (error instanceof Error && error.message === 'pagination/invalid_cursor') {
      throw new Error('logs/invalid_cursor')
    }
    if (error instanceof LogServiceError) throw error
    throw new LogServiceError('logs/fetch_failed')
  }
}

export function getLogsByUser(userId: string, filters: Omit<LogFilters, 'userId'> = {}) {
  return getLogs({ ...filters, userId })
}
