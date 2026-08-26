// Orchestrates the P0 authoritative market-data pipeline (task doc §14):
//
//   item evidence -> provider-agnostic identification -> Catalog/product
//   resolution -> Taxonomy/category resolution -> SoldComps sold evidence +
//   Browse active evidence -> comparable matching -> deterministic
//   price/turnover metrics
//
// NOT wired into any live scan handler yet (see session report). Two
// product decisions block using this for real HOT/LIST/SKIP calls today:
// the sell-through-rate formula and the demand-level thresholds are both
// undefined (task doc §8, §10) — MarketMetrics.sellThroughRate/demandLevel
// are therefore always null, and the existing decide() in decisionEngine.ts
// fails (never passes) a null STR/demand threshold. Flipping a live scan
// handler over to this pipeline today would make every scan SKIP. Wire this
// in only after those two decisions are made AND SOLDCOMPS_API_KEY is
// configured AND the SoldComps contract (see soldCompsProvider.ts) is
// confirmed against a real account.
import { getItemIdentifier, type IdentifyInput } from "./itemIdentification.ts"
import { catalogSearchByGtin, catalogSearchByKeywords } from "./ebayCatalog.ts"
import { resolveCategory } from "./ebayTaxonomy.ts"
import { searchActiveListings } from "./ebayBrowse.ts"
import { getSoldMarketDataProvider } from "./soldCompsProvider.ts"
import { computeSoldPriceStats, computeMarketTurnoverDays } from "./marketMetrics.ts"
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
    return { ok: false, reason: 'SOLDCOMPS_NOT_CONFIGURED', detail: 'None of SOLD_COMPS_API_KEY / SOLD_COMP_API_KEY / SOLDCOMPS_API_KEY is set' };
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
  // turnover unavailable.
  const activeMarketEvidence = await searchActiveListings({
    query, categoryId: category.categoryId ?? undefined,
  }).catch(() => null);

  const turnover = activeMarketEvidence
    ? computeMarketTurnoverDays(soldPriceStats.compCount, DEFAULT_SOLD_WINDOW_DAYS, activeMarketEvidence.matchingActiveCount)
    : null;

  const metrics: MarketMetrics = {
    compMatchPrecision: derivePrecision(identity),
    soldPriceStats,
    activeMarketEvidence,
    turnover,
    sellThroughRate: null, // BLOCKED — see file header
    demandLevel: null,     // BLOCKED — see file header
  };

  return { ok: true, identity, catalogMatch, category, metrics };
}
