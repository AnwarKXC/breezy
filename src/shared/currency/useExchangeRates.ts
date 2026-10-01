'use client'

import { useResource } from '@/shared/data/useResource'
import { FX_TTL_MS, getExchangeRates } from './rates'

/**
 * Live USD-based rates, loaded only while `enabled` (e.g. after the user asks
 * for a converted view). Shared and cached for 2 hours across the app.
 */
export function useExchangeRates(enabled = true) {
  const { data, error, isLoading } = useResource(enabled ? 'fx:rates' : null, getExchangeRates, { staleMs: FX_TTL_MS })
  return { rates: data?.rates ?? null, fetchedAt: data?.fetchedAt ?? null, loading: isLoading, error: error?.message ?? null }
}
