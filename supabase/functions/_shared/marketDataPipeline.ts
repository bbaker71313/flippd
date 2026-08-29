// Orchestrates the P0 authoritative market-data pipeline (task doc §14):
//
//   item evidence -> provider-agnostic identification -> Catalog/product
//   resolution -> Taxonomy/category resolution -> verified sold evidence +
//   Browse active evidence -> comparable matching -> deterministic
//   price/STR/turnover/demand metrics
//
// Sell-through-rate formula, demand-level thresholds, and the Best Offer
// exclusion policy are product-owner-approved (2026-08-26) — see
// marketMetrics.ts computeSellThroughRate/computeDemandLevel. Wired into
// single/text/shelf scan handlers in claude-proxy/index.ts (see
// tryVerifiedMarketData there) as of 2026-08-26, after live-verifying the
// Sold-provider and eBay Browse/Taxonomy contracts (Catalog is live-verified but
// not currently entitled for this app's credentials — see ebayCatalog.ts).
// On failure the scan remains identifiable, but no AI-created market number
// substitutes for missing verified evidence.
import { getItemIdentifier, type IdentifyInput } from "./itemIdentification.ts"
import { catalogSearchByGtin, catalogSearchByKeywords } from "./ebayCatalog.ts"
import { resolveCategory } from "./ebayTaxonomy.ts"
import { searchActiveListings } from "./ebayBrowse.ts"
import { getSoldMarketDataProvider } from "./soldCompsProvider.ts"
import {
  buildSoldCompsQueries, isCoherentPriceSet, selectComparableSoldComps,
} from "./compSelection.ts"
import {
  computeSoldPriceStats, computeMarketTurnoverDays,
  computeSellThroughRate, computeDemandLevel,
} from "./marketMetrics.ts"
import type {
  MarketDataResult, MarketMetrics, CompMatchPrecision, IdentityCandidate, SoldCompListing,
} from "./marketData.ts"

// The approved sold-evidence window used for STR and turnover. Providers must
// constrain their request to this same window or guarantee equivalent coverage.
const DEFAULT_SOLD_WINDOW_DAYS = 90;

export async function runMarketDataPipeline(input: IdentifyInput): Promise<MarketDataResult> {
  const identifier = getItemIdentifier();
  if (!identifier) {
    return { ok: false, reason: 'IDENTIFICATION_UNRESOLVED', detail: 'No identification provider is configured' };
  }

  const identity = await identifier.identify(input);
  return resolveVerifiedMarketData(identity);
}

// Runs everything AFTER identification — Catalog/Taxonomy resolution,
// verified sold + Browse evidence, and deterministic price/STR/turnover/demand
// metrics — against an already-resolved IdentityCandidate. Split out so a
// caller that already has identification (e.g. a scan handler's existing AI
// call, which already extracts item_name/brand/model as part of its single
// vision request) can reuse it here instead of triggering a second,
// redundant identification call through runMarketDataPipeline/
// getItemIdentifier(). Both entry points share identical Catalog/Taxonomy/
// SoldComps/Browse/metrics behavior.
export async function resolveVerifiedMarketData(identity: IdentityCandidate): Promise<MarketDataResult> {
  const queries = buildSoldCompsQueries(identity);
  if (!queries.length) {
    return { ok: false, reason: 'IDENTIFICATION_UNRESOLVED', detail: 'Identification produced no usable search terms' };
  }

  const soldProvider = getSoldMarketDataProvider();
  if (!soldProvider) {
    return { ok: false, reason: 'SOLDCOMPS_NOT_CONFIGURED', detail: 'Neither TRAWL_API_KEY nor SOLD_COMPS_API_KEY is set' };
  }

  const attemptedQueries: NonNullable<Extract<MarketDataResult, { ok: true }>['audit']>['attemptedQueries'] = [];
  let selected: { query: string; precision: CompMatchPrecision; comps: SoldCompListing[] } | null = null;
  for (const candidate of queries) {
    const soldResult = await soldProvider.searchSoldComps({ searchTerms: candidate.query });
    if (!soldResult.ok) {
      attemptedQueries.push({
        query: candidate.query, precision: candidate.precision,
        rawCompCount: 0, retainedCompCount: 0, excludedComps: [],
        qualified: false, rejectionReason: `${soldResult.reason}: ${soldResult.detail}`,
      });
      // A provider outage/rate-limit/malformed response is not evidence that
      // a broader query is needed. Stop instead of multiplying failed calls.
      return {
        ok: false, reason: soldResult.reason, detail: soldResult.detail,
        audit: { attemptedQueries },
      };
    }
    const selection = selectComparableSoldComps(soldResult.comps, identity, candidate);
    const stats = computeSoldPriceStats(selection.retained);
    const enoughComps = stats.compCount >= 3;
    const coherent = isCoherentPriceSet(selection.retained.filter(comp => !comp.bestOfferAccepted));
    const rejectionReason = !enoughComps ? 'fewer than 3 coherent matching comps'
      : !coherent ? 'retained prices failed the p20/p80 coherence guard' : null;
    attemptedQueries.push({
      query: candidate.query, precision: candidate.precision,
      rawCompCount: soldResult.comps.length, retainedCompCount: stats.compCount,
      excludedComps: selection.excluded, qualified: rejectionReason === null, rejectionReason,
    });
    if (!rejectionReason) {
      selected = { query: candidate.query, precision: candidate.precision, comps: selection.retained };
      break;
    }
  }

  if (!selected) {
    return {
      ok: false, reason: 'INSUFFICIENT_VERIFIED_MARKET_DATA',
      detail: 'No search-query level returned at least 3 coherent matching sold comparables.',
      audit: { attemptedQueries },
    };
  }

  const { query, precision, comps } = selected;
  const soldPriceStats = computeSoldPriceStats(comps);

  // Product/catalog resolution is best-effort and runs against the winning
  // evidence query, not an earlier query that failed qualification.
  const catalogMatch = identity.gtin
    ? await catalogSearchByGtin(identity.gtin)
    : await catalogSearchByKeywords(query);
  const category = await resolveCategory(identity.likelyEbayCategory ?? query);

  // Active evidence is required for an authoritative sourcing decision. A
  // missing count is never treated as zero or converted into a SKIP.
  const activeCandidate = await searchActiveListings({
    query, categoryId: category.categoryId ?? undefined,
  }).catch(() => null);

  // A zero active count does not prove instant sales. Also reject an active
  // population whose returned sample fails the same identity matcher used for
  // sold comps; STR/turnover must compare like with like.
  let activeMarketEvidence = activeCandidate && activeCandidate.matchingActiveCount > 0
    ? activeCandidate : null;
  if (activeMarketEvidence) {
    const sampleAsSold: SoldCompListing[] = activeMarketEvidence.sampledListings.map(item => ({
      itemId: item.itemId, title: item.title, soldPrice: item.price, totalPrice: item.price,
      shippingPrice: null, shippingType: null, currency: item.currency,
      endedAt: new Date(0).toISOString(), condition: item.condition, conditionId: item.conditionId,
      buyingFormat: null, bidCount: null, bestOfferAccepted: false, listingType: null,
      listingUrl: item.itemWebUrl, sellerFeedbackScore: null, sellerFeedbackPercent: null,
    }));
    const activeSelection = selectComparableSoldComps(sampleAsSold, identity, { query, precision: precision as 'exact_model_variant' | 'exact_model' | 'product_family' | 'substitute' });
    if (!sampleAsSold.length || activeSelection.retained.length !== sampleAsSold.length) activeMarketEvidence = null;
  }
  if (!activeMarketEvidence) {
    return {
      ok: false, reason: 'INSUFFICIENT_VERIFIED_MARKET_DATA',
      detail: 'Sold comps qualified, but matching active-market evidence was unavailable or contaminated; STR and turnover cannot be calculated honestly.',
      audit: { attemptedQueries },
    };
  }

  // soldCount90d/verifiedSoldCount for STR and turnover is the full set of
  // verified (schema-validated) sold comps in the window — including
  // Best-Offer-accepted ones, since a Best Offer sale is still a real sale
  // for counting sales velocity, even though its price is excluded from the
  // price-stats median/average (see computeSoldPriceStats).
  const soldCount90d = comps.length;

  const turnover = computeMarketTurnoverDays(soldCount90d, DEFAULT_SOLD_WINDOW_DAYS, activeMarketEvidence.matchingActiveCount);

  const sellThroughRate = computeSellThroughRate(soldCount90d, activeMarketEvidence.matchingActiveCount);

  const demandLevel = computeDemandLevel(sellThroughRate, turnover?.marketTurnoverDays ?? null);

  const metrics: MarketMetrics = {
    compMatchPrecision: precision,
    soldPriceStats,
    activeMarketEvidence,
    turnover,
    sellThroughRate,
    demandLevel,
  };

  return {
    ok: true, identity, catalogMatch, category, metrics,
    audit: { selectedQuery: query, attemptedQueries },
  };
}
