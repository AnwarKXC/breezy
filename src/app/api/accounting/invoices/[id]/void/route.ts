import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { voidInvoice } from '@/modules/accounting/services'
import { AccountingRequiredReasonSchema, zodErrorMessage } from '@/shared/validation'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_VOID, async () => {
    const { id } = await params
    const parsed = AccountingRequiredReasonSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await voidInvoice(id, parsed.data.reason)
    return NextResponse.json({ data, message: 'Invoice voided' })
  })
}
