import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getFinanceTable, getFinancialHealth } from '@/modules/accounting/services'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const dateParams = fromDate || toDate ? { fromDate: fromDate ?? undefined, toDate: toDate ?? undefined } : undefined

    if (type === 'health') {
      const data = await getFinancialHealth(dateParams)
      return NextResponse.json({ data })
    }

    const data = await getFinanceTable()
    return NextResponse.json({ data })
  })
}
