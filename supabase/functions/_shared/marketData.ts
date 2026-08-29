// Deno-native mirror of packages/shared/src/types/marketData.ts.
// Duplicated intentionally — see financialEngine.ts for why (unverified
// cross-package import through the Supabase CLI bundler). Keep in lockstep.

import type { DemandLevel } from "./decisionEngine.ts"

export type IdentificationEvidenceKind =
  | 'barcode' | 'gtin' | 'upc' | 'ean' | 'isbn'
  | 'model_number' | 'manufacturer_part_number'
  | 'ocr_label' | 'catalog_match'
  | 'verified_attributes' | 'visual_ai' | 'text_inference'

export interface IdentityCandidate {
  itemName: string | null
  brand: string | null
  model: string | null
  variant: string | null
  gtin: string | null
  gtinKind: 'GTIN' | 'UPC' | 'EAN' | 'ISBN' | null
  manufacturerPartNumber: string | null
  likelyEbayCategory: string | null
  categoryHints: string[]
  conditionHints: string | null
  unresolvedAttributes: string[]
  identityConfidence: number
  evidenceUsed: IdentificationEvidenceKind[]
  normalizedSearchTerms: string[]
  providerId: string
}

export interface CatalogMatch {
  matchType: 'exact' | 'probable' | 'none'
  epid: string | null
  gtin: string | null
  title: string | null
  brand: string | null
  aspects: Record<string, string[]>
}

export interface CategoryResolution {
  categoryTreeId: string | null
  categoryId: string | null
  categoryName: string | null
  resolved: boolean
}

export interface SoldCompListing {
  itemId: string
  title: string
  soldPrice: number
  totalPrice: number | null
  shippingPrice: number | null
  shippingType: string | null
  currency: string
  endedAt: string
  condition: string | null
  conditionId: string | null
  buyingFormat: string | null
  bidCount: number | null
  bestOfferAccepted: boolean
  listingType: string | null
  listingUrl: string | null
  sellerFeedbackScore: number | null
  sellerFeedbackPercent: number | null
}

export interface ActiveListingSummary {
  itemId: string
  title: string
  price: number
  currency: string
  condition: string | null
  conditionId: string | null
  categoryId: string | null
  itemWebUrl: string | null
}

export interface ActiveMarketEvidence {
  matchingActiveCount: number
  sampledListings: ActiveListingSummary[]
  askingPriceLow: number | null
  askingPriceHigh: number | null
}

export type CompMatchPrecision =
  | 'exact_identifier_variant'
  | 'exact_model_variant'
  | 'exact_model'
  | 'product_family'
  | 'substitute'

export interface SoldPriceStats {
  compCount: number
  excludedBestOfferCount: number
  medianSoldPrice: number | null
  averageSoldPrice: number | null
  soldPriceLow: number | null
  soldPriceHigh: number | null
  evidenceQuality: 'strong' | 'moderate' | 'weak' | 'none'
}

export interface MarketTurnoverEstimate {
  marketTurnoverDays: number | null
  averageVerifiedSalesPerDay: number | null
  soldWindowDays: number
  soldCountInWindow: number
  activeInventoryCount: number
}

export interface MarketMetrics {
  compMatchPrecision: CompMatchPrecision | null
  // soldPriceStats.evidenceQuality is the Profit Scanner v2 marketplace-
  // independent decision-authority tier (evidenceQuality.ts's
  // assessEvidenceQuality), not a plain comp-count bucket.
  soldPriceStats: SoldPriceStats
  activeMarketEvidence: ActiveMarketEvidence | null
  turnover: MarketTurnoverEstimate | null
  // Profit Scanner v2: sell-through rate / demand level are no longer
  // scanner decision inputs (decisionEngine.ts) — eBay-specific signals that
  // don't generalize across marketplaces. Kept informational-only, for
  // backward compatibility with Inventory's SourcingMeta / Listing Generator
  // (out of scope for the scanner redesign). Never gates HOT/LIST/SKIP.
  //
  // Approved formula (product-owner-approved 2026-08-26):
  //   STR = soldCount90d / (soldCount90d + activeCount) * 100
  sellThroughRate: number | null
  // Approved thresholds (product-owner-approved 2026-08-26) — see
  // computeDemandLevel in marketMetrics.ts.
  demandLevel: DemandLevel | null
}

export type MarketDataFailureReason =
  | 'IDENTIFICATION_UNRESOLVED'
  | 'CATALOG_UNAVAILABLE'
  | 'TAXONOMY_UNAVAILABLE'
  | 'SOLDCOMPS_UNAVAILABLE'
  | 'SOLDCOMPS_NOT_CONFIGURED'
  | 'BROWSE_UNAVAILABLE'
  | 'INSUFFICIENT_VERIFIED_MARKET_DATA'
  // Profit Scanner v2: real evidence was found (at least one sold comp or
  // active listing) but it only reaches 'weak' evidence-quality — not enough
  // to defensibly support HOT/LIST/SKIP. Distinct from
  // INSUFFICIENT_VERIFIED_MARKET_DATA (zero usable evidence at all) so the UI
  // can say what was actually observed. Both are LIMITED EVIDENCE states —
  // never a fabricated decision.
  | 'EVIDENCE_TOO_WEAK'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'MALFORMED_PROVIDER_RESPONSE'

export interface MarketDataFailure {
  ok: false
  reason: MarketDataFailureReason
  detail: string
  audit?: {
    attemptedQueries: Array<{
      query: string
      precision: CompMatchPrecision
      rawCompCount: number
      retainedCompCount: number
      excludedComps: Array<{ itemId: string; title: string; soldPrice: number; reason: string }>
      qualified: boolean
      rejectionReason: string | null
    }>
  }
}

export interface MarketDataSuccess {
  ok: true
  identity: IdentityCandidate
  catalogMatch: CatalogMatch | null
  category: CategoryResolution | null
  metrics: MarketMetrics
  audit?: {
    selectedQuery: string
    attemptedQueries: Array<{
      query: string
      precision: CompMatchPrecision
      rawCompCount: number
      retainedCompCount: number
      excludedComps: Array<{ itemId: string; title: string; soldPrice: number; reason: string }>
      qualified: boolean
      rejectionReason: string | null
    }>
  }
}

export type MarketDataResult = MarketDataSuccess | MarketDataFailure
