import { NextResponse } from 'next/server'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getPaymentsByInvoice, getAllPayments, createPayment, deletePayment } from '@/modules/accounting/services'
import type { CreatePaymentInput } from '@/modules/accounting/types'
import { AccountingIdQuerySchema, AccountingPaymentCreateSchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    if (invoiceId) {
      const data = await getPaymentsByInvoice(invoiceId)
      return NextResponse.json({ data })
    }
    const params: { fromDate?: string; toDate?: string; method?: string } = {}
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const method = searchParams.get('method')
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    if (method) params.method = method
    const data = await getAllPayments(params)
    return NextResponse.json({ data })
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.PAYMENTS_CREATE, async () => {
    const parsed = AccountingPaymentCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    try {
      const data = await createPayment(parsed.data as CreatePaymentInput)
      return NextResponse.json({ data, message: 'Payment created' }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create payment'
      const status = message.includes('void or refunded') ? 409 : 500
      return NextResponse.json({ error: message }, { status })
    }
  })
}

export async function DELETE(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.ACCOUNTING_WRITE, async () => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const parsed = AccountingIdQuerySchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    await deletePayment(parsed.data.id)
    return NextResponse.json({ message: 'Payment deleted' })
  })
}
