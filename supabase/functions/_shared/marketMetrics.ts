// Deno-native mirror of packages/shared/src/utils/marketMetrics.ts.
// Duplicated intentionally — see financialEngine.ts for why. Keep in lockstep.

import type { SoldCompListing, SoldPriceStats, MarketTurnoverEstimate } from "./marketData.ts"
import type { DemandLevel } from "./decisionEngine.ts"

export function computeSoldPriceStats(comps: SoldCompListing[]): SoldPriceStats {
  const usable = comps.filter(c => !c.bestOfferAccepted && Number.isFinite(c.soldPrice) && c.soldPrice > 0)
  const excludedBestOfferCount = comps.filter(c => c.bestOfferAccepted).length

  if (usable.length === 0) {
    return {
      compCount: 0,
      excludedBestOfferCount,
      medianSoldPrice: null,
      averageSoldPrice: null,
      soldPriceLow: null,
      soldPriceHigh: null,
      evidenceQuality: 'none',
    }
  }

  const prices = usable.map(c => c.soldPrice).sort((a, b) => a - b)
  const median = computeMedian(prices)
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length

  return {
    compCount: usable.length,
    excludedBestOfferCount,
    medianSoldPrice: round2(median),
    averageSoldPrice: round2(average),
    soldPriceLow: round2(percentile(prices, 0.35)),
    soldPriceHigh: round2(percentile(prices, 0.70)),
    evidenceQuality: evidenceQualityFromCompCount(usable.length),
  }
}

function computeMedian(sortedAsc: number[]): number {
  const n = sortedAsc.length
  const mid = Math.floor(n / 2)
  return n % 2 === 0 ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2 : sortedAsc[mid]
}

function percentile(sortedAsc: number[], percentile: number): number {
  return sortedAsc[Math.floor((sortedAsc.length - 1) * percentile)]
}

function evidenceQualityFromCompCount(n: number): SoldPriceStats['evidenceQuality'] {
  if (n >= 8) return 'strong'
  if (n >= 5) return 'moderate'
  if (n >= 3) return 'weak'
  return 'weak'
}

export function computeMarketTurnoverDays(
  soldCountInWindow: number,
  soldWindowDays: number,
  activeInventoryCount: number,
): MarketTurnoverEstimate {
  if (soldWindowDays <= 0) {
    throw new Error('computeMarketTurnoverDays: soldWindowDays must be > 0')
  }
  const averageVerifiedSalesPerDay = soldCountInWindow / soldWindowDays

  const marketTurnoverDays = averageVerifiedSalesPerDay > 0
    ? round2(activeInventoryCount / averageVerifiedSalesPerDay)
    : null

  return {
    marketTurnoverDays,
    averageVerifiedSalesPerDay: round4(averageVerifiedSalesPerDay),
    soldWindowDays,
    soldCountInWindow,
    activeInventoryCount,
  }
}

// Approved formula (product-owner-approved 2026-08-26):
//   STR = soldCount90d / (soldCount90d + activeCount) * 100
// Returns null (never a fabricated 0%) when both counts are zero.
export function computeSellThroughRate(
  soldCount90d: number,
  activeCount: number,
): number | null {
  const denominator = soldCount90d + activeCount
  if (denominator <= 0) return null
  return round2((soldCount90d / denominator) * 100)
}

// Approved thresholds (product-owner-approved 2026-08-26). Evaluated highest
// tier downward. A missing input returns null (unavailable), never LOW.
export function computeDemandLevel(
  sellThroughRate: number | null,
  marketTurnoverDays: number | null,
): DemandLevel | null {
  if (sellThroughRate === null || marketTurnoverDays === null) return null
  if (sellThroughRate >= 70 && marketTurnoverDays <= 30) return 'VERY HIGH'
  if (sellThroughRate >= 50 && marketTurnoverDays <= 45) return 'HIGH'
  if (sellThroughRate >= 30 && marketTurnoverDays <= 90) return 'MEDIUM'
  return 'LOW'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
