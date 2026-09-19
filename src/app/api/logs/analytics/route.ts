import { NextResponse } from 'next/server'

import { getLogsAnalytics } from '@/services/logs'
import { logErrorResponse } from '@/services/logs/routeErrors'
import { authorizeRequest } from '@/shared/routeAuth'
import { ACTIONS, ROLES } from '@/config/rbac'
import { LOG_ACTIONS, LOG_MODULES, type LogAction, type LogModule } from '@/types/logs'

function getEnumValue<T extends string>(value: string | null, values: Record<string, T>) {
  if (!value) return undefined
  if (Object.values(values).includes(value as T)) return value as T
  throw new Error('logs/invalid_filter')
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest(request, ACTIONS.LOGS_READ)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(request.url)
    // IDOR fix: Only admins can filter by arbitrary userId
    const requestedUserId = searchParams.get('userId') ?? undefined
    const effectiveUserId = auth.session.role === ROLES.ADMIN
      ? requestedUserId
      : (requestedUserId === auth.session.id ? requestedUserId : auth.session.id)

    const result = await getLogsAnalytics({
      action: getEnumValue<LogAction>(searchParams.get('action'), LOG_ACTIONS),
      module: getEnumValue<LogModule>(searchParams.get('module'), LOG_MODULES),
      userId: effectiveUserId,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'logs/invalid_filter') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return logErrorResponse(error)
  }
}
