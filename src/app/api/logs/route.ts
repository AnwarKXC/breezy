import { NextResponse } from 'next/server'

import { getLogs } from '@/services/logs'
import { logErrorResponse } from '@/services/logs/routeErrors'
import { encodeCursor } from '@/shared/pagination/cursor'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS, ROLES } from '@/config/rbac'
import { LOG_ACTIONS, LOG_MODULES, type LogAction, type LogActor, type LogDocument, type LogModule, type LogTarget, type LogTimestamp, type LogsPage } from '@/types/logs'

function getEnumValue<T extends string>(value: string | null, values: Record<string, T>) {
  if (!value) return undefined
  if (Object.values(values).includes(value as T)) return value as T
  throw new Error('logs/invalid_filter')
}

function getLimit(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 0) return Math.min(parsed, 100)
  throw new Error('logs/invalid_limit')
}

function getCursor(searchParams: URLSearchParams) {
  const encodedCursor = searchParams.get('cursor')
  if (encodedCursor) return encodedCursor

  const id = searchParams.get('cursorId')
  const secondsValue = searchParams.get('cursorSeconds')
  const nanosecondsValue = searchParams.get('cursorNanoseconds')
  const hasCursor = Boolean(id || secondsValue || nanosecondsValue)

  if (!hasCursor) return undefined
  if (!id || !secondsValue || !nanosecondsValue) throw new Error('logs/invalid_cursor')

  const seconds = Number(secondsValue)
  const nanoseconds = Number(nanosecondsValue)
  if (!Number.isFinite(seconds) || !Number.isFinite(nanoseconds)) {
    throw new Error('logs/invalid_cursor')
  }
  return encodeCursor({ id, value: { nanoseconds, seconds } })
}

function getDate(value: string | null, boundary: 'end' | 'start') {
  if (!value) return undefined
  const date = new Date(value)
  if (boundary === 'end') date.setHours(23, 59, 59, 999)
  if (!Number.isNaN(date.getTime())) return date
  throw new Error('logs/invalid_filter')
}

function timestampJson(timestamp: LogTimestamp) {
  return { nanoseconds: timestamp.nanoseconds, seconds: timestamp.seconds }
}

function publicName(name: string | undefined) {
  return name && !name.includes('@') ? name : undefined
}

function publicActor(actor: LogActor) {
  const name = publicName(actor.displayName ?? actor.name)

  return {
    id: actor.id,
    ...(name ? { displayName: name, name } : {}),
  }
}

function publicTarget(target: LogTarget | undefined) {
  if (!target) return undefined

  return {
    ...(target.id ? { id: target.id } : {}),
    ...(target.type ? { type: target.type } : {}),
  }
}

// SECURITY: Exclude metadata from API response to prevent PII exposure
// metadata may contain sensitive data like emails, names, and before/after fields.
function logJson(log: LogDocument) {
  return {
    action: log.action,
    actor: publicActor(log.actor),
    createdAt: timestampJson(log.createdAt),
    description: log.description,
    id: log.id,
    module: log.module,
    target: publicTarget(log.target),
  }
}

function logsPageJson(result: LogsPage) {
  return {
    data: result.data.map(logJson),
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
    total: result.total,
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest(request, ACTIONS.LOGS_READ)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(request.url)
    // IDOR fix: Only admins can filter by arbitrary userId; non-admins are restricted to their own logs
    const requestedUserId = searchParams.get('userId') ?? undefined
    const effectiveUserId = auth.session.role === ROLES.ADMIN
      ? requestedUserId
      : (requestedUserId === auth.session.id ? requestedUserId : auth.session.id)

    const result = await getLogs({
      action: getEnumValue<LogAction>(searchParams.get('action'), LOG_ACTIONS),
      cursor: getCursor(searchParams),
      fromDate: getDate(searchParams.get('fromDate'), 'start'),
      limit: getLimit(searchParams.get('limit')),
      module: getEnumValue<LogModule>(searchParams.get('module'), LOG_MODULES),
      toDate: getDate(searchParams.get('toDate'), 'end'),
      userId: effectiveUserId,
    })

    return NextResponse.json(logsPageJson(result))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('logs/invalid_')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return logErrorResponse(error)
  }
}
