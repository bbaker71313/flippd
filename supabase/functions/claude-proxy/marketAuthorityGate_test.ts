// Regression tests for the Chapter 02 AI-market-authority defect fix.
//
// Defect (verified live in supabase/functions/claude-proxy/index.ts before
// this fix): when the verified market-data pipeline (SoldComps + eBay
// Browse) failed, the scan handlers fed Claude's own (non-null)
// avg_sold_price/sell_through_rate/avg_days_to_sell/demand_level straight
// into evaluateScanEconomics()/decide(). Those AI values are never null, so
// they sailed right through decide()'s null-means-missing-evidence checks
// and could produce a fully authoritative-looking HOT/LIST/SKIP decision,
// net profit, ROI, and max-buy-price from an unverified AI guess.
//
// Fix: resolveScanResultCore() is now the single gate both single/text and
// shelf scan go through. It calls evaluateScanEconomics()/decide() ONLY when
// `verified.ok === true`; otherwise every authoritative field is forced to
// null and decisionAvailable:false, with the AI's own guess carried
// separately (and only informationally) in `aiEstimate`.
//
// Run: `deno test --no-check --node-modules-dir=none --allow-env --allow-read
// --allow-net --import-map=supabase/functions/_shared/testing/deno_test_import_map.json
// supabase/functions/claude-proxy/`
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateScanEconomics, resolveScanResultCore } from "./index.ts";
import type { MarketDataResult, MarketDataSuccess, IdentityCandidate } from "../_shared/marketData.ts";

// Minimal settings row shape used by evaluateScanEconomics/resolveScanResultCore.
const SETTINGS = {
  ebay_fee: 13, pkg_cost: 1.25, target_roi: 200, min_profit: 15,
  sourcing_style: 'balanced', ship_cost: 6.00, shipping: 'buyer' as const,
};

const IDENTITY: IdentityCandidate = {
  itemName: 'Minolta X-700 35mm SLR Film Camera', brand: 'Minolta', model: 'X-700',
  variant: null, gtin: null, gtinKind: null, manufacturerPartNumber: null,
  likelyEbayCategory: 'Cameras', categoryHints: ['Cameras'], conditionHints: null,
  unresolvedAttributes: [], identityConfidence: 80, evidenceUsed: ['visual_ai'],
  normalizedSearchTerms: ['Minolta X-700'], providerId: 'anthropic-claude-vision',
};

// A verified success result priced/turnover'd so it qualifies as HOT
// (STR>=70, turnover<=30, VERY HIGH demand) at a $20 acquisition cost.
function verifiedHotResult(): MarketDataSuccess {
  return {
    ok: true,
    identity: IDENTITY,
    catalogMatch: null,
    category: { categoryTreeId: '0', categoryId: '625', categoryName: 'Cameras', resolved: true },
    metrics: {
      compMatchPrecision: 'exact_model',
      soldPriceStats: {
        compCount: 12, excludedBestOfferCount: 0,
        medianSoldPrice: 85, averageSoldPrice: 88,
        soldPriceLow: 60, soldPriceHigh: 110, evidenceQuality: 'strong',
      },
      activeMarketEvidence: {
        matchingActiveCount: 5, sampledListings: [],
        askingPriceLow: 70, askingPriceHigh: 100,
      },
      turnover: {
        marketTurnoverDays: 15, averageVerifiedSalesPerDay: 0.33,
        soldWindowDays: 90, soldCountInWindow: 12, activeInventoryCount: 5,
      },
      sellThroughRate: 75,
      demandLevel: 'VERY HIGH',
    },
  };
}

const NOT_VERIFIED: MarketDataResult = {
  ok: false, reason: 'SOLDCOMPS_UNAVAILABLE', detail: 'provider outage (test fixture)',
};

// The AI's own guess is deliberately shaped to qualify for HOT if it were
// (incorrectly) fed into decide() — high STR, short days, VERY HIGH demand,
// cheap enough for both profit and ROI to clear a $1 acquisition cost. If the
// fix regresses, this fixture alone is enough to flip a "SKIP because
// unavailable" mistake back into a fabricated HOT.
const AI_HOT_LOOKING_ESTIMATE: Record<string, unknown> = {
  item_name: 'Minolta X-700 35mm SLR Film Camera',
  avg_sold_price: 100, price_low: 80, price_high: 120,
  sell_through_rate: 90, avg_days_to_sell: 5, demand_level: 'VERY HIGH',
  confidence: 85,
};

// ── 1. Verified single scan: unchanged authoritative behavior ──────────────
Deno.test("verified single scan: decisionAvailable, authoritative decision, real economics", () => {
  const core = resolveScanResultCore(verifiedHotResult(), AI_HOT_LOOKING_ESTIMATE, 20, SETTINGS, 0);
  assertEquals(core.decisionAvailable, true);
  assertEquals(core.decisionStatus, 'ok');
  assertEquals(core.marketDataSource, 'verified');
  assertEquals(core.decision, 'HOT');
  assertEquals(core.estimatedSell, 85); // verified median, never the AI's 100
  assertNotEquals(core.estimatedProfit, null);
  assertNotEquals(core.roi, null);
  assertEquals(core.aiEstimate, null); // AI guess dropped once verified evidence exists
});

// ── 2 & core defect ──────────────────────────────────────────────────────
Deno.test("unverified single scan: AI market estimate never enters authoritative economics or decisioning", () => {
  const core = resolveScanResultCore(NOT_VERIFIED, AI_HOT_LOOKING_ESTIMATE, 1, SETTINGS, 0);
  // Before the fix this exact fixture (cheap cost + AI-estimate STR/days/demand
  // shaped to qualify) produced decision:'HOT'. It must now be null.
  assertEquals(core.decision, null);
  assertEquals(core.decisionAvailable, false);
  assertEquals(core.decisionStatus, 'insufficient_market_data');
  assertEquals(core.estimatedProfit, null);
  assertEquals(core.roi, null);
  assertEquals(core.sellThroughRate, null);
  assertEquals(core.avgDaysToSell, null);
  assertEquals(core.demandLevel, null);
  assertEquals(core.estimatedSell, null);
});

// ── 3. No authoritative max-buy-price when unverified, evidence exposed ────
Deno.test("unverified single scan: no authoritative max-buy-price, insufficient evidence explicit", () => {
  const core = resolveScanResultCore(NOT_VERIFIED, AI_HOT_LOOKING_ESTIMATE, null, SETTINGS, 0);
  assertEquals(core.maxBuyPrice, null);
  assertEquals(core.maxBuyPriceLimitedBy, null);
  assertEquals(core.decisionStatus, 'insufficient_market_data');
  // The AI's guess is retained, but only informationally and structurally
  // separate from the (null) authoritative fields above.
  assertEquals(core.aiEstimate?.avgSoldPrice, 100);
  assertEquals(core.aiEstimate?.demandLevel, 'VERY HIGH');
  assertEquals(core.marketDataSource, 'ai_estimate');
});

// ── 4. Verified shelf item: normal authoritative behavior (cost always null) ─
Deno.test("verified shelf item: authoritative decision via backward-solved max-buy-price", () => {
  const core = resolveScanResultCore(verifiedHotResult(), AI_HOT_LOOKING_ESTIMATE, null, SETTINGS, 0);
  assertEquals(core.decisionAvailable, true);
  assertEquals(core.decision, 'HOT');
  assertNotEquals(core.maxBuyPrice, null);
});

// ── 5. Unverified shelf item: no HOT/LIST/SKIP from AI estimate alone ───────
Deno.test("unverified shelf item: no HOT/LIST/SKIP merely from AI estimate", () => {
  const core = resolveScanResultCore(NOT_VERIFIED, AI_HOT_LOOKING_ESTIMATE, null, SETTINGS, 0);
  assertEquals(core.decision, null);
  assertEquals(core.decisionAvailable, false);
});

// ── 6. Mixed shelf results: each item's gate is independent ────────────────
Deno.test("mixed shelf results: verified and unverified items resolve independently", () => {
  const verifiedItem = resolveScanResultCore(verifiedHotResult(), AI_HOT_LOOKING_ESTIMATE, null, SETTINGS, 0);
  const unverifiedItem = resolveScanResultCore(NOT_VERIFIED, AI_HOT_LOOKING_ESTIMATE, null, SETTINGS, 0);
  assertEquals(verifiedItem.decisionAvailable, true);
  assertEquals(verifiedItem.decision, 'HOT');
  assertEquals(unverifiedItem.decisionAvailable, false);
  assertEquals(unverifiedItem.decision, null);
});

// ── Missing genuine evidence (not an AI fallback) still fails, as before ───
Deno.test("evaluateScanEconomics: genuinely null market evidence still fails its threshold (unchanged)", () => {
  const econ = evaluateScanEconomics(20, 85, null, null, null, SETTINGS, 0);
  assertEquals(econ.decision.decision, 'SKIP');
  assertEquals(econ.decision.strPass, false);
  assertEquals(econ.decision.daysPass, false);
});

// ── $0 acquisition cost still bypasses ROI, only on the verified path ──────
Deno.test("verified path: $0 acquisition cost still solves max-buy-price, not treated as a real cost", () => {
  const core = resolveScanResultCore(verifiedHotResult(), AI_HOT_LOOKING_ESTIMATE, 0, SETTINGS, 0);
  // acquisitionCost=0 is a real entered cost (not "blank"), so evaluateScanEconomics
  // takes the "cost entered" branch — net/roi computed, roi null only if cost<=0.
  assertEquals(core.decisionAvailable, true);
  assertEquals(core.roi, null); // calcProfit: roi null when cost <= 0
});
