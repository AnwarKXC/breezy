import 'server-only'

import { NextResponse } from 'next/server'
import { AuthServiceError } from './authErrors'

export function errorResponse(error: unknown) {
  if (error instanceof AuthServiceError) {
    const status =
      error.code === 'auth/invalid_session' ||
      error.code === 'auth/requires_authenticated_user'
        ? 401
        : error.code === 'auth/permission_denied'
          ? 403
          : error.code === 'auth/email_already_exists'
            ? 409
            : 500

    return NextResponse.json({ error: error.code }, { status })
  }

  return NextResponse.json({ error: 'auth/request_failed' }, { status: 500 })
}
