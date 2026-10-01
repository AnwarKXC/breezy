import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { changeJournalPeriod } from '@/modules/accounting/journal/service'
import { JournalPeriodSchema } from '@/modules/accounting/journal/validation'
import { journalError } from '../errors'

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.ACCOUNTING_SETTINGS, async () => {
    try {
      const input = JournalPeriodSchema.parse(await request.json())
      return NextResponse.json({ data: await changeJournalPeriod(input) })
    } catch (error) { return journalError(error) }
  })
}
