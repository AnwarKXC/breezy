import { NextResponse } from 'next/server'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getExpenseCategories, createExpenseCategory, deleteExpenseCategory } from '@/modules/accounting/services'
import { AccountingExpenseCategoryCreateSchema, AccountingIdQuerySchema, zodErrorMessage } from '@/shared/validation'
import { ExpenseConflictError } from '@/modules/accounting/services/expenseErrors'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const data = await getExpenseCategories()
    return NextResponse.json({ data })
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.ACCOUNTING_WRITE, async () => {
    const parsed = AccountingExpenseCategoryCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const data = await createExpenseCategory(parsed.data)
    return NextResponse.json({ data, message: 'Expense category created' }, { status: 201 })
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
    try {
      await deleteExpenseCategory(parsed.data.id)
      return NextResponse.json({ message: 'Expense category deleted' })
    } catch (error) {
      if (error instanceof ExpenseConflictError) return NextResponse.json({ error: error.message }, { status: 409 })
      throw error
    }
  })
}
