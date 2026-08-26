// Orchestrates the P0 authoritative market-data pipeline (task doc §14):
//
//   item evidence -> provider-agnostic identification -> Catalog/product
//   resolution -> Taxonomy/category resolution -> SoldComps sold evidence +
//   Browse active evidence -> comparable matching -> deterministic
//   price/STR/turnover/demand metrics
//
// Sell-through-rate formula, demand-level thresholds, and the Best Offer
// exclusion policy are product-owner-approved (2026-08-26) — see
// marketMetrics.ts computeSellThroughRate/computeDemandLevel. Wired into
// single/text/shelf scan handlers in claude-proxy/index.ts (see
// tryVerifiedMarketData there) as of 2026-08-26, after live-verifying the
// SoldComps and eBay Browse/Taxonomy contracts (Catalog is live-verified but
// not currently entitled for this app's credentials — see ebayCatalog.ts).
// On any failure result here, the calling scan handler falls back to the
// pre-existing AI-estimate path rather than failing the scan outright.
import { getItemIdentifier, type IdentifyInput } from "./itemIdentification.ts"
import { catalogSearchByGtin, catalogSearchByKeywords } from "./ebayCatalog.ts"
import { resolveCategory } from "./ebayTaxonomy.ts"
import { searchActiveListings } from "./ebayBrowse.ts"
import { getSoldMarketDataProvider } from "./soldCompsProvider.ts"
import {
  computeSoldPriceStats, computeMarketTurnoverDays,
  computeSellThroughRate, computeDemandLevel,
} from "./marketMetrics.ts"
import type {
  MarketDataResult, MarketMetrics, CompMatchPrecision, IdentityCandidate,
} from "./marketData.ts"

// SoldComps' documented coverage window (all plans include up to 90 days of
// sold history) — this is the provider's actual data availability, not an
// invented business rule. The sell-through-rate window (a separate, still
// undefined product decision) may differ once approved.
const DEFAULT_SOLD_WINDOW_DAYS = 90;

function derivePrecision(identity: IdentityCandidate): CompMatchPrecision {
  if (identity.gtin && identity.variant) return 'exact_identifier_variant';
  if (identity.model && identity.variant) return 'exact_model_variant';
  if (identity.model) return 'exact_model';
  if (identity.brand || identity.categoryHints.length) return 'product_family';
  return 'substitute';
}

function buildSoldCompsQuery(identity: IdentityCandidate): string {
  if (identity.normalizedSearchTerms.length) return identity.normalizedSearchTerms.join(' ');
  return [identity.brand, identity.model, identity.variant, identity.itemName]
    .filter((s): s is string => !!s)
    .join(' ');
}

export async function runMarketDataPipeline(input: IdentifyInput): Promise<MarketDataResult> {
  const identifier = getItemIdentifier();
  if (!identifier) {
    return { ok: false, reason: 'IDENTIFICATION_UNRESOLVED', detail: 'No identification provider is configured' };
  }

  const identity = await identifier.identify(input);
  return resolveVerifiedMarketData(identity);
}

// Runs everything AFTER identification — Catalog/Taxonomy resolution,
// SoldComps + Browse evidence, and deterministic price/STR/turnover/demand
// metrics — against an already-resolved IdentityCandidate. Split out so a
// caller that already has identification (e.g. a scan handler's existing AI
// call, which already extracts item_name/brand/model as part of its single
// vision request) can reuse it here instead of triggering a second,
// redundant identification call through runMarketDataPipeline/
// getItemIdentifier(). Both entry points share identical Catalog/Taxonomy/
// SoldComps/Browse/metrics behavior.
export async function resolveVerifiedMarketData(identity: IdentityCandidate): Promise<MarketDataResult> {
  const query = buildSoldCompsQuery(identity);
  if (!query.trim()) {
    return { ok: false, reason: 'IDENTIFICATION_UNRESOLVED', detail: 'Identification produced no usable search terms' };
  }

  // Product/catalog resolution — GTIN first (exact), else keyword (probable).
  // A weak/no match never blocks the rest of the pipeline (task doc §2: "do
  // not force a catalog match") — it's carried through as informational.
  const catalogMatch = identity.gtin
    ? await catalogSearchByGtin(identity.gtin)
    : await catalogSearchByKeywords(query);

  const category = await resolveCategory(identity.likelyEbayCategory ?? query);

  const soldProvider = getSoldMarketDataProvider();
  if (!soldProvider) {
    return { ok: false, reason: 'SOLDCOMPS_NOT_CONFIGURED', detail: 'SOLD_COMPS_API_KEY is not set' };
  }

  const soldResult = await soldProvider.searchSoldComps({ searchTerms: query });
  if (!soldResult.ok) {
    return { ok: false, reason: soldResult.reason, detail: soldResult.detail };
  }

  const soldPriceStats = computeSoldPriceStats(soldResult.comps);
  if (soldPriceStats.compCount === 0) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_VERIFIED_MARKET_DATA',
      detail: `No usable sold comps for "${query}" (${soldResult.comps.length} raw results, ${soldPriceStats.excludedBestOfferCount} excluded as Best-Offer-accepted)`,
    };
  }

  // Active-market evidence is best-effort: Browse failing does not fail the
  // whole pipeline (sold-price evidence already qualifies), it just leaves
  // STR/turnover/demand unavailable — a missing active count is never
  // treated as zero (that would fabricate a 100% STR).
  const activeMarketEvidence = await searchActiveListings({
    query, categoryId: category.categoryId ?? undefined,
  }).catch(() => null);

  // soldCount90d/verifiedSoldCount for STR and turnover is the full set of
  // verified (schema-validated) sold comps in the window — including
  // Best-Offer-accepted ones, since a Best Offer sale is still a real sale
  // for counting sales velocity, even though its price is excluded from the
  // price-stats median/average (see computeSoldPriceStats).
  const soldCount90d = soldResult.comps.length;

  const turnover = activeMarketEvidence
    ? computeMarketTurnoverDays(soldCount90d, DEFAULT_SOLD_WINDOW_DAYS, activeMarketEvidence.matchingActiveCount)
    : null;

  const sellThroughRate = activeMarketEvidence
    ? computeSellThroughRate(soldCount90d, activeMarketEvidence.matchingActiveCount)
    : null;

  const demandLevel = computeDemandLevel(sellThroughRate, turnover?.marketTurnoverDays ?? null);

  const metrics: MarketMetrics = {
    compMatchPrecision: derivePrecision(identity),
    soldPriceStats,
    activeMarketEvidence,
    turnover,
    sellThroughRate,
    demandLevel,
  };

  return { ok: true, identity, catalogMatch, category, metrics };
}
