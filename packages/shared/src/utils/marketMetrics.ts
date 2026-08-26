import type {
  SoldCompListing, SoldPriceStats, MarketTurnoverEstimate,
} from "../types/marketData"

// Deterministic market-metrics math only. No AI values, no network calls,
// no invented data. Every function here takes already-verified provider
// evidence (SoldComps sold comps, eBay Browse active counts) and computes a
// number from it — or returns null/zero when the evidence can't support one.
//
// Sell-through rate and demand level are intentionally NOT computed here —
// no approved formula/denominator/window (STR) or threshold set (demand)
// exists yet. See packages/shared/src/types/marketData.ts MarketMetrics.

// Best Offer handling (task doc "Best Offer Handling"): a completed listing
// with bestOfferAccepted === true displays a listing/asking price that is
// NOT the confidential accepted amount. Using it as an exact sold price
// would fabricate financial evidence, so it is excluded from the primary
// median/average/range calculation. It is still counted separately
// (excludedBestOfferCount) so the evidence isn't silently discarded from an
// audit trail. Whether this exclusion (vs. an explicit down-weight formula)
// is the approved product rule is unresolved — see PRODUCT DECISION
// REQUIRED in the session report. This is the conservative default: it
// never uses a confidential/unknown price as if it were exact.
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

// Presentational bucketing only — never feeds HOT/LIST/SKIP, profit, or
// price. Documented assumption (not a financial/market-authority decision):
// fewer than 3 comps is too thin to summarize with a median at all.
function evidenceQualityFromCompCount(n: number): SoldPriceStats['evidenceQuality'] {
  if (n >= 8) return 'strong'
  if (n >= 3) return 'moderate'
  return 'weak'
}

// Approved conceptual model (product-owner-approved, task doc section 9):
//   marketTurnoverDays = activeInventory / averageVerifiedSalesPerDay
// This is a derived market-turnover estimate, not a direct per-listing eBay
// listing-duration measurement. Returns null (never Infinity/0-division)
// when there isn't enough verified sales velocity to divide by.
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
    : null // zero verified sales in the window — turnover is undefined, not infinite

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
