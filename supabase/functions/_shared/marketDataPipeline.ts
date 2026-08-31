// Orchestrates the eBay TransactionEvidenceProvider + MarketplaceSignalProvider
// pipeline (Profit Scanner v2 — see marketplaceProviders.ts for the
// marketplace-agnostic provider contracts this feeds):
//
//   item evidence -> provider-agnostic identification -> Catalog/product
//   resolution -> Taxonomy/category resolution -> verified sold evidence +
//   Browse active evidence -> comparable matching -> evidence-quality
//   assessment (evidenceQuality.ts) -> deterministic price stats
//
// Profit Scanner v2 change: sold evidence and active evidence are no longer
// both mandatory. Strong sold evidence alone (3+ coherent, exact-identity
// comps) is sufficient; active evidence alone can independently support
// 'moderate' evidence when sold evidence is unavailable; a small/broad
// evidence set that doesn't reach 'moderate' returns EVIDENCE_TOO_WEAK
// (LIMITED EVIDENCE) rather than blocking the whole result. Sell-through
// rate/turnover/demand are computed only when both sold and active evidence
// exist, and are informational-only (see marketData.ts) — never gating.
import { getItemIdentifier, type IdentifyInput } from "./itemIdentification.ts"
import { catalogSearchByGtin, catalogSearchByKeywords } from "./ebayCatalog.ts"
import { resolveCategory } from "./ebayTaxonomy.ts"
import { searchActiveListings } from "./ebayBrowse.ts"
import { getSoldMarketDataProvider } from "./soldCompsProvider.ts"
import {
  isCoherentPriceSet, isCoherentPriceSpread, selectComparableSoldComps,
} from "./compSelection.ts"
import { planMarketEvidenceQueries } from "./queryPlanner.ts"
import { computeSoldPriceStats, computeMarketTurnoverDays, computeSellThroughRate, computeDemandLevel } from "./marketMetrics.ts"
import { assessEvidenceQuality } from "./evidenceQuality.ts"
import type {
  MarketDataResult, MarketMetrics, CompMatchPrecision, IdentityCandidate, SoldCompListing,
  ActiveMarketEvidence, MarketEvidenceAuditEntry,
} from "./marketData.ts"
import type { MarketEvidenceProviderCapabilities } from "./marketplaceTypes.ts"

// The approved sold-evidence window used for STR and turnover. Providers must
// constrain their request to this same window or guarantee equivalent coverage.
const DEFAULT_SOLD_WINDOW_DAYS = 90;

// eBay Browse (searchActiveListings) is also an all_terms provider (task
// doc §5.1) — used as the query-planning capability fallback when no
// sold-comp provider is configured, since Browse's active-listing search
// (queryForActive below) still needs a planned query either way.
const EBAY_BROWSE_FALLBACK_CAPS: MarketEvidenceProviderCapabilities = {
  marketplace: 'ebay', evidenceClass: 'active_market', queryMatching: 'all_terms',
  maxUsefulQueryTerms: 4, supportsPagination: true, suppliesBestOfferFlag: false, costClass: 'free',
};

export async function runMarketDataPipeline(input: IdentifyInput): Promise<MarketDataResult> {
  const identifier = getItemIdentifier();
  if (!identifier) {
    return { ok: false, reason: 'IDENTIFICATION_UNRESOLVED', detail: 'No identification provider is configured' };
  }

  const identity = await identifier.identify(input);
  return resolveVerifiedMarketData(identity);
}

// R1 (P1-10): cap the persisted exclusion detail per query so a shelf scan
// with many candidates/retries can't balloon scan_log — the remainder is
// counted (excludedOverflowCount), never silently dropped.
const MAX_EXCLUDED_COMPS_PER_QUERY = 25;

function capExcluded(excluded: { itemId: string; title: string; soldPrice: number; reason: string }[]) {
  return {
    excludedComps: excluded.slice(0, MAX_EXCLUDED_COMPS_PER_QUERY),
    excludedOverflowCount: Math.max(0, excluded.length - MAX_EXCLUDED_COMPS_PER_QUERY),
  };
}

// Runs everything AFTER identification against an already-resolved
// IdentityCandidate. Split out so a caller that already has identification
// (e.g. a scan handler's own AI call) can reuse it here instead of
// triggering a second, redundant identification call.
export async function resolveVerifiedMarketData(identity: IdentityCandidate): Promise<MarketDataResult> {
  // R2 (§5.4): plan queries from the configured provider's own capabilities
  // (see EBAY_BROWSE_FALLBACK_CAPS above) instead of a provider-naive builder.
  const soldProvider = getSoldMarketDataProvider();
  const queries = planMarketEvidenceQueries(identity, soldProvider?.capabilities ?? EBAY_BROWSE_FALLBACK_CAPS);
  if (!queries.length) {
    return { ok: false, reason: 'IDENTIFICATION_UNRESOLVED', detail: 'Identification produced no usable search terms' };
  }

  const attemptedQueries: MarketEvidenceAuditEntry[] = [];
  // The best fully-qualified (3+ coherent, this cascade level's precision)
  // sold-comp query, and — independently — the best PARTIAL result (1-2
  // real comps) seen along the way, kept only as a fallback for the
  // 'moderate with active support' evidence tier if nothing fully qualifies.
  let qualified: { query: string; precision: CompMatchPrecision; comps: SoldCompListing[] } | null = null;
  let partial: { query: string; precision: CompMatchPrecision; comps: SoldCompListing[] } | null = null;

  if (soldProvider) {
    for (const candidate of queries) {
      const requestStartedAt = Date.now();
      const soldResult = await soldProvider.searchSoldComps({ searchTerms: candidate.query });
      const providerLatencyMs = Date.now() - requestStartedAt;
      if (!soldResult.ok) {
        attemptedQueries.push({
          query: candidate.query, precision: candidate.precision,
          rawCompCount: 0, retainedCompCount: 0, excludedComps: [], excludedOverflowCount: 0,
          qualified: false, rejectionReason: `${soldResult.reason}: ${soldResult.detail}`,
          providerLatencyMs,
          // Always 0 until the Retry-After retry policy (decision B) is
          // implemented — this call was not retried.
          retryCount: 0,
        });
        // A provider outage/rate-limit/malformed response is not evidence
        // that a broader query is needed. Stop instead of multiplying failed calls.
        return {
          ok: false, reason: soldResult.reason, detail: soldResult.detail,
          audit: { attemptedQueries, selectedQuery: null, activeSample: null },
        };
      }
      const selection = selectComparableSoldComps(soldResult.comps, identity, candidate);
      const stats = computeSoldPriceStats(selection.retained);
      const coherent = isCoherentPriceSet(selection.retained.filter(comp => !comp.bestOfferAccepted));
      const fullyQualifies = stats.compCount >= 3 && coherent;
      const rejectionReason = fullyQualifies ? null
        : stats.compCount === 0 ? 'no matching comps'
        : stats.compCount < 3 ? 'fewer than 3 coherent matching comps'
        : 'retained prices failed the p20/p80 coherence guard';
      attemptedQueries.push({
        query: candidate.query, precision: candidate.precision,
        rawCompCount: soldResult.comps.length, retainedCompCount: stats.compCount,
        ...capExcluded(selection.excluded), qualified: fullyQualifies, rejectionReason,
        providerLatencyMs, retryCount: 0,
      });
      if (fullyQualifies) {
        qualified = { query: candidate.query, precision: candidate.precision, comps: selection.retained };
        break;
      }
      // Track the best partial (1-2 usable comps) across the cascade —
      // never used alone, only as support alongside active evidence.
      if (stats.compCount >= 1 && stats.compCount <= 2 && (!partial || stats.compCount > partial.comps.length)) {
        partial = { query: candidate.query, precision: candidate.precision, comps: selection.retained };
      }
    }
  }

  const selected = qualified ?? partial;
  const queryForActive = selected?.query ?? queries[0].query;

  // Product/catalog and category resolution are best-effort — run against
  // the winning evidence query when one exists, else the first candidate.
  const catalogMatch = identity.gtin
    ? await catalogSearchByGtin(identity.gtin)
    : await catalogSearchByKeywords(queryForActive);
  const category = await resolveCategory(identity.likelyEbayCategory ?? queryForActive);

  // Active evidence is best-effort informational/supporting evidence now,
  // never a hard requirement for a decision-capable result (Profit Scanner
  // v2) — a missing count is still never treated as a verified zero.
  const activeCandidate = await searchActiveListings({
    query: queryForActive, categoryId: category.categoryId ?? undefined,
  }).catch(() => null);

  let activeMarketEvidence: ActiveMarketEvidence | null = activeCandidate && activeCandidate.matchingActiveCount > 0
    ? activeCandidate : null;
  // Reject an active population that fails the same identity matcher used
  // for sold comps — STR/turnover/evidence-quality must compare like with like.
  if (activeMarketEvidence) {
    const sampleAsSold: SoldCompListing[] = activeMarketEvidence.sampledListings.map(item => ({
      itemId: item.itemId, title: item.title, soldPrice: item.price, totalPrice: item.price,
      shippingPrice: null, shippingType: null, currency: item.currency,
      endedAt: new Date(0).toISOString(), condition: item.condition, conditionId: item.conditionId,
      buyingFormat: null, bidCount: null, bestOfferAccepted: false, listingType: null,
      listingUrl: item.itemWebUrl, sellerFeedbackScore: null, sellerFeedbackPercent: null,
    }));
    const precisionForFilter = (selected?.precision ?? 'substitute') as
      'exact_model_variant' | 'exact_model' | 'product_family' | 'substitute';
    const activeSelection = selectComparableSoldComps(sampleAsSold, identity, { query: queryForActive, precision: precisionForFilter });
    if (!sampleAsSold.length || activeSelection.retained.length !== sampleAsSold.length) activeMarketEvidence = null;
  }
  const activeAskingPricesCoherent = activeMarketEvidence
    ? isCoherentPriceSpread(activeMarketEvidence.sampledListings.map(l => l.price))
    : false;

  // R1 (P1-10): what Browse actually returned vs. what survived the
  // identity-match filter above — sampled/retained is all-or-nothing today
  // (a single identity-mismatch rejects the whole batch, see the `if` above),
  // but the shape is kept general for when that becomes partial.
  const activeSample = {
    sampled: activeCandidate?.sampledListings.length ?? 0,
    retained: activeMarketEvidence?.sampledListings.length ?? 0,
    totalResultCount: activeCandidate?.matchingActiveCount ?? null,
  };

  // ── Evidence-quality assessment (marketplace-independent, Profit Scanner v2) ──
  const soldSignal = selected ? {
    count: selected.comps.length, precision: selected.precision, coherent: selected === qualified,
  } : null;
  const activeSignal = activeMarketEvidence ? {
    count: activeMarketEvidence.matchingActiveCount, coherent: activeAskingPricesCoherent,
  } : null;
  const evidenceQuality = assessEvidenceQuality({ soldEvidence: soldSignal, activeEvidence: activeSignal });

  if (evidenceQuality === 'none') {
    return {
      ok: false, reason: 'INSUFFICIENT_VERIFIED_MARKET_DATA',
      detail: 'No usable sold or active marketplace evidence was found for this item.',
      audit: { attemptedQueries, selectedQuery: selected?.query ?? null, activeSample },
    };
  }
  if (evidenceQuality === 'weak') {
    const soldNote = soldSignal ? `${soldSignal.count} sold comp(s) at ${soldSignal.precision} precision` : 'no matching sold comps';
    const activeNote = activeSignal ? `${activeSignal.count} active listing(s)` : 'no matching active listings';
    return {
      ok: false, reason: 'EVIDENCE_TOO_WEAK',
      detail: `Found ${soldNote} and ${activeNote} — not enough coherent, comparable evidence to trust a HOT/LIST/SKIP recommendation.`,
      audit: { attemptedQueries, selectedQuery: selected?.query ?? null, activeSample },
    };
  }

  // evidenceQuality is 'strong' or 'moderate' from here on. soldPriceStats
  // reflects sold-comp evidence ONLY (never merges asking prices into
  // sold-price fields — task doc §10) — it stays all-null when there are no
  // usable sold comps. The active-evidence-only expected-sale-price fallback
  // (conservative asking-price percentile, never the highest listing) is a
  // MarketplaceEvidence-level v2 concept, computed by the marketplace
  // provider adapter (marketplaceProviders.ts getEbayMarketplaceEvidence),
  // not here.
  const soldPriceStats = computeSoldPriceStats(selected?.comps ?? []);
  soldPriceStats.evidenceQuality = evidenceQuality;

  // STR/turnover/demand are informational-only now (never gating) — only
  // computed when BOTH verified sold and active evidence exist and describe
  // the same item population.
  let turnover = null as MarketMetrics['turnover'];
  let sellThroughRate: number | null = null;
  let demandLevel: MarketMetrics['demandLevel'] = null;
  if (qualified && activeMarketEvidence) {
    const soldCount90d = qualified.comps.length;
    turnover = computeMarketTurnoverDays(soldCount90d, DEFAULT_SOLD_WINDOW_DAYS, activeMarketEvidence.matchingActiveCount);
    sellThroughRate = computeSellThroughRate(soldCount90d, activeMarketEvidence.matchingActiveCount);
    demandLevel = computeDemandLevel(sellThroughRate, turnover?.marketTurnoverDays ?? null);
  }

  const metrics: MarketMetrics = {
    compMatchPrecision: selected?.precision ?? null,
    soldPriceStats, activeMarketEvidence, turnover, sellThroughRate, demandLevel,
  };

  return {
    ok: true, identity, catalogMatch, category, metrics,
    audit: { selectedQuery: queryForActive, attemptedQueries, activeSample },
  };
}
