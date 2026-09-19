import { NextResponse } from 'next/server'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getExpenses, createExpense, updateExpense, approveExpense, deleteExpense } from '@/modules/accounting/services'
import { AccountingExpenseCreateSchema, AccountingIdQuerySchema, zodErrorMessage } from '@/shared/validation'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const { searchParams } = new URL(request.url)
    const params: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      if (value) params[key] = value
    }
    const data = await getExpenses(Object.keys(params).length > 0 ? params : undefined)
    return NextResponse.json({ data })
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.EXPENSES_CREATE, async () => {
    const parsed = AccountingExpenseCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await createExpense(parsed.data)
    return NextResponse.json({ data, message: 'Expense created' }, { status: 201 })
  })
}

export async function PATCH(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.EXPENSES_UPDATE, async () => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const action = searchParams.get('action')
    const idParsed = AccountingIdQuerySchema.safeParse({ id })
    if (!idParsed.success) {
      return NextResponse.json({ error: zodErrorMessage(idParsed.error) }, { status: 400 })
    }
    if (action === 'approve') {
      const data = await approveExpense(idParsed.data.id)
      return NextResponse.json({ data, message: 'Expense approved' })
    }
    const parsed = AccountingExpenseCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await updateExpense(idParsed.data.id, parsed.data)
    return NextResponse.json({ data, message: 'Expense updated' })
  })
}

export async function DELETE(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.EXPENSES_VOID, async () => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const parsed = AccountingIdQuerySchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    await deleteExpense(parsed.data.id)
    return NextResponse.json({ message: 'Expense deleted' })
  })
}
