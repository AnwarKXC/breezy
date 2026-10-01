import 'server-only'

import { z } from 'zod'

import type { Prisma } from '@/generated/prisma/client'
import type { KpiItem } from '@/modules/assistant/types'
import { prisma } from '@/services/db/prisma'
import { dbDate } from '@/services/db/rows'

import { matchesAllTokens } from '../arabic'
import { addDays, daysBetween } from '../periods'
import { defineTool } from './registry'
import { limitForModel, MoneyBag, num, OPEN_INVOICE_STATUSES, round, sortCurrencies, ymd } from './shared'

const AGING_BUCKETS = ['not_due', 'overdue_1_30', 'overdue_31_60', 'overdue_61_90', 'overdue_90_plus'] as const

function agingBucket(daysOverdue: number): (typeof AGING_BUCKETS)[number] {
  if (daysOverdue <= 0) return 'not_due'
  if (daysOverdue <= 30) return 'overdue_1_30'
  if (daysOverdue <= 60) return 'overdue_31_60'
  if (daysOverdue <= 90) return 'overdue_61_90'
  return 'overdue_90_plus'
}

export const getOutstandingInvoices = defineTool({
  name: 'get_outstanding_invoices',
  description:
    'Unpaid / partially paid invoices (المستحقات / الفواتير المتأخرة / receivables) with remaining balance per currency and an aging breakdown. Filter by overdue only, minimum days overdue, or customer name.',
  args: z.object({
    overdue_only: z.boolean().optional().describe('Only invoices past their due date'),
    min_days_overdue: z.number().int().min(1).max(3650).optional(),
    customer: z.string().max(100).optional().describe('Company or guest name fragment'),
    limit: z.number().int().min(1).max(100).optional().describe('Default: 25'),
  }),
  async run(args, ctx) {
    const where: Prisma.invoicesWhereInput = {
      deleted_at: null,
      status: { in: [...OPEN_INVOICE_STATUSES] },
      remaining_balance: { gt: 0 },
    }
    if (args.overdue_only || args.min_days_overdue) {
      // due_date < today - (n - 1)  ⇔  at least n days overdue
      where.due_date = { lt: dbDate(addDays(ctx.today, -((args.min_days_overdue ?? 1) - 1))) }
    }

    const invoices = await prisma.invoices.findMany({
      where,
      select: {
        invoice_number: true,
        status: true,
        currency: true,
        amount: true,
        paid_amount: true,
        remaining_balance: true,
        issue_date: true,
        due_date: true,
        guest_name: true,
        company_name: true,
        contacts: { select: { name: true } },
        reservations: { select: { reservation_number: true } },
      },
      orderBy: { due_date: 'asc' },
    })

    const all = invoices
      .filter((inv) => !args.customer || matchesAllTokens(`${inv.company_name ?? ''} ${inv.guest_name ?? ''} ${inv.contacts.name}`, args.customer))
      .map((inv) => {
        const dueDate = ymd(inv.due_date)!
        const daysOverdue = Math.max(0, daysBetween(dueDate, ctx.today))
        return {
          invoice_number: inv.invoice_number,
          billed_to: inv.company_name || inv.guest_name || inv.contacts.name,
          reservation_number: inv.reservations?.reservation_number ?? null,
          issue_date: ymd(inv.issue_date),
          due_date: dueDate,
          days_overdue: daysOverdue,
          status: inv.status,
          currency: inv.currency,
          amount: round(num(inv.amount)),
          paid: round(num(inv.paid_amount)),
          remaining: round(num(inv.remaining_balance)),
        }
      })

    const outstanding = new MoneyBag()
    const overdue = new MoneyBag()
    const aging = new Map<string, MoneyBag>(AGING_BUCKETS.map((b) => [b, new MoneyBag()]))
    for (const row of all) {
      outstanding.add(row.currency, row.remaining, row.currency)
      if (row.days_overdue > 0) overdue.add(row.currency, row.remaining, row.currency)
      aging.get(agingBucket(row.days_overdue))!.add(row.currency, row.remaining, row.currency)
    }
    const currencies = sortCurrencies(outstanding.currencies(), ctx.systemCurrency)
    const agingRows = currencies.map((currency) => ({
      currency,
      ...Object.fromEntries(AGING_BUCKETS.map((b) => [b, aging.get(b)!.get(currency)])),
      total: outstanding.get(currency),
    }))
    const rows = all.slice(0, args.limit ?? 25)

    return {
      data: {
        invoices_count: all.length,
        overdue_count: all.filter((r) => r.days_overdue > 0).length,
        outstanding: outstanding.toMoney(),
        overdue: overdue.toMoney(),
        aging: agingRows,
        invoices: limitForModel(rows, 20),
      },
      blocks: [
        {
          type: 'kpi',
          title: 'outstanding_invoices',
          items: [
            { key: 'invoices_count', value: all.length, format: 'number' },
            ...currencies.flatMap((currency): KpiItem[] => [
              { key: 'outstanding', value: outstanding.get(currency), format: 'money', currency },
              { key: 'overdue', value: overdue.get(currency), format: 'money', currency },
            ]),
          ],
        },
        {
          type: 'table',
          title: 'aging',
          columns: [
            { key: 'currency', format: 'text' },
            ...AGING_BUCKETS.map((b) => ({ key: b, format: 'money' as const, currencyKey: 'currency' })),
            { key: 'total', format: 'money', currencyKey: 'currency' },
          ],
          rows: agingRows,
          totalRows: agingRows.length,
        },
        {
          type: 'table',
          title: 'outstanding_invoices',
          columns: [
            { key: 'invoice_number', format: 'text' },
            { key: 'billed_to', format: 'text' },
            { key: 'issue_date', format: 'date' },
            { key: 'due_date', format: 'date' },
            { key: 'days_overdue', format: 'number' },
            { key: 'status', format: 'enum' },
            { key: 'amount', format: 'money', currencyKey: 'currency' },
            { key: 'remaining', format: 'money', currencyKey: 'currency' },
          ],
          rows,
          totalRows: all.length,
        },
      ],
    }
  },
})
