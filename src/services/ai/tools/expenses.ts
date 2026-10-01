import 'server-only'

import { z } from 'zod'

import type { Prisma } from '@/generated/prisma/client'
import type { ResultBlock } from '@/modules/assistant/types'
import { prisma } from '@/services/db/prisma'

import { matchesAllTokens } from '../arabic'
import { periodArgs } from '../periods'
import { defineTool, type ToolContext } from './registry'
import { dateRange, limitForModel, MoneyBag, num, period, round, sortCurrencies, ymd } from './shared'

const EXPENSE_STATUSES = ['draft', 'approved', 'paid'] as const

function expenseStatuses(includeDrafts: boolean | undefined, status: (typeof EXPENSE_STATUSES)[number] | undefined): string[] {
  if (status) return [status]
  return includeDrafts ? [...EXPENSE_STATUSES] : ['approved', 'paid']
}

function expenseAmount(row: { amount: Prisma.Decimal; total_amount: Prisma.Decimal }) {
  return num(row.total_amount) > 0 ? num(row.total_amount) : num(row.amount)
}

function categoryName(category: { name: string; name_ar: string | null }, ctx: ToolContext) {
  return ctx.locale === 'ar' && category.name_ar ? category.name_ar : category.name
}

async function matchingCategoryIds(query: string) {
  const categories = await prisma.expense_categories.findMany({ where: { deleted_at: null }, select: { id: true, name: true, name_ar: true } })
  return categories.filter((c) => matchesAllTokens(`${c.name} ${c.name_ar ?? ''}`, query)).map((c) => c.id)
}

const statusArgs = {
  status: z.enum(EXPENSE_STATUSES).optional().describe('Only this status. Default: approved + paid'),
  include_drafts: z.boolean().optional(),
}

export const getExpensesSummary = defineTool({
  name: 'get_expenses_summary',
  description:
    'Expenses (المصاريف / المصروفات) totals for a period per currency, grouped by category, month, vendor, status or payment method. Excludes voided expenses and, by default, drafts.',
  args: z.object({
    ...periodArgs,
    group_by: z.enum(['category', 'month', 'vendor', 'status', 'payment_method']).optional().describe('Default: category'),
    ...statusArgs,
  }),
  async run(args, ctx) {
    const range = period(args, ctx)
    const groupBy = args.group_by ?? 'category'
    const expenses = await prisma.expenses.findMany({
      where: { deleted_at: null, status: { in: expenseStatuses(args.include_drafts, args.status) }, date: dateRange(range) },
      select: {
        date: true,
        amount: true,
        total_amount: true,
        currency: true,
        vendor: true,
        status: true,
        payment_method: true,
        expense_categories: { select: { name: true, name_ar: true } },
      },
    })

    const totals = new MoneyBag()
    const groups = new Map<string, { group: string; count: number; total: MoneyBag }>()
    for (const e of expenses) {
      const key =
        groupBy === 'category'
          ? categoryName(e.expense_categories, ctx)
          : groupBy === 'month'
            ? ymd(e.date)!.slice(0, 7)
            : groupBy === 'vendor'
              ? e.vendor || '—'
              : groupBy === 'status'
                ? e.status
                : e.payment_method || '—'
      let row = groups.get(key)
      if (!row) groups.set(key, (row = { group: key, count: 0, total: new MoneyBag() }))
      const amount = expenseAmount(e)
      row.count++
      row.total.add(e.currency, amount, ctx.systemCurrency)
      totals.add(e.currency, amount, ctx.systemCurrency)
    }

    const chartCurrency = sortCurrencies(totals.currencies(), ctx.systemCurrency)[0]
    const rows = [...groups.values()]
      .sort((a, b) => (groupBy === 'month' ? a.group.localeCompare(b.group) : b.total.get(chartCurrency ?? '') - a.total.get(chartCurrency ?? '') || b.count - a.count))
      .map((r) => ({
        group: r.group,
        count: r.count,
        total: r.total.toMoney(),
        share_pct: chartCurrency && totals.get(chartCurrency) ? round((r.total.get(chartCurrency) / totals.get(chartCurrency)) * 100, 1) : null,
        chart_value: chartCurrency ? r.total.get(chartCurrency) : 0,
      }))
    const groupFormat = groupBy === 'status' || groupBy === 'payment_method' ? 'enum' : 'text'

    const blocks: ResultBlock[] = [
      {
        type: 'kpi',
        title: 'expenses_summary',
        period: range,
        items: [
          { key: 'expenses_count', value: expenses.length, format: 'number' },
          ...totals.toMoney().map((m) => ({ key: 'expenses', value: m.amount, format: 'money' as const, currency: m.currency })),
        ],
      },
    ]
    if (chartCurrency && rows.length > 1) {
      blocks.push({ type: 'bars', title: `expenses_by_${groupBy}`, period: range, labelKey: 'group', labelFormat: groupFormat, valueKey: 'chart_value', format: 'money', currency: chartCurrency, rows })
    }
    blocks.push({
      type: 'table',
      title: `expenses_by_${groupBy}`,
      period: range,
      columns: [
        { key: 'group', format: groupFormat },
        { key: 'count', format: 'number' },
        { key: 'total', format: 'money_list' },
        { key: 'share_pct', format: 'percent' },
      ],
      rows,
      totalRows: rows.length,
    })
    return {
      data: { period: range, group_by: groupBy, total: totals.toMoney(), count: expenses.length, share_pct_currency: chartCurrency ?? null, rows: rows.map((r) => ({ group: r.group, count: r.count, total: r.total, share_pct: r.share_pct })) },
      blocks,
    }
  },
})

export const listExpenses = defineTool({
  name: 'list_expenses',
  description: 'Individual expense entries for a period, optionally filtered by category, vendor, status or minimum amount. Largest first unless sort=date.',
  args: z.object({
    ...periodArgs,
    category: z.string().max(60).optional().describe('Category name fragment (Arabic or English)'),
    vendor: z.string().max(100).optional(),
    min_amount: z.number().min(0).optional(),
    sort: z.enum(['amount', 'date']).optional(),
    limit: z.number().int().min(1).max(100).optional().describe('Default: 25'),
    ...statusArgs,
  }),
  async run(args, ctx) {
    const range = period(args, ctx)
    const where: Prisma.expensesWhereInput = {
      deleted_at: null,
      status: { in: expenseStatuses(args.include_drafts, args.status) },
      date: dateRange(range),
    }
    if (args.category) where.category_id = { in: await matchingCategoryIds(args.category) }
    if (args.vendor) where.vendor = { contains: args.vendor.trim(), mode: 'insensitive' }
    if (args.min_amount !== undefined) where.OR = [{ total_amount: { gte: args.min_amount } }, { total_amount: 0, amount: { gte: args.min_amount } }]

    const expenses = await prisma.expenses.findMany({
      where,
      select: {
        date: true,
        description: true,
        vendor: true,
        amount: true,
        total_amount: true,
        currency: true,
        status: true,
        payment_method: true,
        expense_categories: { select: { name: true, name_ar: true } },
      },
      orderBy: args.sort === 'date' ? { date: 'desc' } : { total_amount: 'desc' },
      take: 500,
    })
    const all = expenses.map((e) => ({
      date: ymd(e.date),
      category: categoryName(e.expense_categories, ctx),
      description: e.description,
      vendor: e.vendor,
      status: e.status,
      payment_method: e.payment_method,
      currency: e.currency || ctx.systemCurrency,
      amount: round(expenseAmount(e)),
    }))
    const rows = all.slice(0, args.limit ?? 25)
    const totals = new MoneyBag()
    for (const e of all) totals.add(e.currency, e.amount, ctx.systemCurrency)
    return {
      data: { period: range, matches: all.length, total: totals.toMoney(), expenses: limitForModel(rows, 20) },
      blocks: [
        {
          type: 'table',
          title: 'expenses_list',
          period: range,
          columns: [
            { key: 'date', format: 'date' },
            { key: 'category', format: 'text' },
            { key: 'description', format: 'text' },
            { key: 'vendor', format: 'text' },
            { key: 'status', format: 'enum' },
            { key: 'amount', format: 'money', currencyKey: 'currency' },
          ],
          rows,
          totalRows: all.length,
        },
      ],
    }
  },
})
