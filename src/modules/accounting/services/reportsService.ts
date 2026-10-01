import 'server-only'

import { MS_PER_DAY } from '@/shared/constants'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { invalidateSystemCurrencyCache } from '@/shared/currency/server'
import { toMoney, subtractMoney, negateMoney, type Money, type MoneyRow } from '@/shared/currency/money'
import { dbDate, serializeRow, toRows } from '@/services/db/rows'
import type {
  AccountingOverview, FinanceRow, FinancialHealth,
  DailyRevenueReport, MonthlyRevenueReport, AccountsReceivableAging,
  ReportInvoiceDetail, ReportExpenseDetail,
} from '../types'
import {
  requireAccountingRead, requireAccountingReports, requireAccountingSettings,
} from './serviceSecurity'
import { logSettingUpdated } from './activityLogService'
import { formatDate } from './accountingUtils'

const num = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0)
const postedInvoice: Prisma.invoicesWhereInput = { deleted_at: null, status: { notIn: ['draft', 'void'] } }
const openInvoice: Prisma.invoicesWhereInput = { deleted_at: null, status: { in: ['issued', 'partially_paid', 'partially_refunded', 'overdue'] } }
// Historical expenses without a recorded currency remain visibly unclassified.
const expenseMoney = (rows: Array<{ total_amount: Prisma.Decimal | number | null; currency: string | null }>) =>
  toMoney(rows.map((row) => ({ amount: num(row.total_amount), currency: row.currency ?? 'UNKNOWN' })))

/** Per-currency totals from a `groupBy(['currency'])` result. */
function grouped<K extends string>(groups: Array<{ currency: string; _sum: Partial<Record<K, Prisma.Decimal | null>> }>, key: K): Money {
  return toMoney(groups.map((g) => ({ amount: num(g._sum[key]), currency: g.currency })))
}

/** UTC day bounds for a YYYY-MM-DD date. */
function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`)
  return { gte: start, lt: new Date(start.getTime() + MS_PER_DAY) }
}

function mapReportInvoice(inv: Record<string, unknown>): ReportInvoiceDetail {
  return {
    id: inv.id as string,
    invoiceNumber: inv.invoice_number as string,
    guestName: inv.guest_name as string | null,
    companyName: inv.company_name as string | null,
    roomNumber: inv.room_number as string | null,
    amount: Number(inv.amount),
    paidAmount: Number(inv.paid_amount ?? 0),
    refundedAmount: Number(inv.refunded_amount ?? 0),
    remainingBalance: Number(inv.remaining_balance ?? inv.amount),
    currency: inv.currency as string,
    status: inv.status as string,
    issueDate: (inv.issue_date ?? inv.created_at) as string,
    paymentMethod: inv.payment_method as string | null,
  } as ReportInvoiceDetail
}

function mapReportExpense(exp: Record<string, unknown>): ReportExpenseDetail {
  return {
    id: exp.id as string,
    description: exp.description as string,
    categoryName: (exp.expense_categories as { name?: string } | null)?.name ?? null,
    amount: Number(exp.amount),
    taxAmount: Number(exp.tax_amount ?? 0),
    totalAmount: Number(exp.total_amount ?? exp.amount),
    vendor: exp.vendor as string | null,
    costCenter: exp.cost_center as string | null,
    paymentMethod: exp.payment_method as string | null,
    status: exp.status as string,
    date: exp.date as string,
    currency: exp.currency as string | null,
  } as ReportExpenseDetail
}

export async function getAccountingOverview(): Promise<AccountingOverview> {
  await requireAccountingRead()
  const today = formatDate(new Date())
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const liveInvoice = postedInvoice

  const [todayInvoices, monthInvoices, outstanding, paidInvoices, unpaidInvoices, monthExpenses, todayPayments, refunds] = await Promise.all([
    prisma.invoices.groupBy({ by: ['currency'], where: { ...liveInvoice, issue_date: dbDate(today) }, _sum: { amount: true, tax_amount: true } }),
    prisma.invoices.groupBy({ by: ['currency'], where: { ...liveInvoice, issue_date: { gte: monthStart } }, _sum: { amount: true, tax_amount: true } }),
    prisma.invoices.groupBy({ by: ['currency'], where: openInvoice, _sum: { remaining_balance: true } }),
    prisma.invoices.count({ where: { ...liveInvoice, status: { in: ['paid', 'partially_paid'] } } }),
    prisma.invoices.count({ where: { ...openInvoice, remaining_balance: { gt: 0 } } }),
    prisma.expenses.findMany({ where: { deleted_at: null, status: { in: ['approved', 'paid'] }, date: { gte: monthStart } }, select: { total_amount: true, currency: true } }),
    prisma.payments.groupBy({ by: ['method', 'currency'], where: { deleted_at: null, created_at: dayRange(today) }, _sum: { amount: true } }),
    prisma.payments.groupBy({ by: ['currency'], where: { deleted_at: null, amount: { lt: 0 } }, _sum: { amount: true } }),
  ])

  const paidToday = (types: string[]) =>
    toMoney(todayPayments.filter((p) => types.includes(p.method)).map((p) => ({ amount: num(p._sum.amount), currency: p.currency })))
  const monthToDateRevenue = subtractMoney(grouped(monthInvoices, 'amount'), grouped(monthInvoices, 'tax_amount'))
  // Expenses have no currency of their own: they are in the system currency.
  const totalExpenses = expenseMoney(monthExpenses)

  return {
    todayRevenue: subtractMoney(grouped(todayInvoices, 'amount'), grouped(todayInvoices, 'tax_amount')),
    monthToDateRevenue,
    outstandingBalance: grouped(outstanding, 'remaining_balance'),
    paidInvoices,
    unpaidInvoices,
    totalExpenses,
    netProfit: subtractMoney(monthToDateRevenue, totalExpenses),
    cashCollectedToday: paidToday(['cash']),
    cardPaymentsToday: paidToday(['visa']),
    bankPaymentsToday: paidToday(['bank_transfer']),
    onlinePaymentsToday: paidToday(['instapay', 'vodafone_cash']),
    // No deposit-liability register exists. Paid invoices are not deposits.
    depositsHeld: [],
    totalRefunds: negateMoney(grouped(refunds, 'amount')),
    occupancyRate: null,
    averageDailyRate: null,
    revPAR: null,
  }
}

/** Per-contact invoiced / paid totals per currency (two grouped queries instead of two per contact). */
export async function getFinanceTable(): Promise<FinanceRow[]> {
  await requireAccountingRead()
  const [contacts, invoiceTotals] = await Promise.all([
    prisma.contacts.findMany({ where: { deleted_at: null }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } }),
    prisma.invoices.groupBy({ by: ['contact_id', 'currency'], where: postedInvoice, _sum: { amount: true, paid_amount: true, remaining_balance: true }, _count: { _all: true } }),
  ])

  return contacts.map((contact) => {
    const invoiced = invoiceTotals.filter((g) => g.contact_id === contact.id)
    const totalInvoiced = toMoney(invoiced.map((g) => ({ amount: num(g._sum.amount), currency: g.currency })))
    const totalPaid = toMoney(invoiced.map((g) => ({ amount: num(g._sum.paid_amount), currency: g.currency })))
    return {
      contactId: contact.id,
      contactName: contact.name,
      contactType: contact.type,
      invoiceCount: invoiced.reduce((n, g) => n + g._count._all, 0),
      totalInvoiced,
      totalPaid,
      balance: toMoney(invoiced.map((g) => ({ amount: num(g._sum.remaining_balance), currency: g.currency }))),
    }
  })
}

export async function getFinancialHealth(dateParams?: { fromDate?: string; toDate?: string }): Promise<FinancialHealth> {
  await requireAccountingRead()
  const createdAt: Prisma.DateTimeFilter = {}
  if (dateParams?.fromDate) createdAt.gte = new Date(dateParams.fromDate)
  if (dateParams?.toDate) createdAt.lte = new Date(`${dateParams.toDate.slice(0, 10)}T23:59:59.999Z`)
  const expenseDate: Prisma.DateTimeFilter = {}
  if (dateParams?.fromDate) expenseDate.gte = dbDate(dateParams.fromDate)
  if (dateParams?.toDate) expenseDate.lte = dbDate(dateParams.toDate)

  const [invoices, outstanding, expenses] = await Promise.all([
    prisma.invoices.groupBy({ by: ['currency'], where: { ...postedInvoice, created_at: createdAt }, _sum: { amount: true, tax_amount: true } }),
    prisma.invoices.groupBy({ by: ['currency'], where: { ...openInvoice, created_at: createdAt }, _sum: { remaining_balance: true } }),
    prisma.expenses.findMany({ where: { deleted_at: null, status: { in: ['approved', 'paid'] }, date: expenseDate }, select: { total_amount: true, currency: true } }),
  ])

  const totalRevenue = subtractMoney(grouped(invoices, 'amount'), grouped(invoices, 'tax_amount'))
  const totalExpenses = expenseMoney(expenses)
  return {
    totalRevenue,
    totalExpenses,
    netBalance: subtractMoney(totalRevenue, totalExpenses),
    outstanding: grouped(outstanding, 'remaining_balance'),
  }
}

export async function getDailyRevenueReport(date: string): Promise<DailyRevenueReport> {
  await requireAccountingReports()
  const range = dayRange(date)
  const day = dbDate(date)

  const [payments, invoiceRows, expenseRows, occupancyCount] = await Promise.all([
    prisma.payments.findMany({ where: { deleted_at: null, created_at: range }, select: { amount: true, method: true, currency: true } }),
    prisma.invoices.findMany({ where: { ...postedInvoice, issue_date: day }, include: { invoice_items: true } }),
    prisma.expenses.findMany({ where: { deleted_at: null, status: { in: ['approved', 'paid'] }, date: day }, include: { expense_categories: { select: { name: true } } } }),
    // Rooms in house that night: stays spanning the date that were actually occupied.
    prisma.reservation_rooms.count({
      where: { deleted_at: null, check_in_date: { lte: day }, check_out_date: { gt: day }, status: { in: ['occupied', 'checked_out'] } },
    }),
  ])

  const invoices = toRows('invoices', invoiceRows)
  const expenses = expenseRows.map((row) => serializeRow('expenses', row))

  const byInvoice = (value: (i: (typeof invoices)[number]) => number) => toMoney(invoices.map((i) => ({ amount: value(i), currency: i.currency })))
  const roomRevenue = toMoney(invoiceRows.map((i) => ({ currency: i.currency, amount: i.invoice_items.filter((item) => item.type === 'room_charge').reduce((sum, item) => sum + num(item.total_price) - num(item.tax_amount), 0) })))
  const taxCollected = byInvoice((i) => Number(i.tax_amount ?? 0))
  const totalRevenue = byInvoice((i) => Number(i.amount ?? 0) - Number(i.tax_amount ?? 0))
  const extraServices = subtractMoney(totalRevenue, roomRevenue)
  const totalExpenses = expenseMoney(expenseRows)

  const received = payments
  const methods = [...new Set(received.map((p) => p.method))]

  return {
    date,
    roomRevenue,
    extraServices,
    taxCollected,
    totalRevenue,
    expenses: totalExpenses,
    netRevenue: subtractMoney(totalRevenue, totalExpenses),
    payments: methods.map((method) => ({
      method,
      amount: toMoney(received.filter((p) => p.method === method).map((p) => ({ amount: num(p.amount), currency: p.currency }))),
    })),
    occupancyCount,
    invoices: invoices.map((inv) => mapReportInvoice(inv as unknown as Record<string, unknown>)),
    expenseDetails: expenses.map(mapReportExpense),
  }
}

export async function getMonthlyRevenueReport(month: string): Promise<MonthlyRevenueReport> {
  await requireAccountingReports()
  const start = dbDate(`${month}-01`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)

  const [invoiceRows, expenseRows] = await Promise.all([
    prisma.invoices.findMany({ where: { ...postedInvoice, issue_date: { gte: start, lt: end } }, include: { invoice_items: true } }),
    prisma.expenses.findMany({
      where: { deleted_at: null, status: { in: ['approved', 'paid'] }, date: { gte: start, lt: end } },
      include: { expense_categories: { select: { name: true } } },
    }),
  ])

  const invoices = toRows('invoices', invoiceRows)
  const expenses = expenseRows.map((row) => serializeRow('expenses', row))
  const byInvoice = (value: (i: (typeof invoices)[number]) => number) => toMoney(invoices.map((i) => ({ amount: value(i), currency: i.currency })))
  const roomRevenue = toMoney(invoiceRows.map((i) => ({ currency: i.currency, amount: i.invoice_items.filter((item) => item.type === 'room_charge').reduce((sum, item) => sum + num(item.total_price) - num(item.tax_amount), 0) })))
  const totalRevenue = byInvoice((i) => Number(i.amount ?? 0) - Number(i.tax_amount ?? 0))
  const otherRevenue = subtractMoney(totalRevenue, roomRevenue)
  const totalExpenses = expenseMoney(expenseRows)

  return {
    month,
    roomRevenue,
    otherRevenue,
    totalRevenue,
    expenses: totalExpenses,
    netProfit: subtractMoney(totalRevenue, totalExpenses),
    occupancyRate: 0,
    averageDailyRate: 0,
    invoices: invoices.map((inv) => mapReportInvoice(inv as unknown as Record<string, unknown>)),
    expenseDetails: expenses.map(mapReportExpense),
  }
}

export async function getAccountsReceivableAging(): Promise<AccountsReceivableAging> {
  await requireAccountingReports()
  const today = new Date()
  const invoices = await prisma.invoices.findMany({
    where: { deleted_at: null, status: { in: ['issued', 'partially_paid', 'overdue'] }, remaining_balance: { gt: 0 } },
    select: { remaining_balance: true, due_date: true, currency: true },
  })

  const buckets: Record<'current' | 'days1to30' | 'days31to60' | 'days61plus', MoneyRow[]> = {
    current: [], days1to30: [], days31to60: [], days61plus: [],
  }
  for (const inv of invoices) {
    const row = { amount: num(inv.remaining_balance), currency: inv.currency }
    const diffDays = Math.floor((today.getTime() - inv.due_date.getTime()) / MS_PER_DAY)
    if (diffDays <= 0) buckets.current.push(row)
    else if (diffDays <= 30) buckets.days1to30.push(row)
    else if (diffDays <= 60) buckets.days31to60.push(row)
    else buckets.days61plus.push(row)
  }

  return {
    current: toMoney(buckets.current),
    days1to30: toMoney(buckets.days1to30),
    days31to60: toMoney(buckets.days31to60),
    days61plus: toMoney(buckets.days61plus),
    total: toMoney(invoices.map((inv) => ({ amount: num(inv.remaining_balance), currency: inv.currency }))),
  }
}

export async function getAccountingSettings() {
  await requireAccountingRead()
  const rows = await prisma.accounting_settings.findMany({ orderBy: { key: 'asc' } })
  return toRows('accounting_settings', rows)
}

export async function updateAccountingSetting(key: string, value: Record<string, unknown>) {
  const session = await requireAccountingSettings()
  await prisma.accounting_settings.upsert({
    where: { key },
    update: { value: value as Prisma.InputJsonValue, updated_by: session.id },
    create: { key, value: value as Prisma.InputJsonValue, description: 'System currency', updated_by: session.id },
  })
  if (key === 'currency') invalidateSystemCurrencyCache()
  void logSettingUpdated({ key })
}
