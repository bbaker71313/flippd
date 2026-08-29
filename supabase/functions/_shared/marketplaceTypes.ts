// Profit Scanner v2 — cross-market resale opportunity architecture (task
// doc §2, §7-§10). Marketplace-agnostic types shared by marketplaceRouter.ts,
// marketplaceProviders.ts, marketplaceEconomics.ts, and
// marketplaceOpportunity.ts. No marketplace API calls, financial math, or
// decision-making live in this file — types only.
import type { CompMatchPrecision, IdentityCandidate } from "./marketData.ts"
import type { DecisionResult, EvidenceQuality } from "./decisionEngine.ts"

export type MarketplaceId =
  | 'ebay' | 'etsy' | 'reverb' | 'discogs' | 'amazon' | 'mercari' | 'poshmark' | 'facebook_local'

export const MARKETPLACE_LABELS: Record<MarketplaceId, string> = {
  ebay: 'eBay', etsy: 'Etsy', reverb: 'Reverb', discogs: 'Discogs',
  amazon: 'Amazon', mercari: 'Mercari', poshmark: 'Poshmark', facebook_local: 'Facebook/Local',
}

// One internal evidence contract independent of provider (task doc §10).
// Never merges asking prices into sold-price fields.
export interface MarketplaceEvidence {
  marketplace: MarketplaceId
  evidenceType: 'verified_transaction' | 'active_market' | 'price_guide' | 'other'
  matchedItemCount: number
  comparableCount: number
  askingPrices: number[]
  medianSoldPrice: number | null
  medianAskingPrice: number | null
  priceLow: number | null
  priceHigh: number | null
  // The single defensible expected-resale value for this marketplace — the
  // sold-comp median when strong sold evidence exists, else a conservative
  // (never highest) asking-price percentile. Null only when evidenceQuality
  // is 'weak'/'none' and no defensible value could be established.
  expectedSalePrice: number | null
  matchPrecision: CompMatchPrecision | null
  evidenceQuality: EvidenceQuality
  sourceName: string
  fetchedAt: string
}

export type ProviderFailureReason =
  | 'NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED' | 'MALFORMED_PROVIDER_RESPONSE' | 'IDENTIFICATION_UNRESOLVED'
  | 'INSUFFICIENT_VERIFIED_MARKET_DATA' | 'EVIDENCE_TOO_WEAK'

export type MarketplaceEvidenceResult =
  | { ok: true; evidence: MarketplaceEvidence }
  | { ok: false; marketplace: MarketplaceId; reason: ProviderFailureReason; detail: string }

// For actual completed-transaction evidence (task doc §8).
export interface TransactionEvidenceProvider {
  readonly marketplace: MarketplaceId
  searchSoldEvidence(identity: IdentityCandidate): Promise<MarketplaceEvidenceResult>
}

// For current active/listing/offer/price-guide evidence (task doc §8).
export interface MarketplaceSignalProvider {
  readonly marketplace: MarketplaceId
  searchMarket(identity: IdentityCandidate): Promise<MarketplaceEvidenceResult>
}

// Approximate flat total (marketplace + payment-processing) fee percentage.
// Real marketplace fee schedules vary by price tier/category/seller level and
// are not modeled exactly here — see docs/files/DECISIONS.md for the
// approved default set. eBay is deliberately excluded: it always uses the
// user's own configured Settings.ebayFee, never this table.
export interface MarketplaceFeeProfile {
  marketplace: Exclude<MarketplaceId, 'ebay'>
  totalFeePct: number
  sellerTypicallyPaysShipping: boolean
}

export interface MarketplaceEconomics {
  marketplace: MarketplaceId
  expectedSalePrice: number
  netProfit: number | null    // null only in the "cost unknown" branch — see maxBuyPrice instead
  roi: number | null
  shipCost: number
  pkgCost: number
  maxBuyPrice: number | null  // populated only when acquisition cost was left blank
  maxBuyPriceLimitedBy: 'minProfit' | 'targetRoi' | 'both' | 'none' | null
}

export interface MarketplaceOpportunity {
  marketplace: MarketplaceId
  evidenceQuality: EvidenceQuality
  priceLow: number | null
  priceHigh: number | null
  expectedSalePrice: number
  economics: MarketplaceEconomics
  qualifies: boolean   // profit + ROI thresholds pass at this marketplace
  // The single decisionEngine.ts decide() result this marketplace's
  // netProfit/roi/evidenceQuality produced — the source of truth `qualifies`
  // is derived from. Exposed so a caller (claude-proxy/index.ts) never has
  // to recompute the same decision a second time to get failingThresholds.
  decisionReasons: DecisionResult
  reason: string
}
