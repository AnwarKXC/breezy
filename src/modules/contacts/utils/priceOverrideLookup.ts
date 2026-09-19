import type { CompanyPriceOverride, OccupancyCode } from '../types'

export function findOverridePrice(
  overrides: CompanyPriceOverride[],
  roomCategory: string,
  occupancyCode: OccupancyCode,
): number | null {
  const match = overrides.find(
    (o) => o.roomCategory === roomCategory && o.occupancyCode === occupancyCode,
  )
  return match?.price ?? null
}
