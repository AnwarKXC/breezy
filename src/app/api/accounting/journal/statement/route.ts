import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { getJournalAccountStatement } from '@/modules/accounting/journal/service'
import { JournalCurrencySchema, JournalMonthSchema, JournalValuationSchema } from '@/modules/accounting/journal/validation'
import { journalError } from '../errors'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.LEDGER_READ, async () => {
    try {
      const params = new URL(request.url).searchParams
      const input = z.object({
        currency: JournalCurrencySchema, month: JournalMonthSchema, valuation: JournalValuationSchema,
        accountCode: z.string().regex(/^\d{1,12}$/), contactId: z.uuid().optional(),
      }).parse({ currency: params.get('currency') ?? 'EGP', month: params.get('month') ?? new Date().toISOString().slice(0, 7), valuation: params.get('valuation') ?? 'native', accountCode: params.get('accountCode'), contactId: params.get('contactId') ?? undefined })
      return NextResponse.json({ data: await getJournalAccountStatement(input.currency, input.month, input.valuation, input.accountCode, input.contactId) })
    } catch (error) { return journalError(error) }
  })
}
