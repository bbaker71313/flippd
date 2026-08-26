// Runtime tests for the Deno market-metrics mirror. Run: `deno test supabase/functions/_shared/`
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeSoldPriceStats, computeMarketTurnoverDays,
  computeSellThroughRate, computeDemandLevel,
} from "./marketMetrics.ts";
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

Deno.test("STR — normal case", () => {
  assertEquals(computeSellThroughRate(30, 70), 30);
});

Deno.test("STR — zero sold + zero active -> null, not a fabricated 0%", () => {
  assertEquals(computeSellThroughRate(0, 0), null);
});

Deno.test("STR — zero active -> 100%", () => {
  assertEquals(computeSellThroughRate(5, 0), 100);
});

Deno.test("demand — 70% STR / 30 days turnover is VERY HIGH", () => {
  assertEquals(computeDemandLevel(70, 30), 'VERY HIGH');
});

Deno.test("demand — 50% STR / 45 days turnover is HIGH", () => {
  assertEquals(computeDemandLevel(50, 45), 'HIGH');
});

Deno.test("demand — 30% STR / 90 days turnover is MEDIUM", () => {
  assertEquals(computeDemandLevel(30, 90), 'MEDIUM');
});

Deno.test("demand — below MEDIUM is LOW", () => {
  assertEquals(computeDemandLevel(10, 200), 'LOW');
});

Deno.test("demand — missing STR or turnover -> null, never LOW", () => {
  assertEquals(computeDemandLevel(null, 30), null);
  assertEquals(computeDemandLevel(70, null), null);
});
