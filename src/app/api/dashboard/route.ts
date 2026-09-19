import { NextResponse } from 'next/server'
import { getDashboardData } from '@/modules/dashboard/services/dashboardService'
import { ACTIONS } from '@/config/rbac'
import { authorizeRequest } from '@/shared/routeAuth'

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest(request, ACTIONS.DASHBOARD_READ)
    if ('response' in auth) return auth.response

    const data = await getDashboardData()
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'dashboard/fetch_failed' },
      { status: 500 },
    )
  }
}
