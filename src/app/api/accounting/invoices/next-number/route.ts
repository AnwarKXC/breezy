import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getNextInvoiceNumber } from '@/modules/accounting/services'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const data = await getNextInvoiceNumber()
    return NextResponse.json({ data })
  })
}
