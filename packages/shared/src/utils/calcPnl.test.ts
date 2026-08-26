// Tests for calcPnl — realized P&L must use actual soldPrice, never listing
// price (P0 #3). Runner: `node --test calcPnl.test.ts` (type-stripped).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcPnl } from './calcPnl.ts';
import type { InventoryItem, UserSettings } from '../types/index.ts';

const SETTINGS: Pick<UserSettings, 'ebayFee' | 'pkgCost' | 'shipping' | 'shipCost' | 'taxReservePct' | 'mileageRate'> = {
  ebayFee: 13, pkgCost: 1.25, shipping: 'buyer', shipCost: 6, taxReservePct: 0.25, mileageRate: 0.67,
};

function mkItem(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: 1, userId: 1, sku: null, nickname: 'Item', category: null, condition: null,
    cost: 0, sellPrice: null, soldPrice: null, status: 'Sold', platform: 'eBay',
    photos: [], notes: null, sourcingMeta: null, listingData: null, ebayItemId: null,
    photoCount: 0, createdFrom: null, listedAt: null, soldAt: '2026-01-05T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-05T00:00:00Z',
    ...overrides,
  };
}

test('listed at $100, sold at $80 -> realized revenue uses $80, not $100', () => {
  const item = mkItem({ sellPrice: 100, soldPrice: 80, cost: 10 });
  const r = calcPnl([item], [item], [], SETTINGS, 'All Time');
  assert.equal(r.totalRevenue, 80);
});

test('listed at $80, sold at $100 -> realized revenue uses $100, not $80', () => {
  const item = mkItem({ sellPrice: 80, soldPrice: 100, cost: 10 });
  const r = calcPnl([item], [item], [], SETTINGS, 'All Time');
  assert.equal(r.totalRevenue, 100);
});

test('revenue-based fees (eBay %) are computed from actual soldPrice', () => {
  const item = mkItem({ sellPrice: 200, soldPrice: 100, cost: 10 });
  const r = calcPnl([item], [item], [], SETTINGS, 'All Time');
  assert.equal(r.totalFees, 13); // 100 * 13%, not 200 * 13%
});

test('realized profit changes correctly when soldPrice differs from sellPrice', () => {
  const cheap = mkItem({ id: 1, sellPrice: 100, soldPrice: 50, cost: 10 });
  const full  = mkItem({ id: 2, sellPrice: 100, soldPrice: 100, cost: 10 });
  const rCheap = calcPnl([cheap], [cheap], [], SETTINGS, 'All Time');
  const rFull  = calcPnl([full], [full], [], SETTINGS, 'All Time');
  assert.ok(rCheap.netProfit < rFull.netProfit);
});

test('missing soldPrice does not silently fall back to sellPrice — item excluded from $ totals', () => {
  const priced   = mkItem({ id: 1, sellPrice: 50, soldPrice: 50, cost: 10 });
  const unpriced = mkItem({ id: 2, sellPrice: 50, soldPrice: null, cost: 10 });
  const r = calcPnl([priced, unpriced], [priced, unpriced], [], SETTINGS, 'All Time');
  // Only the priced item contributes revenue/cost — nothing invented for the other.
  assert.equal(r.totalRevenue, 50);
  assert.equal(r.totalCogs, 10);
  assert.equal(r.itemsSold, 2);
  assert.equal(r.itemsMissingSoldPrice, 1);
});

test('DB sold_price -> domain soldPrice: null vs a real value are handled distinctly', () => {
  const zero = mkItem({ id: 1, soldPrice: 0, cost: 0 });
  const r = calcPnl([zero], [zero], [], SETTINGS, 'All Time');
  // A genuine $0 sale (soldPrice === 0, not null) is real data — not missing.
  assert.equal(r.itemsMissingSoldPrice, 0);
  assert.equal(r.totalRevenue, 0);
});

test('existing unsold-item behavior is unchanged — Listed/Unlisted items never enter revenue calc', () => {
  const sold     = mkItem({ id: 1, status: 'Sold', soldPrice: 50, cost: 10 });
  const listed   = mkItem({ id: 2, status: 'Listed', soldPrice: null, sellPrice: 75 });
  const unlisted = mkItem({ id: 3, status: 'Unlisted', soldPrice: null, sellPrice: 30 });
  const r = calcPnl([sold], [sold, listed, unlisted], [], SETTINGS, 'All Time');
  assert.equal(r.totalRevenue, 50);
  assert.equal(r.itemsListed, 1);
  assert.equal(r.itemsUnlisted, 1);
});
