import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getAccountingOverview } from '@/modules/accounting/services'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const data = await getAccountingOverview()
    return NextResponse.json({ data })
  })
}
