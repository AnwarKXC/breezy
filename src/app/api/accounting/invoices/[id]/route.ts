import { NextResponse } from 'next/server'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getInvoiceById, updateInvoice, deleteInvoice } from '@/modules/accounting/services'
import { AccountingInvoiceUpdateSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const { id } = await params
    const data = await getInvoiceById(id)
    return NextResponse.json({ data })
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_UPDATE, async () => {
    const { id } = await params
    const parsed = AccountingInvoiceUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await updateInvoice(id, parsed.data)
    return NextResponse.json({ data, message: 'Invoice updated' })
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_DELETE, async () => {
    const { id } = await params
    try {
      await deleteInvoice(id)
      return NextResponse.json({ message: 'Invoice deleted' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete invoice'
      const status = message === 'Invoice not found' ? 404 : message.startsWith('Cannot delete') ? 409 : 500
      return NextResponse.json({ error: message }, { status })
    }
  })
}
