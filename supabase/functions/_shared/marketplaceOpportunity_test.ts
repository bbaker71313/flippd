// Run: `deno test supabase/functions/_shared/`
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildMarketplaceOpportunities, selectBestMarketplace, type OpportunitySettings } from "./marketplaceOpportunity.ts";
import type { MarketplaceEvidence, MarketplaceEvidenceResult } from "./marketplaceTypes.ts";

const SETTINGS: OpportunitySettings = { ebayFeePct: 13, pkgCost: 1.25, shipCost: 6, minProfit: 15, targetRoi: 200 };

function evidenceOk(overrides: Partial<MarketplaceEvidence>): MarketplaceEvidenceResult {
  return {
    ok: true,
    evidence: {
      marketplace: 'ebay', evidenceType: 'verified_transaction', matchedItemCount: 5,
      comparableCount: 5, askingPrices: [], medianSoldPrice: 85, medianAskingPrice: null,
      priceLow: 70, priceHigh: 100, expectedSalePrice: 85, matchPrecision: 'exact_model',
      evidenceQuality: 'strong', sourceName: 'test', fetchedAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

Deno.test("highest asking price does not automatically win — stronger evidence beats a higher but weaker price", () => {
  const ebayEvidence = evidenceOk({ marketplace: 'ebay', expectedSalePrice: 50, evidenceQuality: 'strong', medianSoldPrice: 50 });
  const etsyEvidence = evidenceOk({ marketplace: 'etsy', expectedSalePrice: 60, evidenceQuality: 'moderate', medianSoldPrice: null });
  const opportunities = buildMarketplaceOpportunities(
    { ebay: ebayEvidence, etsy: etsyEvidence }, ['ebay', 'etsy'], 5, SETTINGS,
  );
  const best = selectBestMarketplace(opportunities);
  assertEquals(best?.marketplace, 'ebay');
});

Deno.test("provider failure/timeout never becomes a fabricated zero-value opportunity", () => {
  const ok = evidenceOk({});
  const failed: MarketplaceEvidenceResult = { ok: false, marketplace: 'etsy', reason: 'PROVIDER_TIMEOUT', detail: 'timed out' };
  const opportunities = buildMarketplaceOpportunities({ ebay: ok, etsy: failed }, ['ebay', 'etsy'], 5, SETTINGS);
  assertEquals(opportunities.length, 1);
  assertEquals(opportunities[0].marketplace, 'ebay');
});

Deno.test("weak/none evidence marketplaces are excluded from opportunities entirely", () => {
  const weak = evidenceOk({ evidenceQuality: 'weak' });
  const opportunities = buildMarketplaceOpportunities({ ebay: weak }, ['ebay'], 5, SETTINGS);
  assertEquals(opportunities.length, 0);
});

Deno.test("local marketplace wins when shipping/packaging destroys remote-market economics", () => {
  // A cheap, bulky item: expected sale $30, but $6 shipping + $1.25 packaging
  // + 13% fee eats most of it at a $5 acquisition cost -> eBay fails
  // minProfit (net $13.85 < $15). Facebook/local (no shipping, no fee) keeps
  // the same $30 valuation and clears both minProfit and targetRoi easily.
  const bulky = evidenceOk({ marketplace: 'ebay', expectedSalePrice: 30, evidenceQuality: 'moderate', medianSoldPrice: null });
  const opportunities = buildMarketplaceOpportunities({ ebay: bulky }, ['ebay', 'facebook_local'], 5, SETTINGS);
  const ebayOpp = opportunities.find(o => o.marketplace === 'ebay')!;
  const localOpp = opportunities.find(o => o.marketplace === 'facebook_local')!;
  assertEquals(ebayOpp.qualifies, false);
  assertEquals(localOpp.qualifies, true);
  const best = selectBestMarketplace(opportunities);
  assertEquals(best?.marketplace, 'facebook_local');
});

Deno.test("facebook_local is never offered when no other marketplace has qualifying evidence", () => {
  const weak = evidenceOk({ evidenceQuality: 'weak' });
  const opportunities = buildMarketplaceOpportunities({ ebay: weak }, ['ebay', 'facebook_local'], 10, SETTINGS);
  assertEquals(opportunities.find(o => o.marketplace === 'facebook_local'), undefined);
});

Deno.test("$0 acquisition cost preserves roi-null semantics per marketplace", () => {
  const ok = evidenceOk({});
  const opportunities = buildMarketplaceOpportunities({ ebay: ok }, ['ebay'], 0, SETTINGS);
  assertEquals(opportunities[0].economics.roi, null);
  assert(opportunities[0].economics.netProfit !== null);
});

Deno.test("blank acquisition cost solves a max-buy-price per marketplace, never invents a cost", () => {
  const ok = evidenceOk({});
  const opportunities = buildMarketplaceOpportunities({ ebay: ok }, ['ebay'], null, SETTINGS);
  assertEquals(opportunities[0].economics.netProfit, null);
  assert(opportunities[0].economics.maxBuyPrice !== null && opportunities[0].economics.maxBuyPrice! > 0);
});

Deno.test("selectBestMarketplace returns null when there are no opportunities at all", () => {
  assertEquals(selectBestMarketplace([]), null);
});

// R3 (DECISIONS.md T3): facebook_local must not auto-win over its donor
// merely from a lower fee profile / $0 shipping when both qualify.
Deno.test("T3: facebook_local does NOT outrank its donor when the margin is under 25%/$10", () => {
  // High-value item where eBay's 13% fee + shipping is a small dollar
  // difference from local's $0-fee economics — local is a little ahead, but
  // nowhere near 25%/$10 ahead.
  const ebayEvidence = evidenceOk({ marketplace: 'ebay', expectedSalePrice: 500, evidenceQuality: 'strong', medianSoldPrice: 500 });
  const opportunities = buildMarketplaceOpportunities({ ebay: ebayEvidence }, ['ebay', 'facebook_local'], 5, SETTINGS);
  const ebayOpp = opportunities.find(o => o.marketplace === 'ebay')!;
  const localOpp = opportunities.find(o => o.marketplace === 'facebook_local')!;
  assertEquals(ebayOpp.qualifies, true);
  assertEquals(localOpp.qualifies, true);
  assert(localOpp.economics.netProfit! > ebayOpp.economics.netProfit!, 'local should still be nominally ahead (no fee/shipping)');
  const best = selectBestMarketplace(opportunities);
  assertEquals(best?.marketplace, 'ebay', 'local must not win purely from a smaller-than-threshold fee advantage');
});

Deno.test("T3: facebook_local DOES outrank its donor once it clears >=25% AND >=$10", () => {
  // A cheap, bulky item where eBay's fee+shipping eat a large share of a
  // small sale price — local's $0-fee economics clear both the 25% and $10
  // absolute bars easily.
  const ebayEvidence = evidenceOk({ marketplace: 'ebay', expectedSalePrice: 40, evidenceQuality: 'strong', medianSoldPrice: 40 });
  const opportunities = buildMarketplaceOpportunities({ ebay: ebayEvidence }, ['ebay', 'facebook_local'], 5, SETTINGS);
  const ebayOpp = opportunities.find(o => o.marketplace === 'ebay')!;
  const localOpp = opportunities.find(o => o.marketplace === 'facebook_local')!;
  assertEquals(ebayOpp.qualifies, true);
  assertEquals(localOpp.qualifies, true);
  const margin = localOpp.economics.netProfit! - ebayOpp.economics.netProfit!;
  assert(margin >= 10 && localOpp.economics.netProfit! >= ebayOpp.economics.netProfit! * 1.25, 'fixture must actually clear the T3 bar');
  const best = selectBestMarketplace(opportunities);
  assertEquals(best?.marketplace, 'facebook_local');
});
