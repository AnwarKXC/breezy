import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getInvoiceFormLookups } from '@/modules/accounting/services'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const data = await getInvoiceFormLookups()
    return NextResponse.json({ data })
  })
}
