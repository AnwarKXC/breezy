import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { refundInvoice } from '@/modules/accounting/services'
import { AccountingInvoiceRefundSchema, zodErrorMessage } from '@/shared/validation'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_REFUND, async () => {
    const { id } = await params
    const parsed = AccountingInvoiceRefundSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    try {
      const data = await refundInvoice(id, parsed.data.amount, parsed.data.reason)
      return NextResponse.json({ data, message: 'Invoice refunded' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refund invoice'
      const status = message.includes('exceeds') || message.includes('already void or refunded') ? 409 : 500
      return NextResponse.json({ error: message }, { status })
    }
  })
}
