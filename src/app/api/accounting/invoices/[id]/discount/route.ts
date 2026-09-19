import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { applyInvoiceDiscount } from '@/modules/accounting/services'
import { AccountingInvoiceDiscountSchema, zodErrorMessage } from '@/shared/validation'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_ADJUST, async () => {
    const { id } = await params
    const parsed = AccountingInvoiceDiscountSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await applyInvoiceDiscount(id, parsed.data.amount, parsed.data.reason)
    return NextResponse.json({ data, message: 'Discount applied' })
  })
}
