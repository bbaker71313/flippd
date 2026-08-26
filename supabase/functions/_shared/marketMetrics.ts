// Deno-native mirror of packages/shared/src/utils/marketMetrics.ts.
// Duplicated intentionally — see financialEngine.ts for why. Keep in lockstep.

import type { SoldCompListing, SoldPriceStats, MarketTurnoverEstimate } from "./marketData.ts"

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
    soldPriceLow: round2(prices[0]),
    soldPriceHigh: round2(prices[prices.length - 1]),
    evidenceQuality: evidenceQualityFromCompCount(usable.length),
  }
}

function computeMedian(sortedAsc: number[]): number {
  const n = sortedAsc.length
  const mid = Math.floor(n / 2)
  return n % 2 === 0 ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2 : sortedAsc[mid]
}

function evidenceQualityFromCompCount(n: number): SoldPriceStats['evidenceQuality'] {
  if (n >= 8) return 'strong'
  if (n >= 3) return 'moderate'
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
