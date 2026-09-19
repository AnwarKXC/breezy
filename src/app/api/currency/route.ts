import { isCurrencyCode } from '@/shared/static/currencies'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { getSystemCurrency, getExchangeRates } from '@/shared/currency/server'
import type { CurrencyCode } from '@/shared/utils/types'

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.ACCOUNTING_READ, async () => {
    const url = new URL(request.url)
    const requestedBase = (url.searchParams.get('base') ?? '').toUpperCase() as CurrencyCode

    let base: CurrencyCode = requestedBase
    if (!isCurrencyCode(base)) {
      base = await getSystemCurrency()
    }

    const rates = await getExchangeRates(base)
    return NextResponse.json({ ok: true, data: { base, rates, fetchedAt: Date.now() } })
  })
}