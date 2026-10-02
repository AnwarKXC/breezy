import 'server-only'

import { NextResponse } from 'next/server'
import { PlanLimitError } from '@/services/fleet/limits'
import { AuthServiceError } from './authErrors'

export function errorResponse(error: unknown) {
  if (error instanceof PlanLimitError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
  }
  if (error instanceof AuthServiceError) {
    const status =
      error.code === 'auth/invalid_session' ||
      error.code === 'auth/requires_authenticated_user'
        ? 401
        : error.code === 'auth/permission_denied' ||
            error.code === 'auth/cannot_modify_own_account' ||
            error.code === 'auth/cannot_delete_own_account'
          ? 403
          : error.code === 'auth/user_not_found'
            ? 404
          : error.code === 'auth/invalid_form'
            ? 400
          : error.code === 'auth/email_already_exists'
            ? 409
            : 500

    return NextResponse.json({ error: error.code }, { status })
  }

  return NextResponse.json({ error: 'auth/request_failed' }, { status: 500 })
}
