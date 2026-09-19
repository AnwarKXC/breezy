import 'server-only'

import { NextResponse } from 'next/server'
import { canPerformAction, type ActionPermission } from '@/config/rbac'
import { AuthAccessError, getCurrentServerSession } from '@/services/auth/serverSession'
import type { VerifiedSession } from '@/services/auth/serverSession'

export type AuthResult =
  | { response: NextResponse; session?: undefined }
  | { session: VerifiedSession; response?: undefined }

export async function authorizeRequest(_request: Request, action: ActionPermission): Promise<AuthResult> {
  try {
    const session = await getCurrentServerSession()

    if (!canPerformAction(session.role, action)) {
      return { response: NextResponse.json(null, { status: 403 }) }
    }
    return { session }
  } catch (error) {
    // Auth/session problems are 401; upstream (database/network) failures are 503 so
    // clients can distinguish "log in again" from "try again".
    if (error instanceof AuthAccessError) {
      return { response: NextResponse.json(null, { status: 401 }) }
    }
    return { response: NextResponse.json(null, { status: 503 }) }
  }
}
