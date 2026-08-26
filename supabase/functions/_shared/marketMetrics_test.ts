// Runtime tests for the Deno market-metrics mirror. Run: `deno test supabase/functions/_shared/`
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeSoldPriceStats, computeMarketTurnoverDays } from "./marketMetrics.ts";
import type { SoldCompListing } from "./marketData.ts";

function comp(overrides: Partial<SoldCompListing>): SoldCompListing {
  return {
    itemId: '1', title: 'Test Item', soldPrice: 50, totalPrice: 56,
    shippingPrice: 6, shippingType: 'CALCULATED', currency: 'USD',
    endedAt: '2026-08-01T00:00:00Z', condition: 'Used', conditionId: '3000',
    buyingFormat: 'FIXED_PRICE', bidCount: null, bestOfferAccepted: false,
    listingType: 'FixedPrice', listingUrl: 'https://ebay.com/itm/1',
    sellerFeedbackScore: 500, sellerFeedbackPercent: 99.5,
    ...overrides,
  };
}

Deno.test("median — odd comp count", () => {
  const stats = computeSoldPriceStats([comp({ soldPrice: 10 }), comp({ soldPrice: 20 }), comp({ soldPrice: 30 })]);
  assertEquals(stats.medianSoldPrice, 20);
  assertEquals(stats.evidenceQuality, 'moderate');
});

Deno.test("Best Offer accepted comps excluded from price stats, still counted", () => {
  const stats = computeSoldPriceStats([
    comp({ soldPrice: 10 }), comp({ soldPrice: 20 }), comp({ soldPrice: 999, bestOfferAccepted: true }),
  ]);
  assertEquals(stats.compCount, 2);
  assertEquals(stats.excludedBestOfferCount, 1);
  assertEquals(stats.soldPriceHigh, 20);
});

Deno.test("zero comps — no fabricated price", () => {
  const stats = computeSoldPriceStats([]);
  assertEquals(stats.medianSoldPrice, null);
  assertEquals(stats.evidenceQuality, 'none');
});

Deno.test("turnover — approved formula (task doc worked example)", () => {
  const t = computeMarketTurnoverDays(45, 90, 18);
  assertEquals(t.averageVerifiedSalesPerDay, 0.5);
  assertEquals(t.marketTurnoverDays, 36);
});

Deno.test("turnover — zero verified sales -> null, not Infinity", () => {
  const t = computeMarketTurnoverDays(0, 90, 18);
  assertEquals(t.marketTurnoverDays, null);
});

Deno.test("turnover — invalid window throws", () => {
  assertThrows(() => computeMarketTurnoverDays(10, 0, 5));
});
