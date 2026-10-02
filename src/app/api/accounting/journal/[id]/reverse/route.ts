import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { reverseJournalEntry } from '@/modules/accounting/journal/service'
import { JournalReverseSchema } from '@/modules/accounting/journal/validation'
import { journalError } from '../../errors'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.ACCOUNTING_WRITE, async () => {
    try {
      const id = z.guid().parse((await context.params).id)
      const input = JournalReverseSchema.parse(await request.json())
      return NextResponse.json({ data: await reverseJournalEntry(id, input) }, { status: 201 })
    } catch (error) { return journalError(error) }
  })
}
