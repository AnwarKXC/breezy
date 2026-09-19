import type { DashboardApiResponse } from './dashboardService'

export async function fetchDashboardData(): Promise<DashboardApiResponse> {
  try {
    const response = await fetch('/api/dashboard', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load dashboard data')
    const body = await response.json()
    return body.data as DashboardApiResponse
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Failed to load dashboard data')
  }
}
