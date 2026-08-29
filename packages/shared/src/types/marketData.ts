// Provider-agnostic market-data types (P0 remediation — SoldComps replacement
// for unavailable Marketplace Insights production access).
//
// These types describe the pipeline:
//   item evidence -> identification -> Catalog/Taxonomy resolution ->
//   SoldComps sold evidence + Browse active evidence -> comp matching ->
//   deterministic price/turnover metrics
//
// No field here is populated by AI. AI may only populate `IdentityCandidate`
// (see itemIdentification.ts) — never SoldEvidence/ActiveEvidence/MarketMetrics.
import type { DemandLevel } from "./index"

// ── Identification (provider-agnostic — see itemIdentification.ts) ────────

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
  gtin: string | null                  // GTIN/UPC/EAN/ISBN — whichever was read
  gtinKind: 'GTIN' | 'UPC' | 'EAN' | 'ISBN' | null
  manufacturerPartNumber: string | null
  likelyEbayCategory: string | null     // free-text hint — never authoritative, see CategoryResolution
  categoryHints: string[]
  conditionHints: string | null
  unresolvedAttributes: string[]
  identityConfidence: number            // 0-100 — confidence in WHAT the item is, never a market-data confidence
  evidenceUsed: IdentificationEvidenceKind[]
  normalizedSearchTerms: string[]       // for Catalog / Browse / SoldComps queries
  providerId: string                    // which ItemIdentifier implementation produced this
}

// ── Catalog / product resolution (eBay Catalog) ────────────────────────────

export interface CatalogMatch {
  matchType: 'exact' | 'probable' | 'none'
  epid: string | null                   // eBay product identifier
  gtin: string | null
  title: string | null
  brand: string | null
  aspects: Record<string, string[]>
}

// ── Category resolution (eBay Taxonomy) ────────────────────────────────────

export interface CategoryResolution {
  categoryTreeId: string | null
  categoryId: string | null
  categoryName: string | null
  resolved: boolean                     // false when Taxonomy could not resolve — never fabricate a category
}

// ── Sold evidence (SoldComps — see soldCompsProvider.ts) ──────────────────

export interface SoldCompListing {
  itemId: string
  title: string
  soldPrice: number
  totalPrice: number | null             // soldPrice + shippingPrice, when known
  shippingPrice: number | null
  shippingType: string | null
  currency: string
  endedAt: string                       // UTC ISO 8601
  condition: string | null
  conditionId: string | null
  buyingFormat: string | null           // e.g. FIXED_PRICE, AUCTION
  bidCount: number | null
  bestOfferAccepted: boolean
  listingType: string | null
  listingUrl: string | null
  sellerFeedbackScore: number | null
  sellerFeedbackPercent: number | null
}

// ── Active-market evidence (eBay Browse) ───────────────────────────────────

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

// ── Comp matching precision (see marketMetrics.ts) ─────────────────────────

export type CompMatchPrecision =
  | 'exact_identifier_variant'
  | 'exact_model_variant'
  | 'exact_model'
  | 'product_family'
  | 'substitute'

// ── Deterministic market metrics — the ONLY authoritative output of this
// pipeline. Every field here must be traceable to verified provider evidence.
// Fields explicitly left null/undefined are BLOCKED pending a product
// decision (see docs — sell-through-rate formula, demand thresholds) and
// must never be filled in with an invented value. ────────────────────────

export interface SoldPriceStats {
  compCount: number                     // total qualifying sold comps used
  excludedBestOfferCount: number        // comps excluded because bestOfferAccepted
                                         // (displayed price is not the confidential
                                         // accepted amount — see marketMetrics.ts)
  medianSoldPrice: number | null
  averageSoldPrice: number | null
  soldPriceLow: number | null
  soldPriceHigh: number | null
  evidenceQuality: 'strong' | 'moderate' | 'weak' | 'none'
}

export interface MarketTurnoverEstimate {
  // Approved conceptual model (product-owner-approved — see task doc):
  //   marketTurnoverDays = activeInventory / averageVerifiedSalesPerDay
  // This is a derived market-turnover estimate, NOT a direct per-listing
  // eBay listing-duration measurement.
  marketTurnoverDays: number | null
  averageVerifiedSalesPerDay: number | null
  soldWindowDays: number                // the window the sold count was measured over
  soldCountInWindow: number
  activeInventoryCount: number
}

export interface MarketMetrics {
  compMatchPrecision: CompMatchPrecision | null
  // soldPriceStats.evidenceQuality is the Profit Scanner v2 marketplace-
  // independent decision-authority tier (evidenceQuality.ts's
  // assessEvidenceQuality — identity-precision + active-evidence aware),
  // NOT the plain comp-count bucketing this field's name might suggest.
  soldPriceStats: SoldPriceStats
  activeMarketEvidence: ActiveMarketEvidence | null
  turnover: MarketTurnoverEstimate | null
  // Profit Scanner v2: sell-through rate and demand level are no longer
  // scanner decision inputs (see decisionEngine.ts) — they were eBay-sold/
  // active-listing-specific signals that don't generalize across
  // marketplaces. Both fields are kept, populated best-effort and
  // informational-only, purely for backward compatibility with Inventory's
  // SourcingMeta / the Listing Generator (out of scope for the scanner
  // redesign — see CLAUDE.md hard scope boundary). Never gates HOT/LIST/SKIP.
  //
  // Approved formula (product-owner-approved 2026-08-26):
  //   STR = soldCount90d / (soldCount90d + activeCount) * 100
  // null when there is no evidence to divide (both counts zero) — never a
  // fabricated 0%. See computeSellThroughRate in marketMetrics.ts.
  sellThroughRate: number | null
  // Approved thresholds (product-owner-approved 2026-08-26), derived from
  // verified sellThroughRate + verified marketTurnoverDays only — never from
  // AI confidence or wording. null when STR or turnover is unavailable — a
  // missing input is never treated as LOW. See computeDemandLevel.
  demandLevel: DemandLevel | null
}

// ── Pipeline failure states — provider failure is not a business decision.
// Never convert any of these into a fabricated SKIP or fabricated evidence. ─

export type MarketDataFailureReason =
  | 'IDENTIFICATION_UNRESOLVED'
  | 'CATALOG_UNAVAILABLE'
  | 'TAXONOMY_UNAVAILABLE'
  | 'SOLDCOMPS_UNAVAILABLE'
  | 'SOLDCOMPS_NOT_CONFIGURED'
  | 'BROWSE_UNAVAILABLE'
  | 'INSUFFICIENT_VERIFIED_MARKET_DATA'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'MALFORMED_PROVIDER_RESPONSE'

export interface MarketDataFailure {
  ok: false
  reason: MarketDataFailureReason
  detail: string
}

export interface MarketDataSuccess {
  ok: true
  identity: IdentityCandidate
  catalogMatch: CatalogMatch | null
  category: CategoryResolution | null
  metrics: MarketMetrics
}

export type MarketDataResult = MarketDataSuccess | MarketDataFailure
