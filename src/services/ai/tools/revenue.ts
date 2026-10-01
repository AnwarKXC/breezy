import 'server-only'

import { z } from 'zod'

import type { KpiItem, ResultBlock } from '@/modules/assistant/types'
import { prisma } from '@/services/db/prisma'

import { periodArgs, previousPeriod, weekStart, type ResolvedPeriod } from '../periods'
import { defineTool, type ToolContext } from './registry'
import { bounded, change, dateRange, INVOICED_EXCLUDED, MoneyBag, num, period, round, sortCurrencies, ymd } from './shared'

async function revenueFor(range: ResolvedPeriod, ctx: ToolContext) {
  const [invoiced, collected] = await Promise.all([
    prisma.invoices.groupBy({
      by: ['currency'],
      where: { deleted_at: null, status: { notIn: [...INVOICED_EXCLUDED] }, issue_date: dateRange(range) },
      _sum: { amount: true, remaining_balance: true },
      _count: { _all: true },
    }),
    prisma.payments.groupBy({
      by: ['currency'],
      where: { deleted_at: null, transaction_date: dateRange(range) },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])
  const currencies = sortCurrencies([...invoiced.map((r) => r.currency), ...collected.map((r) => r.currency)], ctx.systemCurrency)
  return currencies.map((currency) => {
    const inv = invoiced.find((r) => r.currency === currency)
    const col = collected.find((r) => r.currency === currency)
    return {
      currency,
      invoiced: round(num(inv?._sum.amount)),
      collected: round(num(col?._sum.amount)),
      outstanding: round(num(inv?._sum.remaining_balance)),
      invoice_count: inv?._count._all ?? 0,
      payment_count: col?._count._all ?? 0,
    }
  })
}

export const getRevenueSummary = defineTool({
  name: 'get_revenue_summary',
  description:
    'Hotel revenue for a period, per currency: invoiced (issued invoices), collected (payments received net of refunds) and outstanding (unpaid balance of the invoices issued in the period). Use for any generic revenue / إيراد / دخل question, and set compare=true for "compared to last month/period".',
  args: z.object({
    ...periodArgs,
    compare: z.boolean().optional().describe('Also return the previous comparable period and % change'),
  }),
  async run(args, ctx) {
    const range = period(args, ctx)
    const current = await revenueFor(range, ctx)
    const previousRange = args.compare ? previousPeriod(range) : null
    const previous = previousRange ? await revenueFor(previousRange, ctx) : []

    const rows = current.map((row) => {
      const prev = previous.find((p) => p.currency === row.currency)
      return previousRange
        ? {
            ...row,
            previous_collected: prev?.collected ?? 0,
            previous_invoiced: prev?.invoiced ?? 0,
            collected_change_pct: change(row.collected, prev?.collected ?? 0),
            invoiced_change_pct: change(row.invoiced, prev?.invoiced ?? 0),
          }
        : row
    })
    for (const prev of previous) {
      if (!rows.some((r) => r.currency === prev.currency)) {
        rows.push({ currency: prev.currency, invoiced: 0, collected: 0, outstanding: 0, invoice_count: 0, payment_count: 0, previous_collected: prev.collected, previous_invoiced: prev.invoiced, collected_change_pct: null, invoiced_change_pct: null })
      }
    }

    const items: KpiItem[] = rows.flatMap((row) => {
      const list: KpiItem[] = [
        { key: 'collected', value: row.collected, format: 'money', currency: row.currency },
        { key: 'invoiced', value: row.invoiced, format: 'money', currency: row.currency },
        { key: 'outstanding', value: row.outstanding, format: 'money', currency: row.currency },
      ]
      if ('collected_change_pct' in row) list.push({ key: 'collected_change_pct', value: row.collected_change_pct, format: 'percent', currency: row.currency })
      return list
    })
    const blocks: ResultBlock[] = [{ type: 'kpi', title: 'revenue_summary', period: range, items }]
    if (previousRange) {
      blocks.push({
        type: 'table',
        title: 'revenue_comparison',
        period: range,
        columns: [
          { key: 'currency', format: 'text' },
          { key: 'collected', format: 'money', currencyKey: 'currency' },
          { key: 'previous_collected', format: 'money', currencyKey: 'currency' },
          { key: 'collected_change_pct', format: 'percent' },
          { key: 'invoiced', format: 'money', currencyKey: 'currency' },
          { key: 'previous_invoiced', format: 'money', currencyKey: 'currency' },
          { key: 'invoiced_change_pct', format: 'percent' },
        ],
        rows,
        totalRows: rows.length,
      })
    }
    return {
      data: { period: range, previous_period: previousRange, by_currency: rows, note: rows.length ? undefined : 'No invoices or payments in this period.' },
      blocks,
    }
  },
})

type Bucket = 'day' | 'week' | 'month'

function bucketOf(date: string, bucket: Bucket): string {
  if (bucket === 'month') return date.slice(0, 7)
  if (bucket === 'week') return weekStart(date)
  return date
}

export const getRevenueTrend = defineTool({
  name: 'get_revenue_trend',
  description:
    'Invoiced and collected amounts over time (per day, week or month, per currency). Use for trends, "by month", "each day this week", charts of revenue.',
  args: z.object({
    ...periodArgs,
    group_by: z.enum(['day', 'week', 'month']).optional().describe('Bucket size; chosen automatically from the period length when omitted'),
  }),
  async run(args, ctx) {
    const range = bounded(period(args, ctx))
    let bucket: Bucket = args.group_by ?? (range.days <= 31 ? 'day' : range.days <= 120 ? 'week' : 'month')
    if (bucket === 'day' && range.days > 93) bucket = 'week'
    if (bucket === 'week' && range.days > 370) bucket = 'month'

    const [invoices, payments] = await Promise.all([
      prisma.invoices.findMany({
        where: { deleted_at: null, status: { notIn: [...INVOICED_EXCLUDED] }, issue_date: dateRange(range) },
        select: { issue_date: true, amount: true, currency: true },
      }),
      prisma.payments.findMany({
        where: { deleted_at: null, transaction_date: dateRange(range) },
        select: { transaction_date: true, amount: true, currency: true },
      }),
    ])

    const buckets = new Map<string, { bucket: string; currency: string; invoiced: number; collected: number }>()
    const entry = (key: string, currency: string) => {
      const id = `${key}|${currency}`
      let row = buckets.get(id)
      if (!row) buckets.set(id, (row = { bucket: key, currency, invoiced: 0, collected: 0 }))
      return row
    }
    for (const inv of invoices) entry(bucketOf(ymd(inv.issue_date)!, bucket), inv.currency).invoiced += num(inv.amount)
    for (const pay of payments) entry(bucketOf(ymd(pay.transaction_date)!, bucket), pay.currency).collected += num(pay.amount)

    const rows = [...buckets.values()]
      .map((r) => ({ ...r, invoiced: round(r.invoiced), collected: round(r.collected) }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.currency.localeCompare(b.currency))
    const chartCurrency = sortCurrencies(rows.map((r) => r.currency), ctx.systemCurrency)[0]
    const labelFormat = bucket === 'month' ? 'text' : 'date'

    const blocks: ResultBlock[] = []
    if (chartCurrency) {
      blocks.push({
        type: 'bars',
        title: 'collected_trend',
        period: range,
        labelKey: 'bucket',
        labelFormat,
        valueKey: 'collected',
        format: 'money',
        currency: chartCurrency,
        rows: rows.filter((r) => r.currency === chartCurrency),
      })
    }
    blocks.push({
      type: 'table',
      title: 'revenue_trend',
      period: range,
      columns: [
        { key: 'bucket', format: labelFormat },
        { key: 'currency', format: 'text' },
        { key: 'invoiced', format: 'money', currencyKey: 'currency' },
        { key: 'collected', format: 'money', currencyKey: 'currency' },
      ],
      rows,
      totalRows: rows.length,
    })
    return { data: { period: range, group_by: bucket, rows }, blocks }
  },
})

export const getPaymentsSummary = defineTool({
  name: 'get_payments_summary',
  description:
    'Payments received (التحصيل / المدفوعات) in a period grouped by payment method, day, month or currency, with refunds shown separately. deposits_only=true keeps only payments made before the guest arrived (عربون / deposits).',
  args: z.object({
    ...periodArgs,
    group_by: z.enum(['method', 'day', 'month', 'currency']).optional().describe('Default: method'),
    deposits_only: z.boolean().optional(),
  }),
  async run(args, ctx) {
    const range = period(args, ctx)
    const groupBy = args.group_by ?? 'method'
    const payments = await prisma.payments.findMany({
      where: {
        deleted_at: null,
        transaction_date: dateRange(range),
        ...(args.deposits_only ? { invoices: { reservations: { isNot: null } } } : {}),
      },
      select: {
        transaction_date: true,
        amount: true,
        currency: true,
        method: true,
        invoices: { select: { reservations: { select: { check_in_date: true } } } },
      },
    })

    const groups = new Map<string, { group: string; currency: string; count: number; received: number; refunded: number; net: number }>()
    const totals = new MoneyBag()
    for (const payment of payments) {
      const date = ymd(payment.transaction_date)!
      if (args.deposits_only) {
        const checkIn = ymd(payment.invoices.reservations?.check_in_date)
        if (!checkIn || date >= checkIn) continue
      }
      const key =
        groupBy === 'method' ? payment.method : groupBy === 'day' ? date : groupBy === 'month' ? date.slice(0, 7) : payment.currency
      const id = `${key}|${payment.currency}`
      let row = groups.get(id)
      if (!row) groups.set(id, (row = { group: key, currency: payment.currency, count: 0, received: 0, refunded: 0, net: 0 }))
      const amount = num(payment.amount)
      row.count++
      if (amount >= 0) row.received += amount
      else row.refunded += -amount
      row.net += amount
      totals.add(payment.currency, amount, ctx.systemCurrency)
    }

    const rows = [...groups.values()]
      .map((r) => ({ ...r, received: round(r.received), refunded: round(r.refunded), net: round(r.net) }))
      .sort((a, b) => (groupBy === 'day' || groupBy === 'month' ? a.group.localeCompare(b.group) : b.net - a.net))
    const groupFormat = groupBy === 'method' ? 'enum' : groupBy === 'day' ? 'date' : 'text'

    return {
      data: { period: range, group_by: groupBy, deposits_only: Boolean(args.deposits_only), total_net: totals.toMoney(), rows },
      blocks: [
        {
          type: 'kpi',
          title: args.deposits_only ? 'deposits_summary' : 'payments_summary',
          period: range,
          items: totals.toMoney().map((m) => ({ key: 'net_collected', value: m.amount, format: 'money', currency: m.currency })),
        },
        {
          type: 'table',
          title: args.deposits_only ? 'deposits_summary' : 'payments_summary',
          period: range,
          columns: [
            { key: 'group', format: groupFormat },
            { key: 'currency', format: 'text' },
            { key: 'count', format: 'number' },
            { key: 'received', format: 'money', currencyKey: 'currency' },
            { key: 'refunded', format: 'money', currencyKey: 'currency' },
            { key: 'net', format: 'money', currencyKey: 'currency' },
          ],
          rows,
          totalRows: rows.length,
        },
      ],
    }
  },
})

export const getNetSummary = defineTool({
  name: 'get_net_summary',
  description:
    'Cash net result for a period per currency: collected payments minus paid expenses. Use for صافي / الربح / net / profit questions.',
  args: z.object({ ...periodArgs }),
  async run(args, ctx) {
    const range = period(args, ctx)
    const [payments, expenses] = await Promise.all([
      prisma.payments.groupBy({ by: ['currency'], where: { deleted_at: null, transaction_date: dateRange(range) }, _sum: { amount: true } }),
      prisma.expenses.findMany({
        where: { deleted_at: null, status: 'paid', date: dateRange(range) },
        select: { amount: true, total_amount: true, currency: true },
      }),
    ])
    const collected = new MoneyBag()
    for (const row of payments) collected.add(row.currency, num(row._sum.amount), ctx.systemCurrency)
    const spent = new MoneyBag()
    for (const row of expenses) spent.add(row.currency, num(row.total_amount) > 0 ? num(row.total_amount) : num(row.amount), ctx.systemCurrency)

    const rows = sortCurrencies([...collected.currencies(), ...spent.currencies()], ctx.systemCurrency).map((currency) => ({
      currency,
      collected: collected.get(currency),
      expenses: spent.get(currency),
      net: round(collected.get(currency) - spent.get(currency)),
    }))
    return {
      data: { period: range, by_currency: rows, definition: 'collected payments minus paid expenses; not an accrual P&L' },
      blocks: [
        {
          type: 'kpi',
          title: 'net_summary',
          period: range,
          items: rows.flatMap((r): KpiItem[] => [
            { key: 'collected', value: r.collected, format: 'money', currency: r.currency },
            { key: 'expenses', value: r.expenses, format: 'money', currency: r.currency },
            { key: 'net', value: r.net, format: 'money', currency: r.currency },
          ]),
        },
      ],
    }
  },
})
