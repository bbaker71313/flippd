import type {
  SoldCompListing, SoldPriceStats, MarketTurnoverEstimate,
} from "../types/marketData"
import type { DemandLevel } from "../types"

// Deterministic market-metrics math only. No AI values, no network calls,
// no invented data. Every function here takes already-verified provider
// evidence (SoldComps sold comps, eBay Browse active counts) and computes a
// number from it — or returns null/zero when the evidence can't support one.

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

// Approved formula (product-owner-approved 2026-08-26):
//   STR = soldCount90d / (soldCount90d + activeCount) * 100
// soldCount90d/activeCount must both be verified counts from the same 90-day
// evidence window (SoldComps sold comps, eBay Browse active listings) — never
// an AI estimate. Returns null (never a fabricated 0%) when there is no
// evidence at all to form a ratio from (both counts zero).
export function computeSellThroughRate(
  soldCount90d: number,
  activeCount: number,
): number | null {
  const denominator = soldCount90d + activeCount
  if (denominator <= 0) return null
  return round2((soldCount90d / denominator) * 100)
}

// Approved thresholds (product-owner-approved 2026-08-26). Evaluated highest
// tier downward. Both inputs must be verified (STR from computeSellThroughRate,
// turnover from computeMarketTurnoverDays) — a missing input returns null
// (unavailable demand), never LOW. AI confidence/wording may never affect
// this result.
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
