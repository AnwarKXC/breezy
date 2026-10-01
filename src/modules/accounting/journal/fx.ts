import { moneyToCents, centsToMoney } from './validation'

/** EGP per one transaction-currency unit, fixed at the original posting date. */
export function rateRatio(rate: string): { numerator: bigint; denominator: bigint } {
  const [whole, fraction = ''] = rate.split('.')
  const denominator = BigInt(10) ** BigInt(fraction.length)
  return { numerator: BigInt(whole) * denominator + BigInt(fraction || '0'), denominator }
}
function roundRate(cents: bigint, numerator: bigint, denominator: bigint) {
  return (cents * numerator * BigInt(2) + denominator) / (denominator * BigInt(2))
}
/**
 * Round each side's total once, then allocate residual cents to the largest
 * native lines (ties: original line order). Both base totals remain identical.
 * Negative residuals cannot create negative lines; allocation continues across
 * the remaining positive lines when necessary.
 */
export function valueJournalLines(lines: { debit: string; credit: string }[], rate: string) {
  const { numerator, denominator } = rateRatio(rate)
  const nativeDebit = lines.map((line) => moneyToCents(line.debit))
  const nativeCredit = lines.map((line) => moneyToCents(line.credit))
  function side(amounts: bigint[]) {
    const total = amounts.reduce((sum, value) => sum + value, BigInt(0))
    const target = roundRate(total, numerator, denominator)
    const rounded = amounts.map((value) => roundRate(value, numerator, denominator))
    let residual = target - rounded.reduce((sum, value) => sum + value, BigInt(0))
    const order = amounts.map((value, index) => ({ value, index })).filter((item) => item.value > BigInt(0)).sort((a, b) => a.value === b.value ? a.index - b.index : a.value > b.value ? -1 : 1)
    for (const { index } of order) {
      if (residual === BigInt(0)) break
      const adjustment = residual < -rounded[index] ? -rounded[index] : residual
      rounded[index] += adjustment
      residual -= adjustment
    }
    if (residual !== BigInt(0)) throw new Error('Unable to allocate base-currency rounding residual')
    return rounded
  }
  const debitTotal = nativeDebit.reduce((sum, value) => sum + value, BigInt(0))
  const creditTotal = nativeCredit.reduce((sum, value) => sum + value, BigInt(0))
  if (debitTotal !== creditTotal) throw new Error('Cannot value an unbalanced journal')
  const debit = side(nativeDebit), credit = side(nativeCredit)
  return lines.map((_, index) => ({ baseDebit: centsToMoney(debit[index]), baseCredit: centsToMoney(credit[index]) }))
}
