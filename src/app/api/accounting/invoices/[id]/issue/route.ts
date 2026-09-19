import { NextResponse } from 'next/server'
import { secureMutationEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { issueInvoice } from '@/modules/accounting/services'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return secureMutationEndpoint(request, ACTIONS.INVOICES_ISSUE, async () => {
    const { id } = await params
    try {
      const data = await issueInvoice(id)
      return NextResponse.json({ data, message: 'Invoice issued' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to issue invoice'
      const status = message.includes('already void or refunded') ? 409 : 500
      return NextResponse.json({ error: message }, { status })
    }
  })
}
