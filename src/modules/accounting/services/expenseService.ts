import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { prisma, type DbTransaction } from '@/services/db/prisma'
import { dbDate, fromRow, serializeRow, toRow } from '@/services/db/rows'
import type { CreateExpenseInput, CreateExpenseCategoryInput } from '../types'
import { mapExpenseCategoryRow, mapExpenseRow } from '../types'
import {
  requireAccountingRead, requireAccountingWrite, requireExpensesCreate,
  requireExpensesUpdate, requireExpensesApprove, requireExpensesVoid,
} from './serviceSecurity'
import {
  logExpenseCreated, logExpenseUpdated, logExpenseApproved,
  logExpenseDeleted, logExpenseCategoryCreated,
} from './activityLogService'
import { createLedgerEntry } from './ledgerService'
import { getSystemCurrency } from '@/shared/currency/server'
import { AccountingExpenseCreateSchema } from '@/shared/validation'
import { ExpenseConflictError } from './expenseErrors'

type ExpenseRowWithCategory = Parameters<typeof mapExpenseRow>[0]
const toExpense = (row: unknown) => mapExpenseRow(serializeRow('expenses', row) as ExpenseRowWithCategory)

function expenseAmounts(input: CreateExpenseInput) {
  const validated = AccountingExpenseCreateSchema.parse(input)
  const totalAmount = validated.total_amount
  const taxAmount = validated.tax_amount
  const netAmount = validated.amount
  return { totalAmount, taxAmount, netAmount }
}

const expenseLedgerWhere = (id: string): Prisma.accounting_ledger_entriesWhereInput => ({ source_type: 'expense', source_id: id })

async function requireActiveCategory(tx: DbTransaction, id: string) {
  const categories = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM public.expense_categories WHERE id = ${id}::uuid AND deleted_at IS NULL FOR SHARE`
  if (!categories.length) throw new ExpenseConflictError('Expense category is archived or does not exist')
}

export async function getExpenseCategories() {
  await requireAccountingRead()
  const rows = await prisma.expense_categories.findMany({ where: { deleted_at: null }, orderBy: { name: 'asc' } })
  return rows.map((row) => mapExpenseCategoryRow(toRow('expense_categories', row)))
}

export async function createExpenseCategory(input: CreateExpenseCategoryInput) {
  await requireAccountingWrite()
  const row = await prisma.expense_categories.create({
    data: { name: input.name, name_ar: input.name_ar ?? null, description: input.description ?? null },
  })
  const category = mapExpenseCategoryRow(toRow('expense_categories', row))
  void logExpenseCategoryCreated({ id: category.id, name: category.name })
  return category
}

export async function deleteExpenseCategory(id: string) {
  await requireAccountingWrite()
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM public.expense_categories WHERE id = ${id}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM public.expenses WHERE category_id = ${id}::uuid ORDER BY id FOR UPDATE`
    const expenses = await tx.expenses.findMany({ where: { category_id: id, deleted_at: null }, select: { id: true } })
    const expenseIds = expenses.map((e) => e.id)
    if (await tx.expenses.count({ where: { id: { in: expenseIds }, status: 'paid' } })) {
      throw new ExpenseConflictError('This category contains paid expenses and cannot be deleted')
    }
    await tx.expenses.updateMany({ where: { id: { in: expenseIds } }, data: { deleted_at: now } })
    await tx.accounting_ledger_entries.deleteMany({ where: { source_type: 'expense', source_id: { in: expenseIds } } })
    const { count } = await tx.expense_categories.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: now } })
    if (!count) throw new ExpenseConflictError('Expense category not found')
  })
}

export async function getExpenses(params?: {
  categoryId?: string; month?: string; fromDate?: string; toDate?: string;
  vendor?: string; costCenter?: string; status?: string
}) {
  await requireAccountingRead()
  const where: Prisma.expensesWhereInput = { deleted_at: null }
  const date: Prisma.DateTimeFilter<'expenses'> = {}

  if (params?.categoryId) where.category_id = params.categoryId
  if (params?.month) {
    const start = dbDate(`${params.month}-01`)
    const end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1)
    date.gte = start
    date.lt = end
  }
  if (params?.fromDate) date.gte = dbDate(params.fromDate)
  if (params?.toDate) date.lte = dbDate(params.toDate)
  if (Object.keys(date).length) where.date = date
  if (params?.vendor) where.vendor = { contains: params.vendor, mode: 'insensitive' }
  if (params?.costCenter) where.cost_center = params.costCenter
  if (params?.status) where.status = params.status

  const rows = await prisma.expenses.findMany({
    where,
    include: { expense_categories: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })
  return rows.map(toExpense)
}

export async function createExpense(input: CreateExpenseInput) {
  const session = await requireExpensesCreate()
  input = AccountingExpenseCreateSchema.parse(input)
  if (input.status === 'approved') await requireExpensesApprove()
  if (input.status === 'void') throw new ExpenseConflictError('New expenses must be draft, approved or paid')
  const { totalAmount, taxAmount, netAmount } = expenseAmounts(input)
  const currency = input.currency ?? await getSystemCurrency()

  // Expense and its ledger outflow are written together.
  const row = await prisma.$transaction(async (tx) => {
    await requireActiveCategory(tx, input.category_id)
    const created = await tx.expenses.create({
      data: {
        ...(fromRow('expenses', input as unknown as Record<string, unknown>) as Prisma.expensesUncheckedCreateInput),
        amount: netAmount,
        currency,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        created_by: session.id,
      },
    })
    if (created.status === 'paid') await createLedgerEntry(
      {
        type: 'expense',
        sourceType: 'expense',
        sourceId: created.id,
        incomeAmount: 0,
        outcomeAmount: totalAmount,
        currency,
        transactionDate: input.date,
        description: `Expense: ${created.description}`,
        createdBy: session.id,
      },
      tx,
    )
    return created
  })

  const expense = toExpense(row)
  void logExpenseCreated({ id: expense.id, description: expense.description, amount: expense.amount })
  return expense
}

export async function updateExpense(id: string, input: CreateExpenseInput) {
  const session = await requireExpensesUpdate()
  input = AccountingExpenseCreateSchema.parse(input)
  if (input.status === 'approved') await requireExpensesApprove()
  if (input.status === 'void') await requireExpensesVoid()
  const { totalAmount, taxAmount, netAmount } = expenseAmounts(input)

  const row = await prisma.$transaction(async (tx) => {
    await requireActiveCategory(tx, input.category_id)
    await tx.$queryRaw`SELECT id FROM public.expenses WHERE id = ${id}::uuid FOR UPDATE`
    const existing = await tx.expenses.findFirst({ where: { id, deleted_at: null } })
    if (!existing) throw new ExpenseConflictError('Expense not found')
    if (existing.status === 'paid') throw new ExpenseConflictError('Paid expenses are immutable; record a documented correction instead')
    const currency = input.currency ?? existing.currency
    if (!currency) throw new ExpenseConflictError('Resolve the historical expense currency before editing')
    const { count } = await tx.expenses.updateMany({
      where: { id, deleted_at: null, status: existing.status },
      data: {
        ...(fromRow('expenses', input as unknown as Record<string, unknown>) as Prisma.expensesUncheckedUpdateManyInput),
        amount: netAmount,
        currency,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      },
    })
    if (count === 0) throw new ExpenseConflictError('Expense changed; reload and try again')
    await tx.accounting_ledger_entries.deleteMany({ where: expenseLedgerWhere(id) })
    if (input.status === 'paid') await createLedgerEntry({
      type: 'expense', sourceType: 'expense', sourceId: id, incomeAmount: 0,
      outcomeAmount: totalAmount, currency, transactionDate: input.date,
      description: `Expense: ${input.description}`, createdBy: session.id,
    }, tx)
    return tx.expenses.findUniqueOrThrow({ where: { id } })
  })

  const expense = toExpense(row)
  void logExpenseUpdated({ id: expense.id, description: expense.description, amount: expense.amount })
  return expense
}

export async function approveExpense(id: string) {
  const session = await requireExpensesApprove()
  const { count } = await prisma.expenses.updateMany({
    where: { id, deleted_at: null, status: 'draft' },
    data: { status: 'approved', approved_by: session.id, approved_at: new Date() },
  })
  if (count === 0) throw new ExpenseConflictError('Only draft expenses can be approved')
  const expense = toExpense(await prisma.expenses.findUniqueOrThrow({ where: { id } }))
  void logExpenseApproved({ id: expense.id, description: expense.description, amount: expense.amount, approvedBy: session.id })
  return expense
}

export async function deleteExpense(id: string) {
  await requireExpensesVoid()
  // Remove the ledger outflow together with the expense; otherwise the ledger
  // keeps counting money for an expense that no longer exists.
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM public.expenses WHERE id = ${id}::uuid FOR UPDATE`
    const expense = await tx.expenses.findFirst({ where: { id, deleted_at: null } })
    if (!expense) throw new ExpenseConflictError('Expense not found')
    if (expense.status === 'paid') throw new ExpenseConflictError('Paid expenses cannot be deleted; record a documented correction instead')
    await tx.expenses.update({ where: { id }, data: { deleted_at: new Date() } })
    await tx.accounting_ledger_entries.deleteMany({ where: expenseLedgerWhere(id) })
  })
  void logExpenseDeleted(id)
}
