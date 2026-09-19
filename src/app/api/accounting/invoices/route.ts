import { NextResponse } from 'next/server'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getInvoices, createInvoice } from '@/modules/accounting/services'
import { AccountingInvoiceCreateSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const { searchParams } = new URL(request.url)
    const params: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      if (value) params[key] = value
    }
    const result = await getInvoices(Object.keys(params).length > 0 ? params : undefined)
    return NextResponse.json({ data: result.data, total: result.total })
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_CREATE, async () => {
    const parsed = AccountingInvoiceCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    try {
      const data = await createInvoice(parsed.data)
      return NextResponse.json({ data, message: 'Invoice created' }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create invoice'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  })
}
