import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getExportData } from '@/modules/accounting/services'

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_REPORTS, async () => {
    const { type } = await params
    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      if (value) queryParams[key] = value
    }
    const data = await getExportData(type, queryParams)
    return NextResponse.json({ data })
  })
}
