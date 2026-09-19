import 'server-only'

import { MS_PER_DAY } from '@/shared/constants'
import type { Prisma } from '@/generated/prisma/client'
import { heldDeposits, paidByContact } from '@/generated/prisma/sql'
import { prisma } from '@/services/db/prisma'
import { invalidateSystemCurrencyCache } from '@/shared/currency/server'
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
  } as ReportExpenseDetail
}

export async function getAccountingOverview(): Promise<AccountingOverview> {
  await requireAccountingRead()
  const today = formatDate(new Date())
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const liveInvoice = { deleted_at: null } as const

  const [todayInvoices, monthInvoices, outstanding, paidInvoices, unpaidInvoices, monthExpenses, todayPayments, refunds, deposits] = await Promise.all([
    prisma.invoices.aggregate({ where: { ...liveInvoice, created_at: dayRange(today) }, _sum: { amount: true } }),
    prisma.invoices.aggregate({ where: { ...liveInvoice, created_at: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.invoices.aggregate({ where: liveInvoice, _sum: { remaining_balance: true } }),
    prisma.invoices.count({ where: { ...liveInvoice, status: { in: ['paid', 'partially_paid'] } } }),
    prisma.invoices.count({ where: { ...liveInvoice, status: { in: ['issued', 'overdue', 'draft'] } } }),
    prisma.expenses.aggregate({ where: { deleted_at: null, date: { gte: monthStart } }, _sum: { total_amount: true } }),
    prisma.payments.groupBy({ by: ['method'], where: { deleted_at: null, created_at: dayRange(today) }, _sum: { amount: true } }),
    prisma.payments.aggregate({ where: { deleted_at: null, amount: { lt: 0 } }, _sum: { amount: true } }),
    prisma.$queryRawTyped(heldDeposits()),
  ])

  const paidToday = (types: string[]) =>
    todayPayments.filter((p) => types.includes(p.method)).reduce((s, p) => s + num(p._sum.amount), 0)
  const monthToDateRevenue = num(monthInvoices._sum.amount)
  const totalExpenses = num(monthExpenses._sum.total_amount)

  return {
    todayRevenue: num(todayInvoices._sum.amount),
    monthToDateRevenue,
    outstandingBalance: num(outstanding._sum.remaining_balance),
    paidInvoices,
    unpaidInvoices,
    totalExpenses,
    netProfit: monthToDateRevenue - totalExpenses,
    cashCollectedToday: paidToday(['cash']),
    cardPaymentsToday: paidToday(['visa']),
    bankPaymentsToday: paidToday(['bank_transfer']),
    onlinePaymentsToday: paidToday(['instapay', 'vodafone_cash']),
    depositsHeld: num(deposits[0]?.held),
    totalRefunds: Math.abs(num(refunds._sum.amount)),
    occupancyRate: null,
    averageDailyRate: null,
    revPAR: null,
  }
}

/** Per-contact invoiced / paid totals (two grouped queries instead of two per contact). */
export async function getFinanceTable(): Promise<FinanceRow[]> {
  await requireAccountingRead()
  const [contacts, invoiceTotals, paymentTotals] = await Promise.all([
    prisma.contacts.findMany({ where: { deleted_at: null }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } }),
    prisma.invoices.groupBy({ by: ['contact_id'], where: { deleted_at: null }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.$queryRawTyped(paidByContact()),
  ])

  const invoicedBy = new Map(invoiceTotals.map((g) => [g.contact_id, g]))
  const paidBy = new Map(paymentTotals.map((p) => [p.contact_id, num(p.paid)]))

  return contacts.map((contact) => {
    const invoiced = invoicedBy.get(contact.id)
    const totalInvoiced = num(invoiced?._sum.amount)
    const totalPaid = paidBy.get(contact.id) ?? 0
    return {
      contactId: contact.id,
      contactName: contact.name,
      contactType: contact.type,
      invoiceCount: invoiced?._count._all ?? 0,
      totalInvoiced,
      totalPaid,
      balance: totalInvoiced - totalPaid,
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

  const [invoices, payments, expenses] = await Promise.all([
    prisma.invoices.aggregate({ where: { deleted_at: null, created_at: createdAt }, _sum: { amount: true } }),
    prisma.payments.aggregate({ where: { deleted_at: null, created_at: createdAt }, _sum: { amount: true } }),
    prisma.expenses.aggregate({ where: { deleted_at: null, date: expenseDate }, _sum: { total_amount: true } }),
  ])

  const totalRevenue = num(invoices._sum.amount)
  const totalExpenses = num(expenses._sum.total_amount)
  return { totalRevenue, totalExpenses, netBalance: totalRevenue - totalExpenses, outstanding: totalRevenue - num(payments._sum.amount) }
}

export async function getDailyRevenueReport(date: string): Promise<DailyRevenueReport> {
  await requireAccountingReports()
  const range = dayRange(date)
  const day = dbDate(date)

  const [payments, invoiceRows, expenseRows, occupancyCount] = await Promise.all([
    prisma.payments.findMany({ where: { deleted_at: null, created_at: range }, select: { amount: true, method: true } }),
    prisma.invoices.findMany({ where: { deleted_at: null, created_at: range } }),
    prisma.expenses.findMany({ where: { deleted_at: null, date: day }, include: { expense_categories: { select: { name: true } } } }),
    // Rooms in house that night: stays spanning the date that were actually occupied.
    prisma.reservation_rooms.count({
      where: { deleted_at: null, check_in_date: { lte: day }, check_out_date: { gt: day }, status: { in: ['occupied', 'checked_out'] } },
    }),
  ])

  const invoices = toRows('invoices', invoiceRows)
  const expenses = expenseRows.map((row) => serializeRow('expenses', row))

  const roomRevenue = invoices.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
  const extraServices = invoices.reduce((s, i) => s + Math.max(0, Number(i.amount ?? 0) - Number(i.subtotal ?? 0) - Number(i.tax_amount ?? 0)), 0)
  const taxCollected = invoices.reduce((s, i) => s + Number(i.tax_amount ?? 0), 0)
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)

  const paymentsByMethod: Record<string, number> = {}
  for (const p of payments) {
    const amt = num(p.amount)
    if (amt > 0) paymentsByMethod[p.method] = (paymentsByMethod[p.method] ?? 0) + amt
  }

  return {
    date,
    roomRevenue,
    extraServices,
    taxCollected,
    totalRevenue,
    expenses: totalExpenses,
    netRevenue: totalRevenue - totalExpenses,
    payments: Object.entries(paymentsByMethod).map(([method, amount]) => ({ method, amount })),
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
    prisma.invoices.findMany({ where: { deleted_at: null, issue_date: { gte: start, lt: end } } }),
    prisma.expenses.findMany({
      where: { deleted_at: null, date: { gte: start, lt: end } },
      include: { expense_categories: { select: { name: true } } },
    }),
  ])

  const invoices = toRows('invoices', invoiceRows)
  const expenses = expenseRows.map((row) => serializeRow('expenses', row))
  const roomRevenue = invoices.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
  const otherRevenue = invoices.reduce((s, i) => s + Math.max(0, Number(i.amount ?? 0) - Number(i.subtotal ?? 0)), 0)
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)

  return {
    month,
    roomRevenue,
    otherRevenue,
    totalRevenue,
    expenses: totalExpenses,
    netProfit: totalRevenue - totalExpenses,
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
    select: { remaining_balance: true, due_date: true },
  })

  let current = 0
  let days1to30 = 0
  let days31to60 = 0
  let days61plus = 0
  for (const inv of invoices) {
    const balance = num(inv.remaining_balance)
    const diffDays = Math.floor((today.getTime() - inv.due_date.getTime()) / MS_PER_DAY)
    if (diffDays <= 0) current += balance
    else if (diffDays <= 30) days1to30 += balance
    else if (diffDays <= 60) days31to60 += balance
    else days61plus += balance
  }

  return { current, days1to30, days31to60, days61plus, total: current + days1to30 + days31to60 + days61plus }
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
