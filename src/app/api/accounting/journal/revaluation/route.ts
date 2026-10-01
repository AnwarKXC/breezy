import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { createJournalRevaluation } from '@/modules/accounting/journal/service'
import { JournalRevaluationSchema } from '@/modules/accounting/journal/validation'
import { journalError } from '../errors'

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.ACCOUNTING_WRITE, async () => {
    try {
      return NextResponse.json({ data: await createJournalRevaluation(JournalRevaluationSchema.parse(await request.json())) }, { status: 201 })
    } catch (error) { return journalError(error) }
  })
}
