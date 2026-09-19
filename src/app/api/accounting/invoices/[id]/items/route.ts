import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getInvoiceById, updateInvoice } from '@/modules/accounting/services'
import { AccountingInvoiceItemSchema, zodErrorMessage } from '@/shared/validation'
import { z } from 'zod'

const AddItemsSchema = z.object({
  items: z.array(AccountingInvoiceItemSchema).min(1).max(100),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_UPDATE, async () => {
    const { id } = await params
    const parsed = AddItemsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }

    const invoice = await getInvoiceById(id)
    const existingItems = invoice.items ?? []

    const mergedItems = [
      ...existingItems.map((item) => ({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount,
        tax_amount: item.taxAmount,
        total_price: item.totalPrice,
      })),
      ...parsed.data.items,
    ]

    const data = await updateInvoice(id, { items: mergedItems })
    return NextResponse.json({ data, message: 'Items added to invoice' })
  })
}
