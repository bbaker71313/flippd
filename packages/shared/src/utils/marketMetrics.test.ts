// Tests for marketMetrics — deterministic SoldComps/Browse evidence math
// (P0 remediation: eBay Marketplace Insights replacement).
// Runner: node --test marketMetrics.test.ts. Pure functions, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSoldPriceStats, computeMarketTurnoverDays,
  computeSellThroughRate, computeDemandLevel,
} from './marketMetrics.ts';
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

// ── Sell-through rate — approved formula: soldCount90d / (soldCount90d + activeCount) * 100 ──

test('STR — normal case', () => {
  assert.equal(computeSellThroughRate(30, 70), 30);
});

test('STR — 100% (all sold, none active)', () => {
  assert.equal(computeSellThroughRate(20, 0), 100);
});

test('STR — 0% (nothing sold, some active)', () => {
  assert.equal(computeSellThroughRate(0, 15), 0);
});

test('STR — zero sold + positive active is 0%, not fabricated', () => {
  assert.equal(computeSellThroughRate(0, 5), 0);
});

test('STR — positive sold + zero active is 100%, not fabricated', () => {
  assert.equal(computeSellThroughRate(5, 0), 100);
});

test('STR — zero sold + zero active returns null (insufficient evidence, never a fabricated 0%)', () => {
  assert.equal(computeSellThroughRate(0, 0), null);
});

test('STR — rounds to 2 decimal places', () => {
  assert.equal(computeSellThroughRate(1, 2), 33.33);
});

// ── Demand level — approved thresholds, evaluated highest tier downward ──

test('demand — 70% STR / 30 days turnover is VERY HIGH', () => {
  assert.equal(computeDemandLevel(70, 30), 'VERY HIGH');
});

test('demand — just below 70% STR at 30 days falls to HIGH', () => {
  assert.equal(computeDemandLevel(69.9, 30), 'HIGH');
});

test('demand — 70% STR at 31 days (just above VERY HIGH turnover cap) falls to HIGH', () => {
  assert.equal(computeDemandLevel(70, 31), 'HIGH');
});

test('demand — 50% STR / 45 days turnover is HIGH', () => {
  assert.equal(computeDemandLevel(50, 45), 'HIGH');
});

test('demand — 30% STR / 90 days turnover is MEDIUM', () => {
  assert.equal(computeDemandLevel(30, 90), 'MEDIUM');
});

test('demand — below MEDIUM thresholds is LOW', () => {
  assert.equal(computeDemandLevel(10, 200), 'LOW');
});

test('demand — missing STR returns null, never LOW', () => {
  assert.equal(computeDemandLevel(null, 30), null);
});

test('demand — missing turnover returns null, never LOW', () => {
  assert.equal(computeDemandLevel(70, null), null);
});
