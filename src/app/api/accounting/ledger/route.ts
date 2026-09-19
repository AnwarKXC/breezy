import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getLedgerEntries } from '@/modules/accounting/services'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.LEDGER_READ, async () => {
    const { searchParams } = new URL(request.url)
    const params: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      if (value) params[key] = value
    }
    const data = await getLedgerEntries(Object.keys(params).length > 0 ? params : undefined)
    return NextResponse.json({ data })
  })
}
