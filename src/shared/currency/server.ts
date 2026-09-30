// Server-only helpers for the system (default) currency.
// It is stored as a JSON row in `accounting_settings` (key='currency',
// value={'code': string, 'symbol': string}) and only picks the currency of new
// reservations/invoices/rates. Amounts are never converted: every row keeps its
// own currency and is shown in it.

import 'server-only'
import { prisma } from '@/services/db/prisma'
import { isCurrencyCode, type CurrencyCode } from '@/shared/static/currencies'

const DEFAULT_SYSTEM_CURRENCY: CurrencyCode = 'EGP'
// Read on nearly every pricing/invoice request but changed only from settings:
// cache briefly in-process and invalidate on write (other instances converge in TTL).
const SYSTEM_CURRENCY_TTL_MS = 60 * 1000
let systemCurrencyCache: { code: CurrencyCode; ts: number } | null = null

export function invalidateSystemCurrencyCache() {
  systemCurrencyCache = null
}

export async function getSystemCurrency(): Promise<CurrencyCode> {
  if (systemCurrencyCache && Date.now() - systemCurrencyCache.ts < SYSTEM_CURRENCY_TTL_MS) {
    return systemCurrencyCache.code
  }
  try {
    const data = await prisma.accounting_settings.findUnique({ where: { key: 'currency' }, select: { value: true } })
    const value = data?.value as { code?: unknown } | null | undefined
    const code = typeof value?.code === 'string' ? value.code.toUpperCase() : undefined
    const resolved = isCurrencyCode(code) ? code : DEFAULT_SYSTEM_CURRENCY
    systemCurrencyCache = { code: resolved, ts: Date.now() }
    return resolved
  } catch (err) {
    console.error('[currency] getSystemCurrency failed:', err)
  }
  return DEFAULT_SYSTEM_CURRENCY
}

/** The requested currency when it is a supported code, otherwise the system currency. */
export async function currencyOrDefault(requested: unknown): Promise<CurrencyCode> {
  return isCurrencyCode(requested) ? requested : getSystemCurrency()
}

export interface ServiceChargeTaxRates {
  serviceChargeRate: number
  vatRate: number
}

export async function getServiceChargeTaxRates(): Promise<ServiceChargeTaxRates> {
  try {
    const data = await prisma.accounting_settings.findMany({
      where: { key: { in: ['service_charge_rate', 'vat_rate'] } },
      select: { key: true, value: true },
    })
    const map = new Map<string, { rate?: number } | undefined>(
      data.map((s) => [s.key, (s.value ?? undefined) as { rate?: number } | undefined]),
    )
    return {
      serviceChargeRate: Number(map.get('service_charge_rate')?.rate ?? 10),
      vatRate: Number(map.get('vat_rate')?.rate ?? 14),
    }
  } catch (err) {
    console.error('[currency] getServiceChargeTaxRates failed:', err)
    return { serviceChargeRate: 10, vatRate: 14 }
  }
}