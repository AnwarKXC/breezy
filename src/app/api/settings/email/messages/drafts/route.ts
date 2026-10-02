import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { zodErrorMessage } from '@/shared/validation'
import { DraftSchema } from '@/services/email/contracts'
import { saveDraft } from '@/services/email/mailbox'
import { mailErrorResponse } from '../../errors'

export async function POST(request: Request) {
  return secureMutationEndpoint(request, ACTIONS.EMAIL_WRITE, async () => {
    const parsed = DraftSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    try { return NextResponse.json({ data: await saveDraft(parsed.data) }) }
    catch (error) { return mailErrorResponse(error) }
  })
}
