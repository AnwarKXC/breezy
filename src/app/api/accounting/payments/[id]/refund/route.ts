import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { refundPayment } from '@/modules/accounting/services'
import { AccountingReasonSchema, zodErrorMessage } from '@/shared/validation'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.PAYMENTS_REFUND, async () => {
    const { id } = await params
    const parsed = AccountingReasonSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await refundPayment(id, parsed.data.reason ?? undefined)
    return NextResponse.json({ data, message: 'Payment refunded' })
  })
}
