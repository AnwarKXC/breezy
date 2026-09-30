// Amounts in several currencies are never added into one number: a `Money`
// value is one total per currency. Shared by server aggregates and the UI.

export type MoneyRow = { amount: number; currency: string | null | undefined }

/** One entry per currency, zero totals dropped. */
export type Money = Array<{ amount: number; currency: string }>

/** Sums rows per currency. Rows without a currency go under `fallback`. */
export function toMoney(rows: Iterable<MoneyRow>, fallback = ''): Money {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const code = row.currency || fallback
    totals.set(code, (totals.get(code) ?? 0) + row.amount)
  }
  return [...totals]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .filter((m) => m.amount !== 0)
}

export function negateMoney(value: Money): Money {
  return value.map((m) => ({ currency: m.currency, amount: -m.amount }))
}

/** a - b, per currency. */
export function subtractMoney(a: Money, b: Money): Money {
  return toMoney([...a, ...negateMoney(b)])
}

/** True when no currency's total is negative (e.g. to colour a net figure). */
export function isNonNegativeMoney(value: Money | null | undefined): boolean {
  return (value ?? []).every((m) => m.amount >= 0)
}
