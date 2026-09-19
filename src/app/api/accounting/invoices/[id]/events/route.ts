import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getInvoiceEvents } from '@/modules/accounting/services'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const { id } = await params
    const data = await getInvoiceEvents(id)
    return NextResponse.json({ data })
  })
}
