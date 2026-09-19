// Static currency catalog, bundled with the app (no API / DB fetch).
// Add a currency here and it becomes selectable everywhere.

export const CURRENCIES = [
  { code: 'EGP', symbol: 'EGP', label: 'EGP (ج.م)', decimals: 2 },
  { code: 'USD', symbol: '$', label: 'USD ($)', decimals: 2 },
  { code: 'EUR', symbol: '€', label: 'EUR (€)', decimals: 2 },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

export const DEFAULT_CURRENCY: CurrencyCode = 'EGP'

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as CurrencyCode[]

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCY_CODES as string[]).includes(value)
}

/** Localized currency name, e.g. "Egyptian Pound" / "جنيه مصري". */
export function currencyName(code: CurrencyCode, locale = 'en'): string {
  return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code
}
