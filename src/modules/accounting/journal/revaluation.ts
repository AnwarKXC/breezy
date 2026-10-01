import { rateRatio } from './fx'
import { centsToMoney, moneyToCents } from './validation'

export function revaluationAmounts(nativeBalance: string, baseBefore: string, closingRate: string) {
  const native = moneyToCents(nativeBalance), carrying = moneyToCents(baseBefore)
  const { numerator, denominator } = rateRatio(closingRate)
  const absolute = native < BigInt(0) ? -native : native
  const rounded = (absolute * numerator * BigInt(2) + denominator) / (denominator * BigInt(2))
  const baseAfter = native < BigInt(0) ? -rounded : rounded
  return { nativeBalance: centsToMoney(native), baseBefore: centsToMoney(carrying), baseAfter: centsToMoney(baseAfter), delta: centsToMoney(baseAfter - carrying) }
}
