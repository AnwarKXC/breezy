import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint, secureMutationEndpoint } from '@/shared/secureEndpoint'
import { createJournalEntry, getJournalDashboard } from '@/modules/accounting/journal/service'
import { JournalCreateSchema, JournalCurrencySchema, JournalMonthSchema, JournalValuationSchema } from '@/modules/accounting/journal/validation'
import { journalError } from './errors'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.LEDGER_READ, async () => {
    try {
      const params = new URL(request.url).searchParams
      const input = z.object({ currency: JournalCurrencySchema, month: JournalMonthSchema, valuation: JournalValuationSchema }).parse({ currency: params.get('currency') ?? 'EGP', month: params.get('month') ?? new Date().toISOString().slice(0, 7), valuation: params.get('valuation') ?? 'native' })
      return NextResponse.json({ data: await getJournalDashboard(input.currency, input.month, input.valuation) })
    } catch (error) { return journalError(error) }
  })
}

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.ACCOUNTING_WRITE, async () => {
    try {
      const input = JournalCreateSchema.parse(await request.json())
      return NextResponse.json({ data: await createJournalEntry(input) }, { status: 201 })
    } catch (error) { return journalError(error) }
  })
}
