// MarketplaceOpportunityEngine (task doc §15) — turns per-marketplace
// evidence into per-marketplace economics, then selects the best overall
// opportunity. Never selects on gross asking price alone.
import { decide, type DecisiveEvidenceQuality } from "./decisionEngine.ts"
import { calcMarketplaceProfit, calcMarketplaceMaxBuyPrice, shipCostFor } from "./marketplaceEconomics.ts"
import type { MarketplaceEvidenceResult, MarketplaceId, MarketplaceOpportunity } from "./marketplaceTypes.ts"

export interface OpportunitySettings {
  ebayFeePct: number
  pkgCost: number
  // Seller-borne shipping cost when the seller actually pays it — already
  // resolved to 0 by the caller when the buyer pays (see Settings.shipping).
  shipCost: number
  minProfit: number
  targetRoi: number
}

function isDecisive(q: string): q is DecisiveEvidenceQuality {
  return q === 'strong' || q === 'moderate'
}

function buildOneOpportunity(
  marketplace: MarketplaceId,
  expectedSalePrice: number,
  evidenceQuality: DecisiveEvidenceQuality,
  priceLow: number | null,
  priceHigh: number | null,
  acquisitionCost: number | null | undefined,
  settings: OpportunitySettings,
  reason: string,
): MarketplaceOpportunity {
  const shipCost = shipCostFor(marketplace, settings.shipCost)
  let netProfit: number | null = null
  let roi: number | null = null
  let maxBuyPrice: number | null = null
  let maxBuyPriceLimitedBy: 'minProfit' | 'targetRoi' | 'both' | 'none' | null = null
  let decisionNetProfit: number
  let decisionRoi: number | null

  if (acquisitionCost !== null && acquisitionCost !== undefined && acquisitionCost >= 0) {
    const calc = calcMarketplaceProfit({
      marketplace, expectedSalePrice, cost: acquisitionCost,
      pkgCost: settings.pkgCost, shipCost, ebayFeePct: settings.ebayFeePct,
    })
    netProfit = calc.net; roi = calc.roi
    decisionNetProfit = calc.net; decisionRoi = calc.roi
  } else {
    // Cost left blank — solve backward for the max qualifying purchase price
    // rather than inventing an acquisition cost, same rule as the eBay-only
    // path this replaces (see maxBuyPrice.ts).
    const mb = calcMarketplaceMaxBuyPrice({
      marketplace, expectedSalePrice, pkgCost: settings.pkgCost, shipCost,
      minProfit: settings.minProfit, targetRoi: settings.targetRoi, ebayFeePct: settings.ebayFeePct,
    })
    maxBuyPrice = mb.maxCost
    maxBuyPriceLimitedBy = mb.maxCost !== null ? mb.limitedBy : null
    // Reuse decide()'s own profit/roi comparisons to ask "does SOME positive
    // acquisition price clear both thresholds" without duplicating that
    // logic — feed values that sit exactly at (qualifies) or just below
    // (does not) the thresholds.
    decisionNetProfit = mb.maxCost !== null ? settings.minProfit : settings.minProfit - 1
    decisionRoi = mb.maxCost !== null ? settings.targetRoi : null
  }

  const decisionReasons = decide({
    netProfit: decisionNetProfit, roi: decisionRoi,
    minProfit: settings.minProfit, targetRoi: settings.targetRoi, evidenceQuality,
  })
  const qualifies = decisionReasons.profitPass && decisionReasons.roiPass

  return {
    marketplace, evidenceQuality, priceLow, priceHigh, expectedSalePrice,
    economics: { marketplace, expectedSalePrice, netProfit, roi, shipCost, pkgCost: settings.pkgCost, maxBuyPrice, maxBuyPriceLimitedBy },
    qualifies, decisionReasons, reason,
  }
}

export function buildMarketplaceOpportunities(
  evidenceByMarketplace: Partial<Record<MarketplaceId, MarketplaceEvidenceResult>>,
  routedMarketplaces: MarketplaceId[],
  acquisitionCost: number | null | undefined,
  settings: OpportunitySettings,
): MarketplaceOpportunity[] {
  const opportunities: MarketplaceOpportunity[] = []

  for (const [marketplace, result] of Object.entries(evidenceByMarketplace) as [MarketplaceId, MarketplaceEvidenceResult][]) {
    if (!result.ok) continue
    const { evidence } = result
    if (!isDecisive(evidence.evidenceQuality) || evidence.expectedSalePrice === null) continue
    opportunities.push(buildOneOpportunity(
      marketplace, evidence.expectedSalePrice, evidence.evidenceQuality,
      evidence.priceLow, evidence.priceHigh, acquisitionCost, settings,
      `${evidence.evidenceQuality === 'strong' ? 'Strong' : 'Moderate'} verified evidence from ${evidence.sourceName}.`,
    ))
  }

  // Facebook/local has no evidence provider of its own (task doc §9) — it
  // borrows the best OTHER marketplace's defensible valuation and applies
  // its own $0-fee/no-shipping local-sale economics. Never fabricates a
  // price of its own; if nothing else qualified as evidence, local isn't
  // offered as an opportunity either.
  if (routedMarketplaces.includes('facebook_local') && opportunities.length > 0) {
    const donor = [...opportunities].sort((a, b) => b.expectedSalePrice - a.expectedSalePrice)[0]
    // Safe: every entry in `opportunities` was built above via buildOneOpportunity
    // after an isDecisive() guard, so donor.evidenceQuality is provably 'strong'
    // or 'moderate' at runtime even though MarketplaceOpportunity's field type
    // is the wider EvidenceQuality.
    const local = buildOneOpportunity(
      'facebook_local', donor.expectedSalePrice, donor.evidenceQuality as DecisiveEvidenceQuality,
      donor.priceLow, donor.priceHigh, acquisitionCost, settings,
      `Local in-person sale — no marketplace fee, no shipping. Valuation from ${donor.marketplace}.`,
    )
    // R3 (DECISIONS.md T3): local is still offered as a visible alternative
    // regardless, but selectBestMarketplace below refuses to let it WIN over
    // its own donor unless it clears the 25%/$10 bar — never merely from a
    // lower fee profile or $0 shipping.
    local.donorMarketplace = donor.marketplace
    local.donorProfit = donor.economics.netProfit ?? donor.economics.maxBuyPrice
    opportunities.push(local)
  }

  return opportunities
}

const EVIDENCE_RANK: Record<DecisiveEvidenceQuality, number> = { strong: 2, moderate: 1 }

// Best overall opportunity (task doc §15) — never simply the highest asking
// price. A qualifying (profit+ROI pass) opportunity always beats a
// non-qualifying one: this is how a bulky item's local option can correctly
// win over a remote marketplace whose shipping/packaging cost destroys its
// economics (remote fails to qualify, local does, even though local's
// evidence was only borrowed). Among opportunities in the same qualifying/
// non-qualifying pool, stronger evidence wins first; net profit — or, when
// acquisition cost is unknown, max-buy-price headroom — breaks ties within
// the same evidence tier.
const rankValue = (o: MarketplaceOpportunity) => o.economics.netProfit ?? o.economics.maxBuyPrice ?? -Infinity

// R3 (DECISIONS.md T3): facebook_local may outrank the marketplace that
// supplied its borrowed valuation ONLY when local's own profit is both
// >=25% higher AND >=$10 higher in absolute dollars than the donor's. Local
// must never win merely from its lower fee profile or $0 shipping cost. A
// non-local opportunity always passes trivially — this gate only constrains
// facebook_local specifically, and only when its donor is ALSO competing in
// the same pool (if the donor didn't itself qualify, local isn't "outranking"
// anything — it's the only viable option and should win on its own economics).
// Local-suitability-by-category is already enforced upstream
// (marketplaceRouter.ts only routes facebook_local for bulky/furniture/
// electronics categories in the first place).
function passesLocalThreshold(o: MarketplaceOpportunity, pool: MarketplaceOpportunity[]): boolean {
  if (o.marketplace !== 'facebook_local') return true
  const donorInPool = pool.some((p) => p.marketplace === o.donorMarketplace)
  if (!donorInPool) return true
  const donorProfit = o.donorProfit
  const localProfit = rankValue(o)
  if (donorProfit === null || donorProfit === undefined || !Number.isFinite(localProfit)) return false
  if (donorProfit <= 0) return localProfit - donorProfit >= 10
  return localProfit >= donorProfit * 1.25 && (localProfit - donorProfit) >= 10
}

export function selectBestMarketplace(opportunities: MarketplaceOpportunity[]): MarketplaceOpportunity | null {
  if (!opportunities.length) return null
  const qualifying = opportunities.filter(o => o.qualifies)
  const pool = qualifying.length ? qualifying : opportunities

  const ranked = [...pool].sort((a, b) => {
    const tierDiff = EVIDENCE_RANK[b.evidenceQuality as DecisiveEvidenceQuality] - EVIDENCE_RANK[a.evidenceQuality as DecisiveEvidenceQuality]
    if (tierDiff !== 0) return tierDiff
    return rankValue(b) - rankValue(a)
  })

  // Walk the ranked list and return the first candidate that's actually
  // allowed to win — a facebook_local candidate that fails T3's threshold is
  // skipped for the win (it stays visible in the full opportunities list as
  // an alternative), never silently promoted to best just by sorting first
  // on profit alone.
  return ranked.find((o) => passesLocalThreshold(o, pool)) ?? null
}
