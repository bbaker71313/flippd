// Tests for marketMetrics — deterministic SoldComps/Browse evidence math
// (P0 remediation: eBay Marketplace Insights replacement).
// Runner: node --test marketMetrics.test.ts. Pure functions, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSoldPriceStats, computeMarketTurnoverDays } from './marketMetrics.ts';
import type { SoldCompListing } from '../types/marketData.ts';

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

test('happy path — odd comp count uses true median, excludes nothing', () => {
  const comps = [comp({ soldPrice: 10 }), comp({ soldPrice: 20 }), comp({ soldPrice: 30 })];
  const stats = computeSoldPriceStats(comps);
  assert.equal(stats.compCount, 3);
  assert.equal(stats.excludedBestOfferCount, 0);
  assert.equal(stats.medianSoldPrice, 20);
  assert.equal(stats.averageSoldPrice, 20);
  assert.equal(stats.soldPriceLow, 10);
  assert.equal(stats.soldPriceHigh, 30);
  assert.equal(stats.evidenceQuality, 'moderate');
});

test('even comp count averages the two middle values for median', () => {
  const comps = [comp({ soldPrice: 10 }), comp({ soldPrice: 20 }), comp({ soldPrice: 30 }), comp({ soldPrice: 40 })];
  const stats = computeSoldPriceStats(comps);
  assert.equal(stats.medianSoldPrice, 25);
  assert.equal(stats.averageSoldPrice, 25);
});

test('Best Offer accepted comps are excluded from price stats but counted', () => {
  const comps = [
    comp({ soldPrice: 10 }),
    comp({ soldPrice: 20 }),
    comp({ soldPrice: 999, bestOfferAccepted: true }), // must never pollute the median
  ];
  const stats = computeSoldPriceStats(comps);
  assert.equal(stats.compCount, 2);
  assert.equal(stats.excludedBestOfferCount, 1);
  assert.equal(stats.medianSoldPrice, 15);
  assert.equal(stats.soldPriceHigh, 20); // the 999 Best Offer listing never surfaces here
});

test('zero comps — no evidence, never fabricates a price', () => {
  const stats = computeSoldPriceStats([]);
  assert.equal(stats.compCount, 0);
  assert.equal(stats.medianSoldPrice, null);
  assert.equal(stats.averageSoldPrice, null);
  assert.equal(stats.evidenceQuality, 'none');
});

test('all comps are Best-Offer-accepted — evidence quality is none, not fabricated', () => {
  const comps = [comp({ soldPrice: 50, bestOfferAccepted: true }), comp({ soldPrice: 60, bestOfferAccepted: true })];
  const stats = computeSoldPriceStats(comps);
  assert.equal(stats.compCount, 0);
  assert.equal(stats.excludedBestOfferCount, 2);
  assert.equal(stats.evidenceQuality, 'none');
});

test('evidence quality — 8+ usable comps is strong', () => {
  const comps = Array.from({ length: 8 }, (_, i) => comp({ soldPrice: 10 + i }));
  assert.equal(computeSoldPriceStats(comps).evidenceQuality, 'strong');
});

test('evidence quality — 1-2 usable comps is weak', () => {
  assert.equal(computeSoldPriceStats([comp({ soldPrice: 10 })]).evidenceQuality, 'weak');
});

test('a zero/negative soldPrice comp is never treated as usable evidence', () => {
  const comps = [comp({ soldPrice: 0 }), comp({ soldPrice: -5 }), comp({ soldPrice: 40 })];
  const stats = computeSoldPriceStats(comps);
  assert.equal(stats.compCount, 1);
  assert.equal(stats.medianSoldPrice, 40);
});

test('turnover — approved formula: activeInventory / averageVerifiedSalesPerDay', () => {
  // 45 sales in 90 days, 18 active listings -> 0.5 sales/day -> 36 days (task doc worked example)
  const t = computeMarketTurnoverDays(45, 90, 18);
  assert.equal(t.averageVerifiedSalesPerDay, 0.5);
  assert.equal(t.marketTurnoverDays, 36);
  assert.equal(t.soldCountInWindow, 45);
  assert.equal(t.soldWindowDays, 90);
  assert.equal(t.activeInventoryCount, 18);
});

test('turnover — zero verified sales in window is undefined, not Infinity', () => {
  const t = computeMarketTurnoverDays(0, 90, 18);
  assert.equal(t.averageVerifiedSalesPerDay, 0);
  assert.equal(t.marketTurnoverDays, null);
});

test('turnover — zero active inventory with real sales velocity is 0 days (everything sells instantly)', () => {
  const t = computeMarketTurnoverDays(10, 30, 0);
  assert.equal(t.marketTurnoverDays, 0);
});

test('turnover — invalid window throws rather than dividing by zero silently', () => {
  assert.throws(() => computeMarketTurnoverDays(10, 0, 5));
});
