import 'server-only'

import { NextResponse } from 'next/server'
import { LogServiceError } from './logService'

export function logErrorResponse(error: unknown) {
  if (error instanceof LogServiceError) {
    const status =
      error.code === 'logs/invalid_session'
        ? 401
        : error.code === 'logs/permission_denied'
          ? 403
          : 500

    return NextResponse.json({ error: error.code }, { status })
  }

  return NextResponse.json({ error: 'logs/request_failed' }, { status: 500 })
}
