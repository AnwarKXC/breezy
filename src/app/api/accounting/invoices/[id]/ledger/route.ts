import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getInvoiceLedger } from '@/modules/accounting/services'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.LEDGER_READ, async () => {
    const { id } = await params
    const data = await getInvoiceLedger(id)
    return NextResponse.json({ data })
  })
}
