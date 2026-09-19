import { NextResponse } from 'next/server'

import { ACTIONS } from '@/modules/users/roles'
import { authorizeRoute, getUsersMetrics } from '@/modules/users/services/server'
import { errorResponse } from '@/modules/users/services/routeErrors'

export async function GET(request: Request) {
  try {
    const auth = await authorizeRoute(request, ACTIONS.USERS_READ)
    if ('response' in auth) return auth.response

    return NextResponse.json(await getUsersMetrics())
  } catch (error) {
    return errorResponse(error)
  }
}
