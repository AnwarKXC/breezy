import 'server-only'

import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
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

type ExpenseRowWithCategory = Parameters<typeof mapExpenseRow>[0]
const toExpense = (row: unknown) => mapExpenseRow(serializeRow('expenses', row) as ExpenseRowWithCategory)

function expenseAmounts(input: CreateExpenseInput) {
  const totalAmount = Number(input.total_amount ?? input.amount ?? 0)
  const taxAmount = Number(input.tax_amount ?? 0)
  const netAmount = Number(input.amount ?? totalAmount - taxAmount)
  return { totalAmount, taxAmount, netAmount }
}

const expenseLedgerWhere = (id: string): Prisma.accounting_ledger_entriesWhereInput => ({ source_type: 'expense', source_id: id })

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
    const expenses = await tx.expenses.findMany({ where: { category_id: id, deleted_at: null }, select: { id: true } })
    const expenseIds = expenses.map((e) => e.id)
    await tx.expenses.updateMany({ where: { id: { in: expenseIds } }, data: { deleted_at: now } })
    await tx.accounting_ledger_entries.deleteMany({ where: { source_type: 'expense', source_id: { in: expenseIds } } })
    await tx.expense_categories.delete({ where: { id } })
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
  const { totalAmount, taxAmount, netAmount } = expenseAmounts(input)

  // Expense and its ledger outflow are written together.
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.expenses.create({
      data: {
        ...(fromRow('expenses', input as unknown as Record<string, unknown>) as Prisma.expensesUncheckedCreateInput),
        amount: netAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        created_by: session.id,
      },
    })
    await createLedgerEntry(
      {
        type: 'expense',
        sourceType: 'expense',
        sourceId: created.id,
        incomeAmount: 0,
        outcomeAmount: totalAmount,
        // Expenses have no currency of their own: they are kept in the system currency.
        currency: await getSystemCurrency(),
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
  await requireExpensesUpdate()
  const { totalAmount, taxAmount, netAmount } = expenseAmounts(input)

  const row = await prisma.$transaction(async (tx) => {
    const { count } = await tx.expenses.updateMany({
      where: { id, deleted_at: null },
      data: {
        ...(fromRow('expenses', input as unknown as Record<string, unknown>) as Prisma.expensesUncheckedUpdateManyInput),
        amount: netAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      },
    })
    if (count === 0) throw new Error('Expense not found')
    // Keep the ledger outflow in step with the edited amount.
    await tx.accounting_ledger_entries.updateMany({ where: expenseLedgerWhere(id), data: { outcome_amount: totalAmount } })
    return tx.expenses.findUniqueOrThrow({ where: { id } })
  })

  const expense = toExpense(row)
  void logExpenseUpdated({ id: expense.id, description: expense.description, amount: expense.amount })
  return expense
}

export async function approveExpense(id: string) {
  const session = await requireExpensesApprove()
  const { count } = await prisma.expenses.updateMany({
    where: { id, deleted_at: null },
    data: { status: 'approved', approved_by: session.id, approved_at: new Date() },
  })
  if (count === 0) throw new Error('Expense not found')
  const expense = toExpense(await prisma.expenses.findUniqueOrThrow({ where: { id } }))
  void logExpenseApproved({ id: expense.id, description: expense.description, amount: expense.amount, approvedBy: session.id })
  return expense
}

export async function deleteExpense(id: string) {
  await requireExpensesVoid()
  // Remove the ledger outflow together with the expense; otherwise the ledger
  // keeps counting money for an expense that no longer exists.
  await prisma.$transaction([
    prisma.expenses.updateMany({ where: { id, deleted_at: null }, data: { deleted_at: new Date() } }),
    prisma.accounting_ledger_entries.deleteMany({ where: expenseLedgerWhere(id) }),
  ])
  void logExpenseDeleted(id)
}
