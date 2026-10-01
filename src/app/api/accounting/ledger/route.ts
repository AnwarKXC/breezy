import { NextResponse } from 'next/server'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { ACTIONS } from '@/config/rbac'
import { getLedgerEntries } from '@/modules/accounting/services'
import { getLedgerSummary } from '@/modules/accounting/services/ledgerService'
import { z } from 'zod'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.LEDGER_READ, async () => {
    const { searchParams } = new URL(request.url)
    const parsed = z.object({
      fromDate: z.iso.date().optional(), toDate: z.iso.date().optional(), type: z.string().max(30).optional(),
      sourceType: z.string().max(30).optional(), sourceId: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(1000).optional(), offset: z.coerce.number().int().min(0).max(1000000).optional(),
    }).safeParse(Object.fromEntries([...searchParams.entries()].filter(([key, value]) => key !== 'summary' && value)))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid ledger filters' }, { status: 400 })
    if (parsed.data.fromDate && parsed.data.toDate && parsed.data.fromDate > parsed.data.toDate) return NextResponse.json({ error: 'Date range is reversed' }, { status: 400 })
    const data = searchParams.get('summary') === '1' ? await getLedgerSummary(parsed.data) : await getLedgerEntries(parsed.data)
    return NextResponse.json({ data })
  })
}
