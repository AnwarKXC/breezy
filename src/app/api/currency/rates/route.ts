import 'server-only'
import { NextResponse } from 'next/server'
import { ACTIONS } from '@/config/rbac'
import { secureReadEndpoint } from '@/shared/secureEndpoint'
import { isCurrencyCode } from '@/shared/static/currencies'

// Live FX rates, fetched only when a user asks to view totals in one currency.
// Nothing is stored or converted server-side: records keep their own currency.
const TTL_MS = 2 * 60 * 60 * 1000
const cache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>()

export async function GET(request: Request) {
  return secureReadEndpoint(request, ACTIONS.RESERVATIONS_READ, async () => {
    const base = new URL(request.url).searchParams.get('base')
    if (!isCurrencyCode(base)) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Unsupported base currency' } }, { status: 400 })
    }

    const hit = cache.get(base)
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
      return NextResponse.json({ ok: true, data: { base, ...hit } })
    }

    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { cache: 'no-store' })
      const json = res.ok ? await res.json() : null
      if (!json?.rates || typeof json.rates !== 'object') throw new Error(`FX API ${res.status}`)
      const entry = { rates: json.rates as Record<string, number>, fetchedAt: Date.now() }
      cache.set(base, entry)
      return NextResponse.json({ ok: true, data: { base, ...entry } })
    } catch (error) {
      console.error('[currency/rates] fetch failed:', error)
      return NextResponse.json({ ok: false, error: { code: 'FX_UNAVAILABLE', message: 'Exchange rates are unavailable right now' } }, { status: 502 })
    }
  })
}
